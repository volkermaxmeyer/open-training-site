import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseSession } from "../scripts/lib/parse-session";
import { runGuard, runGuardOnPush } from "../scripts/guard";

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
    expect(rules(r)).toContain("identity:googledrive-");
    expect(rules(r)).toContain("identity:obsidian-vault");
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

describe("identity patterns", () => {
  const withReadme = (text: string) => {
    setup();
    put("README.md", text);
    git("add", "-A");
    return rules(runGuard(dir));
  };

  it("fails on /Users/ path in astro.config.mjs", () => {
    setup();
    put("astro.config.mjs", "export default { root: '/Users/someone/x' };\n");
    git("add", "-A");
    const r = runGuard(dir);
    expect(r.findings).toContainEqual({ file: "astro.config.mjs", line: 1, rule: "identity:/users/" });
  });

  it("fails on uppercase GMAIL", () => {
    expect(withReadme("mail X@GMAIL.COM\n")).toContain("identity:@gmail.com");
  });

  it("fails on percent-encoded path", () => {
    expect(withReadme("see %2FUsers%2Fx\n")).toContain("identity:%2fusers%2f");
  });

  it("fails on encoded gmail forms", () => {
    expect(withReadme("x%40gmail.com\n")).toContain("identity:%40gmail.com");
    expect(withReadme("x&#64;gmail.com\n")).toContain("identity:&#64;gmail.com");
  });

  it("allows the public contact address in all forms", () => {
    expect(withReadme("Contact: Pickleballinberlin@gmail.com\n")).toEqual([]);
    expect(withReadme("mailto:pickleballinberlin%40gmail.com and pickleballinberlin&#64;gmail.com\n")).toEqual([]);
  });

  it("still fails on other gmail addresses next to or containing the public one", () => {
    expect(withReadme("pickleballinberlin@gmail.com, someone@gmail.com\n")).toContain("identity:@gmail.com");
    expect(withReadme("xpickleballinberlin@gmail.com\n")).toContain("identity:@gmail.com");
  });

  it("fails on VAULT_DIR from .env.local without printing it", () => {
    setup();
    put(".env.local", 'VAULT_DIR="/secret/place/zz"\n');
    put("notes.txt", "path /Secret/Place/ZZ here\n");
    git("add", "notes.txt");
    const r = runGuard(dir);
    expect(r.findings).toContainEqual({ file: "notes.txt", line: 1, rule: "identity:vault-dir" });
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("exempts only scripts/guard.ts and tests/guard.test.ts from identity patterns", () => {
    setup();
    put("scripts/guard.ts", "'@gmail.com'\n");
    put("tests/guard.test.ts", "'@gmail.com'\n");
    put("scripts/other.ts", "'@gmail.com'\n");
    git("add", "-A");
    expect(runGuard(dir).findings.map((f) => f.file)).toEqual(["scripts/other.ts"]);
  });

  it("does not apply markup patterns outside src/public/README", () => {
    setup();
    put("tests/fx.md", "[[wikilink]]\n");
    git("add", "-A");
    expect(runGuard(dir).ok).toBe(true);
  });
});

describe("runGuardOnPush", () => {
  const ZERO = "0".repeat(40);
  const head = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  const commit = (msg: string) => git("commit", "-q", "-m", msg);
  const line = (local: string, remote = ZERO) => `refs/heads/main ${local} refs/heads/main ${remote}\n`;

  beforeEach(() => {
    git("checkout", "-q", "-b", "main");
  });

  it("fails when a leak was committed then deleted before push", () => {
    setup();
    commit("base");
    put("public/leak.txt", "mail me at someone@gmail.com\n");
    git("add", "-A");
    commit("add leak");
    git("rm", "-q", "public/leak.txt");
    commit("remove leak");
    expect(runGuard(dir).ok).toBe(true);
    const r = runGuardOnPush(dir, line(head()));
    expect(r.ok).toBe(false);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].rule).toBe("identity:@gmail.com");
    expect(r.findings[0].file).toMatch(/^[0-9a-f]{7,}:public\/leak\.txt$/);
  });

  it("passes clean pushed history", () => {
    setup();
    commit("base");
    expect(runGuardOnPush(dir, line(head()))).toEqual({ ok: true, findings: [] });
  });

  it("ignores content the remote already has, still flags new leaks", () => {
    put("public/old.txt", "x@gmail.com\n");
    git("add", "-A");
    commit("old leak, already remote");
    const remoteSha = head();
    setup();
    commit("clean new");
    expect(runGuardOnPush(dir, line(head(), remoteSha)).findings).toEqual([]);
    put("public/new.txt", "y@gmail.com\n");
    git("add", "-A");
    commit("new leak");
    const r = runGuardOnPush(dir, line(head(), remoteSha));
    expect(r.findings.map((f) => f.file.split(":")[1])).toEqual(["public/new.txt"]);
  });

  it("checks manifest against pushed tip, not disk", () => {
    setup();
    commit("base");
    const tip = head();
    put(SESSION_PATH, JSON.stringify({ ...validSession, title: "changed on disk" }));
    const r = runGuardOnPush(dir, line(tip));
    expect(r.ok).toBe(true);
    // and the other way: tip is bad, disk is good
    setup(validSession, { manifestHash: "0".repeat(64) });
    commit("bad manifest");
    const bad = head();
    setup();
    const r2 = runGuardOnPush(dir, line(bad));
    expect(r2.findings).toContainEqual({ file: SESSION_PATH, line: 0, rule: "hash-mismatch" });
  });

  it("demands a higher version on every push to main once main has one", () => {
    setup();
    put("src/version.json", '{ "version": "1.000" }\n');
    git("add", "-A");
    commit("base");
    const remoteSha = head();
    put("public/x.txt", "x\n");
    git("add", "-A");
    commit("change without bump");
    expect(rules(runGuardOnPush(dir, line(head(), remoteSha)))).toContain("version-not-bumped:1.000");
    put("src/version.json", '{ "version": "1.001" }\n');
    git("add", "-A");
    commit("bump");
    expect(runGuardOnPush(dir, line(head(), remoteSha)).ok).toBe(true);
    expect(runGuardOnPush(dir, `refs/heads/x ${head()} refs/heads/side ${remoteSha}\n`).ok).toBe(true);
  });

  it("ignores deletes", () => {
    setup();
    commit("base");
    expect(runGuardOnPush(dir, line(ZERO, head())).ok).toBe(true);
  });
});
