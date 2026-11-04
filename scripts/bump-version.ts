import { execFileSync } from "node:child_process";
import { release } from "./lib/version";

// Run before committing a code change that will be pushed:
//   npm run version:bump -- "Feedback opens in a new tab."
const note = process.argv.slice(2).join(" ").trim();
if (!note) {
  console.error('say what changed, for the changelog: npm run version:bump -- "…"');
  process.exit(1);
}
const repoDir = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
execFileSync("git", ["fetch", "-q", "origin", "main"], { cwd: repoDir, stdio: "inherit" });
console.log(`version ${release(repoDir, note)}`);
