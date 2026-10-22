import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Session } from "../src/lib/session-schema";

export type Finding = { file: string; line: number; rule: string };
export type GuardResult = { ok: boolean; findings: Finding[] };

const FORBIDDEN = ["[[", "[added", "[UNVERIFIED]", "claude.ai/artifact", "/Users/", "GoogleDrive-", "Obsidian-vault", "@gmail.com"];
const MANIFEST = "src/content/.manifest.json";
const SCOPE = /^(src\/|public\/|README\.md$)/;
const SESSION = /^src\/content\/sessions\/[^/]+\.json$/;

function git(repoDir: string, args: string[]): string[] {
  const out = execFileSync("git", args, { cwd: repoDir, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function scopedFiles(repoDir: string): string[] {
  const tracked = git(repoDir, ["ls-files"]);
  const staged = git(repoDir, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return [...new Set([...tracked, ...staged])].filter((f) => SCOPE.test(f) && existsSync(join(repoDir, f))).sort();
}

export function runGuard(repoDir: string): GuardResult {
  const findings: Finding[] = [];
  const files = scopedFiles(repoDir);

  const content = files.filter((f) => f.startsWith("src/content/") && f !== MANIFEST);
  let manifest: Record<string, string> | null = null;
  if (existsSync(join(repoDir, MANIFEST))) {
    try {
      manifest = JSON.parse(readFileSync(join(repoDir, MANIFEST), "utf8")).files ?? {};
    } catch {
      findings.push({ file: MANIFEST, line: 0, rule: "manifest-unreadable" });
    }
  } else if (content.length > 0) {
    findings.push({ file: MANIFEST, line: 0, rule: "manifest-missing" });
  }

  for (const file of content) {
    if (!manifest) continue;
    const expected = manifest[file];
    if (expected === undefined) {
      findings.push({ file, line: 0, rule: "not-in-manifest" });
    } else if (createHash("sha256").update(readFileSync(join(repoDir, file))).digest("hex") !== expected) {
      findings.push({ file, line: 0, rule: "hash-mismatch" });
    }
  }

  for (const file of files) {
    const bytes = readFileSync(join(repoDir, file));
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    text.split("\n").forEach((lineText, i) => {
      for (const needle of FORBIDDEN) {
        if (lineText.includes(needle)) findings.push({ file, line: i + 1, rule: `forbidden:${needle}` });
      }
    });
    if (SESSION.test(file)) {
      try {
        const parsed = Session.safeParse(JSON.parse(text));
        if (!parsed.success) findings.push({ file, line: 0, rule: "session-schema" });
      } catch {
        findings.push({ file, line: 0, rule: "session-schema" });
      }
    }
  }

  return { ok: findings.length === 0, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repoDir = git(process.cwd(), ["rev-parse", "--show-toplevel"])[0];
  const result = runGuard(repoDir);
  if (result.ok) {
    console.log(`guard ok (${scopedFiles(repoDir).length} files)`);
  } else {
    for (const f of result.findings) console.error(`${f.file}:${f.line} ${f.rule}`);
    process.exit(1);
  }
}
