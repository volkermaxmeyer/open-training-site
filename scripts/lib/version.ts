import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The site version shown on the imprint: starts at 1.000 and goes up by 0.001 with every push to main.
// A different number is set by hand in src/version.json; the push guard only demands that it went up.
export const VERSION_FILE = "src/version.json";
export const CHANGELOG_FILE = "CHANGELOG.md";
export const FIRST_VERSION = "1.000";
const FORMAT = /^\d+\.\d{3}$/;

/** "1.004" -> 1004; null for anything that is not d.ddd. */
export function versionSteps(v: unknown): number | null {
  if (typeof v !== "string" || !FORMAT.test(v)) return null;
  const [major, minor] = v.split(".");
  return Number(major) * 1000 + Number(minor);
}

export function formatVersion(steps: number): string {
  return `${Math.floor(steps / 1000)}.${String(steps % 1000).padStart(3, "0")}`;
}

export function parseVersionFile(text: string): string | null {
  try {
    const v = JSON.parse(text).version;
    return versionSteps(v) === null ? null : v;
  } catch {
    return null;
  }
}

function remoteVersion(repoDir: string): string | null {
  try {
    const text = execFileSync("git", ["show", `origin/main:${VERSION_FILE}`], { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return parseVersionFile(text);
  } catch {
    return null;
  }
}

/** Live version + 1, unless the local file is already ahead (bumped by hand or by an unpushed commit). */
export function nextVersion(local: string | null, remote: string | null): string {
  if (remote === null) return local ?? FIRST_VERSION;
  const r = versionSteps(remote)!;
  if (local !== null && versionSteps(local)! > r) return local;
  return formatVersion(r + 1);
}

/** Writes the next version into src/version.json and returns it. */
export function bumpVersion(repoDir: string): string {
  const path = join(repoDir, VERSION_FILE);
  const local = existsSync(path) ? parseVersionFile(readFileSync(path, "utf8")) : null;
  const v = nextVersion(local, remoteVersion(repoDir));
  writeFileSync(path, JSON.stringify({ version: v }, null, 2) + "\n");
  return v;
}

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time

/** True when the changelog has a line for this version ("- 1.001 · …"). */
export function hasChangelogEntry(changelog: string, version: string): boolean {
  return changelog.split("\n").some((l) => l.startsWith(`- ${version} · `));
}

/** Puts "- <version> · <date> · <note>" above the newest entry; leaves the text alone if the version is there. */
export function addChangelogEntry(changelog: string, version: string, note: string, date = today()): string {
  if (hasChangelogEntry(changelog, version)) return changelog;
  const line = `- ${version} · ${date} · ${note.trim()}`;
  const lines = changelog.split("\n");
  const first = lines.findIndex((l) => l.startsWith("- "));
  if (first === -1) return changelog.replace(/\n*$/, "\n\n") + line + "\n";
  lines.splice(first, 0, line);
  return lines.join("\n");
}

/** Bumps the version and writes its changelog line. Returns the new version. */
export function release(repoDir: string, note: string): string {
  const v = bumpVersion(repoDir);
  const path = join(repoDir, CHANGELOG_FILE);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "# Changelog\n";
  writeFileSync(path, addChangelogEntry(text, v, note));
  return v;
}
