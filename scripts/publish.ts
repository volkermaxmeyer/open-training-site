import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PublishError } from "./lib/errors";
import { parseSession, type Goals } from "./lib/parse-session";
import { splitFrontmatter } from "./lib/text";
import { runGuard } from "./guard";
import { CHANGELOG_FILE, VERSION_FILE, release } from "./lib/version";
import type { Session } from "../src/lib/session-schema";

export const LIVE_URL = "https://open-training-site.vercel.app";
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export type PublishOptions = {
  vaultDir: string;
  outDir: string;
  dryRun: boolean;
  /** Manifest keys are relative to this directory. Default: process.cwd(). */
  repoRoot?: string;
  /** Command run before anything is read; non-zero exit aborts. Default: none (the CLI passes the python validator). */
  validateCmd?: string[];
};
export type PublishResult = { written: string[]; removed: string[]; warnings: string[]; slugs: string[] };
type Manifest = { files: Record<string, string>; slugsEverPublished: string[] };

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const posix = (p: string) => p.split(sep).join("/");

function readManifest(path: string): Manifest {
  if (!existsSync(path)) return { files: {}, slugsEverPublished: [] };
  const m = JSON.parse(readFileSync(path, "utf8"));
  return { files: m.files ?? {}, slugsEverPublished: m.slugsEverPublished ?? [] };
}

/** player_goals from the vault's schema block (system/datenmodell.md); empty when the vault has none. */
export function readGoals(vaultDir: string): Goals {
  const path = join(vaultDir, "system/datenmodell.md");
  if (!existsSync(path)) return new Map();
  const m = readFileSync(path, "utf8").match(/```json schema\n([\s\S]*?)\n```/);
  if (!m) throw new PublishError("datenmodell.md", "no ```json schema block");
  const list: { id: string; label: string }[] = JSON.parse(m[1]).player_goals ?? [];
  return new Map(list.map((g, order) => [g.id, { label: g.label, order }]));
}

export async function publish(opts: PublishOptions): Promise<PublishResult> {
  const repoRoot = opts.repoRoot ?? process.cwd();

  if (opts.validateCmd) {
    const [cmd, ...args] = opts.validateCmd;
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`vault validation failed (exit ${r.status ?? "none"})\n${r.stdout ?? ""}${r.stderr ?? ""}`);
  }

  const drillDir = join(opts.vaultDir, "drills");
  const drills = new Map<string, string>(
    readdirSync(drillDir).filter((f) => f.endsWith(".md")).map((f) => [f.slice(0, -3), readFileSync(join(drillDir, f), "utf8")]),
  );
  const goals = readGoals(opts.vaultDir);
  const sessionDir = join(opts.vaultDir, "sessions/web");
  const warnings: string[] = [];

  // Parse everything first: any PublishError aborts before a single write.
  const sessions = new Map<string, Session>();
  const nextOf = new Map<string, string>(); // slug -> slug of the follow-up session
  for (const f of readdirSync(sessionDir).filter((f) => f.endsWith(".md")).sort()) {
    const text = readFileSync(join(sessionDir, f), "utf8");
    const parts = splitFrontmatter(text);
    if (!parts) throw new PublishError(f, "no readable frontmatter (half-synced file?); aborting so nothing gets unpublished");
    if (parts.fm.publish !== true) continue;
    const session = parseSession(text, drills, goals);
    if (`${session.slug}.md` !== f) throw new PublishError(session.slug, `slug "${session.slug}" does not match filename "${f}"`);
    if (!SLUG.test(session.slug)) throw new PublishError(session.slug, "slug must be lowercase letters, digits and hyphens");
    if (sessions.has(session.slug)) throw new PublishError(session.slug, "duplicate slug");
    sessions.set(session.slug, session);
    const next = typeof parts.fm.next === "string" ? parts.fm.next.trim() : "";
    if (next) nextOf.set(session.slug, next);
  }

  // "Got another 30 min?" only points at a session that is published in this same run.
  const outputs = new Map<string, string>(); // slug -> JSON text
  for (const [slug, session] of sessions) {
    const target = sessions.get(nextOf.get(slug) ?? "");
    const out = target && target.slug !== slug ? { ...session, next: { slug: target.slug, title: target.title } } : session;
    outputs.set(slug, JSON.stringify(out, null, 2) + "\n");
  }

  const manifestPath = join(opts.outDir, ".manifest.json");
  const prev = readManifest(manifestPath);
  const key = (slug: string) => posix(relative(repoRoot, join(opts.outDir, "sessions", `${slug}.json`)));

  const files: Record<string, string> = {};
  const written: string[] = [];
  for (const [slug, json] of outputs) {
    const k = key(slug);
    files[k] = sha256(json);
    const onDisk = join(repoRoot, k);
    if (prev.files[k] !== files[k] || !existsSync(onDisk)) written.push(k);
  }
  const removed = Object.keys(prev.files).filter((k) => !(k in files));

  const slugs = [...outputs.keys()];
  for (const s of prev.slugsEverPublished) {
    if (!outputs.has(s)) warnings.push(`previously published slug "${s}" is no longer published; its URL will 404`);
  }
  const everPublished = [...new Set([...prev.slugsEverPublished, ...slugs])];

  if (!opts.dryRun) {
    mkdirSync(join(opts.outDir, "sessions"), { recursive: true });
    for (const [slug, json] of outputs) writeFileSync(join(repoRoot, key(slug)), json);
    for (const k of removed) rmSync(join(repoRoot, k), { force: true });
    const manifest: Manifest = { files, slugsEverPublished: everPublished };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  return { written, removed, warnings, slugs };
}

/** Returns an abort message when the run would unpublish sessions and that was not explicitly allowed. */
export function checkUnpublish(result: PublishResult, allow: boolean): string | null {
  if (allow || result.removed.length === 0) return null;
  return `this would unpublish ${result.removed.length} session(s): ${result.removed.join(", ")}. Re-run with --allow-unpublish if intended.`;
}

export function loadEnv(repoRoot: string): void {
  const file = join(repoRoot, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

/**
 * Stages src/content, runs `check` on the staged state (false = abort, unstage), then commits only src/content
 * plus the bumped src/version.json and its CHANGELOG.md line (`note`, default: the commit message).
 * Anything else in the index stays staged. Returns false if nothing changed.
 */
export function commitContent(repoDir: string, message: string, check: () => boolean = () => true, note = message): boolean {
  const run = (...a: string[]) => execFileSync("git", a, { cwd: repoDir, stdio: "inherit" });
  run("add", "src/content");
  if (!check()) {
    run("reset", "-q", "--", "src/content");
    throw new Error("guard failed, nothing committed");
  }
  if (spawnSync("git", ["diff", "--cached", "--quiet", "--", "src/content"], { cwd: repoDir }).status === 0) return false;
  // Every publication is a new site version, one above what is live.
  spawnSync("git", ["fetch", "-q", "origin", "main"], { cwd: repoDir });
  release(repoDir, note);
  run("add", VERSION_FILE, CHANGELOG_FILE);
  run("commit", "-m", message, "-m", "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>", "--", "src/content", VERSION_FILE, CHANGELOG_FILE);
  return true;
}

async function main(): Promise<number> {
  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const dryRun = process.argv.includes("--dry-run");
  loadEnv(repoRoot);
  const vaultDir = process.env.VAULT_DIR;
  if (!vaultDir) {
    console.error("VAULT_DIR is not set (put it in .env.local)");
    return 1;
  }
  if (!existsSync(join(vaultDir, "sessions/web"))) {
    console.error("VAULT_DIR has no sessions/web folder");
    return 1;
  }

  const base = {
    vaultDir,
    outDir: join(repoRoot, "src/content"),
    repoRoot,
    validateCmd: ["python3", join(vaultDir, "app/tooling/validate.py")],
  };
  let result: PublishResult;
  try {
    // Plan first without writing, so an unpublish can be refused before anything changes.
    result = await publish({ ...base, dryRun: true });
    const blocked = dryRun ? null : checkUnpublish(result, process.argv.includes("--allow-unpublish"));
    if (blocked) {
      console.error(`publish aborted: ${blocked}`);
      return 1;
    }
    if (!dryRun) result = await publish({ ...base, dryRun: false, validateCmd: undefined });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`publish aborted: ${msg.split(vaultDir).join("<vault>")}`);
    return 1;
  }

  console.log(`${result.slugs.length} sessions`);
  for (const w of result.warnings) console.warn(`warning: ${w}`);
  for (const f of result.written) console.log(`write  ${f}`);
  for (const f of result.removed) console.log(`remove ${f}`);
  if (dryRun) {
    console.log("dry run: nothing touched");
    return 0;
  }

  const guardOk = () => {
    const guard = runGuard(repoRoot);
    for (const f of guard.findings) console.error(`${f.file}:${f.line} ${f.rule}`);
    return guard.ok;
  };
  try {
    const slugOf = (f: string) => f.replace(/^.*\//, "").replace(/\.json$/, "");
    const note = [
      result.written.length ? `Sessions published or updated: ${result.written.map(slugOf).join(", ")}.` : "",
      result.removed.length ? `Sessions taken offline: ${result.removed.map(slugOf).join(", ")}.` : "",
    ].filter(Boolean).join(" ") || "Session content updated.";
    if (!commitContent(repoRoot, `content: publish ${result.slugs.join(", ") || "(none)"}`, guardOk, note)) {
      console.log("nothing to publish");
      return 0;
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  execFileSync("git", ["push"], { cwd: repoRoot, stdio: "inherit" });
  console.log(`version ${JSON.parse(readFileSync(join(repoRoot, VERSION_FILE), "utf8")).version}`);
  console.log(`live: ${LIVE_URL}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((c) => process.exit(c));
}
