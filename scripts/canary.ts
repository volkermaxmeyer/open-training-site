import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./publish";

export type FeedbackRow = { session: string; submittedAt: string };

// Tally's Sheet export: header row first, trailing empty cells are cut off.
export function parseFeedback(values: string[][]): FeedbackRow[] {
  const [header = [], ...rows] = values;
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`feedback sheet has no "${name}" column`);
    return i;
  };
  const s = col("session");
  const t = col("Submitted at");
  return rows
    .map((r) => ({ session: (r[s] ?? "").trim(), submittedAt: r[t] ?? "" }))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export async function readFeedback(sheetId: string): Promise<FeedbackRow[]> {
  const out = execFileSync(
    "gws",
    ["sheets", "spreadsheets", "values", "get", "--params", JSON.stringify({ spreadsheetId: sheetId, range: "A:Z" })],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return parseFeedback(JSON.parse(out.slice(out.indexOf("{"))).values ?? []);
}

export function checkCanary(rows: FeedbackRow[], publishedSlugs: string[]): string[] {
  const known = new Set(publishedSlugs);
  const problems: string[] = [];
  for (const r of rows) {
    if (!r.session) problems.push(`row submitted ${r.submittedAt} has no session`);
    else if (!known.has(r.session)) problems.push(`row submitted ${r.submittedAt} has unknown session "${r.session}"`);
  }
  const seen = new Set(rows.map((r) => r.session));
  for (const slug of publishedSlugs) {
    if (!seen.has(slug)) problems.push(`no feedback row for published session "${slug}"`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  loadEnv(repoRoot);
  const sheetId = process.env.FEEDBACK_SHEET_ID;
  if (!sheetId) {
    console.error("FEEDBACK_SHEET_ID is not set (put it in .env.local)");
    process.exit(1);
  }
  const dir = join(repoRoot, "src/content/sessions");
  const slugs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) : [];
  readFeedback(sheetId).then((rows) => {
    const problems = checkCanary(rows, slugs);
    console.log(`${rows.length} row(s), ${slugs.length} published session(s)`);
    for (const p of problems) console.log(`- ${p}`);
    console.log(problems.length ? `${problems.length} problem(s)` : "canary ok");
    process.exit(problems.length ? 1 : 0);
  });
}
