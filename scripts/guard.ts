import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Session } from "../src/lib/session-schema";

export type Finding = { file: string; line: number; rule: string };
export type GuardResult = { ok: boolean; findings: Finding[] };

// Identity patterns: matched case-insensitively, in every file except the guard's own two files.
const IDENTITY = ["/users/", "googledrive-", "obsidian-vault", "@gmail.com", "%40gmail.com", "%2fusers%2f", "&#64;gmail.com"];
// Markup patterns: matched case-sensitively, only in the published scope.
const MARKUP = ["[[", "[added", "[UNVERIFIED]", "claude.ai/artifact"];
const IDENTITY_EXEMPT = new Set(["scripts/guard.ts", "tests/guard.test.ts"]);
const MANIFEST = "src/content/.manifest.json";
const SCOPE = /^(src\/|public\/|README\.md$)/;
const SESSION = /^src\/content\/sessions\/[^/]+\.json$/;
const ZERO = /^0+$/;

function git(repoDir: string, args: string[]): string[] {
  return execFileSync("git", args, { cwd: repoDir, encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(Boolean);
}
function gitBuf(repoDir: string, args: string[]): Buffer {
  return execFileSync("git", args, { cwd: repoDir, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
}

function vaultDir(repoDir: string): string | null {
  const envFile = join(repoDir, ".env.local");
  if (!existsSync(envFile)) return null;
  const m = readFileSync(envFile, "utf8").match(/^\s*VAULT_DIR\s*=\s*(.*)$/m);
  const v = m?.[1].trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return v ? v.toLowerCase() : null;
}

function scanText(repoDir: string, label: string, path: string, bytes: Buffer, vault: string | null): Finding[] {
  if (bytes.includes(0)) return [];
  const out: Finding[] = [];
  const identity = !IDENTITY_EXEMPT.has(path);
  const markup = SCOPE.test(path);
  bytes.toString("utf8").split("\n").forEach((text, i) => {
    const lower = text.toLowerCase();
    if (identity) {
      for (const n of IDENTITY) if (lower.includes(n)) out.push({ file: label, line: i + 1, rule: `identity:${n}` });
      if (vault && lower.includes(vault)) out.push({ file: label, line: i + 1, rule: "identity:vault-dir" });
    }
    if (markup) for (const n of MARKUP) if (text.includes(n)) out.push({ file: label, line: i + 1, rule: `forbidden:${n}` });
  });
  return out;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function checkContent(
  paths: string[],
  read: (p: string) => Buffer,
  manifestBytes: Buffer | null,
  label: (p: string) => string,
): Finding[] {
  const out: Finding[] = [];
  const content = paths.filter((f) => f.startsWith("src/content/") && f !== MANIFEST);
  let manifest: Record<string, string> | null = null;
  if (manifestBytes) {
    try {
      manifest = JSON.parse(manifestBytes.toString("utf8")).files ?? {};
    } catch {
      out.push({ file: label(MANIFEST), line: 0, rule: "manifest-unreadable" });
    }
  } else if (content.length > 0) {
    out.push({ file: label(MANIFEST), line: 0, rule: "manifest-missing" });
  }
  for (const file of content) {
    if (!manifest) break;
    const expected = manifest[file];
    if (expected === undefined) out.push({ file: label(file), line: 0, rule: "not-in-manifest" });
    else if (sha256(read(file)) !== expected) out.push({ file: label(file), line: 0, rule: "hash-mismatch" });
  }
  for (const file of paths.filter((f) => SESSION.test(f))) {
    try {
      if (!Session.safeParse(JSON.parse(read(file).toString("utf8"))).success) out.push({ file: label(file), line: 0, rule: "session-schema" });
    } catch {
      out.push({ file: label(file), line: 0, rule: "session-schema" });
    }
  }
  return out;
}

function trackedAndStaged(repoDir: string): string[] {
  const tracked = git(repoDir, ["ls-files"]);
  const staged = git(repoDir, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return [...new Set([...tracked, ...staged])].filter((f) => existsSync(join(repoDir, f))).sort();
}

/** Working-tree mode: tracked + staged files as they are on disk. */
export function runGuard(repoDir: string): GuardResult {
  const all = trackedAndStaged(repoDir);
  const vault = vaultDir(repoDir);
  const disk = (p: string) => readFileSync(join(repoDir, p));
  const findings = checkContent(
    all.filter((f) => SCOPE.test(f)),
    disk,
    existsSync(join(repoDir, MANIFEST)) ? disk(MANIFEST) : null,
    (p) => p,
  );
  for (const f of all) findings.push(...scanText(repoDir, f, f, disk(f), vault));
  return { ok: findings.length === 0, findings };
}

/** Push mode: every blob of every commit about to be pushed, plus manifest/schema checks on each pushed tip. */
export function runGuardOnPush(repoDir: string, refLines: string): GuardResult {
  const findings: Finding[] = [];
  const vault = vaultDir(repoDir);
  const seen = new Set<string>();
  const tips = new Set<string>();

  for (const line of refLines.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [, local, , remote] = line.split(/\s+/);
    if (!local || ZERO.test(local)) continue;
    tips.add(local);
    let commits: string[];
    try {
      commits = remote && !ZERO.test(remote) ? git(repoDir, ["rev-list", local, `^${remote}`]) : git(repoDir, ["rev-list", local, "--not", "--remotes"]);
    } catch {
      commits = git(repoDir, ["rev-list", local, "--not", "--remotes"]);
    }
    if (remote && !ZERO.test(remote)) {
      try {
        for (const entry of git(repoDir, ["ls-tree", "-r", remote])) {
          const m = entry.match(/^\d+ blob ([0-9a-f]+)\t(.*)$/);
          if (m) seen.add(`${m[1]} ${m[2]}`);
        }
      } catch {
        // remote tip not known locally: scan everything
      }
    }
    for (const c of commits) {
      const short = c.slice(0, 7);
      for (const entry of git(repoDir, ["ls-tree", "-r", c])) {
        const m = entry.match(/^\d+ blob ([0-9a-f]+)\t(.*)$/);
        if (!m) continue;
        const [, blob, path] = m;
        if (seen.has(`${blob} ${path}`)) continue;
        seen.add(`${blob} ${path}`);
        findings.push(...scanText(repoDir, `${short}:${path}`, path, gitBuf(repoDir, ["cat-file", "blob", blob]), vault));
      }
    }
  }

  for (const tip of tips) {
    const paths = git(repoDir, ["ls-tree", "-r", "--name-only", tip]).filter((f) => SCOPE.test(f));
    let manifest: Buffer | null = null;
    try {
      manifest = gitBuf(repoDir, ["show", `${tip}:${MANIFEST}`]);
    } catch {
      manifest = null;
    }
    findings.push(...checkContent(paths, (p) => gitBuf(repoDir, ["show", `${tip}:${p}`]), manifest, (p) => p));
  }
  return { ok: findings.length === 0, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repoDir = git(process.cwd(), ["rev-parse", "--show-toplevel"])[0];
  const push = process.argv.includes("--push");
  const result = push ? runGuardOnPush(repoDir, readFileSync(0, "utf8")) : runGuard(repoDir);
  if (result.ok) {
    console.log(push ? "guard ok (push)" : `guard ok (${trackedAndStaged(repoDir).length} files)`);
  } else {
    for (const f of result.findings) console.error(`${f.file}:${f.line} ${f.rule}`);
    process.exit(1);
  }
}
