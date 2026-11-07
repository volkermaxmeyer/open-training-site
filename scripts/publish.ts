import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PublishError } from "./lib/errors";
import { parseSession, type Goals } from "./lib/parse-session";
import { parseCard, type GoalFilter } from "./lib/parse-card";
import { SHOTS } from "../src/lib/shots";
import { renamedSlugs } from "./lib/renamed";
import { splitFrontmatter } from "./lib/text";
import { runGuard } from "./guard";
import { CHANGELOG_FILE, VERSION_FILE, release } from "./lib/version";
import type { DrillPage, Session } from "../src/lib/session-schema";

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
export type PublishResult = { written: string[]; removed: string[]; warnings: string[]; slugs: string[]; drills?: string[] };
type Manifest = { files: Record<string, string>; slugsEverPublished: string[]; drillsEverPublished?: string[] };

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const posix = (p: string) => p.split(sep).join("/");

function readManifest(path: string): Manifest {
  if (!existsSync(path)) return { files: {}, slugsEverPublished: [] };
  const m = JSON.parse(readFileSync(path, "utf8"));
  return { files: m.files ?? {}, slugsEverPublished: m.slugsEverPublished ?? [], drillsEverPublished: m.drillsEverPublished ?? [] };
}

/**
 * The Overview (src/data/overview.json) is a hand-kept snapshot. Compare the three totals that can be read reliably from
 * the vault and say which ones moved: live drills (status not archived), drills tested on court (tested + favorite,
 * as system/feedback-loop.md counts "drills that held up") and themes (weekly_themes in the schema block). Cues and
 * plans are prose lines and are left out on purpose. No overview file, no comparison (data architecture review 2026-11-07).
 */
export function overviewDrift(repoRoot: string, vaultDir: string, drills: Map<string, string>): string[] {
  const file = join(repoRoot, "src/data/overview.json");
  if (!existsSync(file)) return [];
  const totals: Record<string, number> = JSON.parse(readFileSync(file, "utf8")).totals ?? {};
  const status = [...drills].filter(([name]) => /^\d+-/.test(name)).map(([, text]) => String(splitFrontmatter(text)?.fm.status ?? ""));
  const vault: Record<string, number | undefined> = {
    drills: status.filter((s) => s !== "archived").length,
    tested: status.filter((s) => s === "tested" || s === "favorite").length,
  };
  const schema = join(vaultDir, "system/datenmodell.md");
  const block = existsSync(schema) ? readFileSync(schema, "utf8").match(/```json schema\n([\s\S]*?)\n```/) : null;
  const themes = block ? JSON.parse(block[1]).weekly_themes : undefined;
  if (Array.isArray(themes)) vault.themes = themes.length;
  const label: Record<string, string> = { drills: "drills", tested: "drills tested on court", themes: "themes" };
  return Object.entries(vault)
    .filter(([k, v]) => v !== undefined && totals[k] !== undefined && totals[k] !== v)
    .map(([k, v]) => `Overview says ${totals[k]} ${label[k]}, the vault has ${v}: refresh src/data/overview.json (vault dashboard/README.md, Updating)`);
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

function schemaBlock(vaultDir: string): Record<string, any> | null {
  const path = join(vaultDir, "system/datenmodell.md");
  if (!existsSync(path)) return null;
  const m = readFileSync(path, "utf8").match(/```json schema\n([\s\S]*?)\n```/);
  return m ? JSON.parse(m[1]) : null;
}

/** Each player goal with the theme filters that reach a drill (Shots area: session pointer, 2026-11-07). */
export function readGoalFilters(vaultDir: string): GoalFilter[] {
  const schema = schemaBlock(vaultDir);
  if (!schema) return [];
  const themes = new Map<number, { field: string; value: string }>(
    (schema.weekly_themes ?? []).map((t: { id: number; filter: { field: string; value: string } }) => [t.id, t.filter]),
  );
  return (schema.player_goals ?? []).map((g: { id: string; themes: number[] }) => ({
    id: g.id,
    filters: g.themes.map((t) => themes.get(t)).filter((f): f is { field: string; value: string } => Boolean(f)),
  }));
}

/** The site's shot tiles (src/lib/shots.ts) must match the vault's `enums.shot` without `none`. */
export function shotDrift(vaultDir: string): string[] {
  const vault: string[] | undefined = schemaBlock(vaultDir)?.enums?.shot;
  if (!vault) return [];
  const want = vault.filter((x) => x !== "none");
  const have = [...SHOTS] as string[];
  return want.join("|") === have.join("|")
    ? []
    : [`shot tiles differ from the vault's enums.shot: site ${have.join(", ")} · vault ${want.join(", ")} (update src/lib/shots.ts)`];
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
  // A drill's number is its id on the site and in the Overview, so two files with one number must stop the run
  // ("08" and "8" count as the same; data architecture review 2026-11-07).
  const byNumber = new Map<number, string>();
  for (const name of [...drills.keys()].filter((n) => /^\d+-/.test(n)).sort()) {
    const n = Number(name.match(/^(\d+)-/)![1]);
    const first = byNumber.get(n);
    if (first) throw new PublishError("drills", `number ${n} is used by both ${first}.md and ${name}.md`);
    byNumber.set(n, name);
  }
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

  // Released player cards (Shots area, 2026-11-07): one file per drill, src/content/drills/<number>.json.
  const goalFilters = readGoalFilters(opts.vaultDir);
  const cards = new Map<string, DrillPage>();
  for (const [name, text] of [...drills].filter(([n]) => /^\d+-/.test(n)).sort()) {
    const card = parseCard(text, name, goalFilters);
    if (card) cards.set(card.id, card);
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
  const drillKey = (id: string) => posix(relative(repoRoot, join(opts.outDir, "drills", `${id}.json`)));
  const cardOutputs = new Map<string, string>([...cards].map(([id, c]) => [id, JSON.stringify(c, null, 2) + "\n"]));
  for (const [id, json] of cardOutputs) {
    const k = drillKey(id);
    files[k] = sha256(json);
    if (prev.files[k] !== files[k] || !existsSync(join(repoRoot, k))) written.push(k);
  }
  const removed = Object.keys(prev.files).filter((k) => !(k in files));

  const slugs = [...outputs.keys()];
  // A renamed session redirects (vercel.json), so its old URL does not 404: only warn when nothing catches it.
  const renamed = renamedSlugs(repoRoot);
  for (const s of prev.slugsEverPublished) {
    if (!outputs.has(s) && !(renamed[s] && outputs.has(renamed[s])))
      warnings.push(`previously published slug "${s}" is no longer published; its URL will 404`);
  }
  for (const id of prev.drillsEverPublished ?? []) {
    if (!cardOutputs.has(id)) warnings.push(`previously published drill page /drill/${id}/ is no longer published (card not released?); its URL will 404`);
  }
  warnings.push(...overviewDrift(repoRoot, opts.vaultDir, drills));
  warnings.push(...shotDrift(opts.vaultDir));
  const everPublished = [...new Set([...prev.slugsEverPublished, ...slugs])];
  const drillsEver = [...new Set([...(prev.drillsEverPublished ?? []), ...cardOutputs.keys()])].sort();

  if (!opts.dryRun) {
    mkdirSync(join(opts.outDir, "sessions"), { recursive: true });
    for (const [slug, json] of outputs) writeFileSync(join(repoRoot, key(slug)), json);
    if (cardOutputs.size) mkdirSync(join(opts.outDir, "drills"), { recursive: true });
    for (const [id, json] of cardOutputs) writeFileSync(join(repoRoot, drillKey(id)), json);
    for (const k of removed) rmSync(join(repoRoot, k), { force: true });
    const manifest: Manifest = { files, slugsEverPublished: everPublished, ...(drillsEver.length ? { drillsEverPublished: drillsEver } : {}) };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  return { written, removed, warnings, slugs, drills: [...cardOutputs.keys()] };
}

/** Returns an abort message when the run would unpublish sessions and that was not explicitly allowed. */
export function checkUnpublish(result: PublishResult, allow: boolean): string | null {
  if (allow || result.removed.length === 0) return null;
  return `this would unpublish ${result.removed.length} page(s): ${result.removed.join(", ")}. Re-run with --allow-unpublish if intended.`;
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
    throw new Error("guard or tests failed, nothing committed");
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

  console.log(`${result.slugs.length} sessions, ${result.drills?.length ?? 0} drill pages`);
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
    if (!guard.ok) return false;
    // The tests check the new content too (e.g. the Overview's session count); a red run stops the release
    // before anything is committed (data architecture review 2026-11-07).
    const tests = spawnSync("npm", ["test", "--silent"], { cwd: repoRoot, stdio: "inherit" });
    if (tests.status !== 0) console.error("tests failed: fix them, then run publish:site again");
    return tests.status === 0;
  };
  try {
    const slugOf = (f: string) => f.replace(/^.*\//, "").replace(/\.json$/, "");
    const isDrill = (f: string) => f.includes("/drills/");
    const note = [
      result.written.filter((f) => !isDrill(f)).length ? `Sessions published or updated: ${result.written.filter((f) => !isDrill(f)).map(slugOf).join(", ")}.` : "",
      result.written.filter(isDrill).length ? `Drill pages published or updated: ${result.written.filter(isDrill).map(slugOf).join(", ")}.` : "",
      result.removed.length ? `Taken offline: ${result.removed.map(slugOf).join(", ")}.` : "",
    ].filter(Boolean).join(" ") || "Content updated.";
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
