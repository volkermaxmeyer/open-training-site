import { execFileSync } from "node:child_process";
import { bumpVersion } from "./lib/version";

// Run before committing a code change that will be pushed: npm run version:bump
const repoDir = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
execFileSync("git", ["fetch", "-q", "origin", "main"], { cwd: repoDir, stdio: "inherit" });
console.log(`version ${bumpVersion(repoDir)}`);
