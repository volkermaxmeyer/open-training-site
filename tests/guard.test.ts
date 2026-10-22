import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseSession } from "../scripts/lib/parse-session";
import { runGuard } from "../scripts/guard";

const root = join(__dirname, "fixtures/vault");
const drills = new Map<string, string>(
  readdirSync(join(root, "drills")).map((f) => [f.slice(0, -3), readFileSync(join(root, "drills", f), "utf8")]),
);
const validSession = parseSession(readFileSync(join(root, "sessions/web/fixture-session.md"), "utf8"), drills);
const SESSION_PATH = "src/content/sessions/x.json";

let dir: string;

function git(...args: string[]) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: dir, stdio: "pipe" });
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function put(path: string, content: string) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}

function setup(session: unknown = validSession, opts: { manifestHash?: string; manifest?: boolean } = {}) {
  const body = JSON.stringify(session, null, 2) + "\n";
  put(SESSION_PATH, body);
  if (opts.manifest !== false) {
    put("src/content/.manifest.json", JSON.stringify({ files: { [SESSION_PATH]: opts.manifestHash ?? sha(body) }, slugsEverPublished: ["x"] }));
  }
  put("README.md", "# Open Training Site\n");
  git("add", "-A");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "guard-"));
  git("init", "-q");
});

const rules = (r: ReturnType<typeof runGuard>) => r.findings.map((f) => f.rule);

describe("runGuard", () => {
  it("passes clean content", () => {
    setup();
    const r = runGuard(dir);
    expect(r.findings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails on file not in manifest", () => {
    setup();
    put("src/content/sessions/y.json", JSON.stringify(validSession));
    git("add", "-A");
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(r.findings).toContainEqual({ file: "src/content/sessions/y.json", line: 0, rule: "not-in-manifest" });
  });

  it("fails on hash mismatch", () => {
    setup(validSession, { manifestHash: "0".repeat(64) });
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(r.findings).toContainEqual({ file: SESSION_PATH, line: 0, rule: "hash-mismatch" });
  });

  it("fails on [[ in a session JSON", () => {
    setup({ ...validSession, aim: "see [[private-note]]" });
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(rules(r)).toContain("forbidden:[[");
    expect(r.findings.find((f) => f.rule === "forbidden:[[")!.line).toBeGreaterThan(0);
  });

  it("fails on claude.ai/artifact link", () => {
    setup({ ...validSession, aim: "https://claude.ai/artifact/abc" });
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(rules(r)).toContain("forbidden:claude.ai/artifact");
  });

  it("fails on extra JSON key", () => {
    setup({ ...validSession, secret: "x" });
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(rules(r)).toContain("session-schema");
  });

  it("fails on vault path in README", () => {
    setup();
    put("README.md", "cd ~/Library/CloudStorage/GoogleDrive-someone/Meine Ablage/_Obsidian-vault\n");
    git("add", "-A");
    const r = runGuard(dir);
    expect(r.ok).toBe(false);
    expect(rules(r)).toContain("forbidden:GoogleDrive-");
    expect(rules(r)).toContain("forbidden:Obsidian-vault");
  });

  it("fails on content without any manifest", () => {
    setup(validSession, { manifest: false });
    expect(rules(runGuard(dir))).toContain("manifest-missing");
  });

  it("is fine on a fresh repo with neither content nor manifest", () => {
    put("README.md", "# x\n");
    git("add", "-A");
    expect(runGuard(dir)).toEqual({ ok: true, findings: [] });
  });

  it("scans staged and untracked-but-staged files, not out-of-scope ones", () => {
    setup();
    put("scripts/x.ts", "const a = '[[x]]'");
    git("add", "-A");
    expect(runGuard(dir).ok).toBe(true);
  });
});
