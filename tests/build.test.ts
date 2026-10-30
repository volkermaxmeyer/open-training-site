import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "ots-dist-"));
const html = (p: string) => readFileSync(join(out, p), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

beforeAll(() => {
  execFileSync("npx", ["astro", "build", "--outDir", out], {
    cwd: root,
    env: { ...process.env, SESSIONS_DIR: join(root, "tests/fixtures/sessions-json"), TALLY_FORM_URL: "https://tally.so/r/test" },
    stdio: "pipe",
  });
}, 180_000);

describe("placeholder guard", () => {
  it("build with sessions and placeholder tally URL fails", () => {
    const env = { ...process.env, SESSIONS_DIR: join(root, "tests/fixtures/sessions-json") };
    env.TALLY_FORM_URL = "TODO-tally-form-url";
    let err = "";
    try {
      execFileSync("npx", ["astro", "build", "--outDir", mkdtempSync(join(tmpdir(), "ots-fail-"))], { cwd: root, env, stdio: "pipe" });
    } catch (e) {
      const x = e as { stdout?: Buffer; stderr?: Buffer };
      err = `${x.stdout ?? ""}${x.stderr ?? ""}`;
    }
    expect(err).toContain("tallyFormUrl");
  }, 180_000);
});

describe("built site", () => {
  it("index lists every session", () => {
    const index = html("index.html");
    expect(index).toContain("Invented Warm Hands");
    expect(index).toContain("Invented Steady Lobs");
    expect(index).toContain('href="/s/warm-hands/"');
    expect(index).toContain("30 min");
  });

  it("session page has 3 stage cards and 3 watch links", () => {
    const page = html("s/warm-hands/index.html");
    expect(page.match(/data-stage-card/g)).toHaveLength(3);
    const watch = page.match(/<a[^>]+href="https:\/\/youtu\.be\/[^"]+"[^>]*>/g) ?? [];
    expect(watch).toHaveLength(3);
    for (const a of watch) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener"');
    }
  });

  it("drill badge only on status new drills", () => {
    expect(html("s/warm-hands/index.html").match(/data-stage-card[\s\S]*?<\/section>/g)!.filter((c) => c.includes("New — tell us how it went"))).toHaveLength(1);
    expect(html("s/steady-lobs/index.html")).not.toContain("New — tell us how it went");
  });

  it("session badge only when session is not tested", () => {
    const badge = /New — tell us how it went/g;
    // warm-hands: status v1 (badge) + 1 new drill; steady-lobs: status tested, no new drills
    expect(html("s/warm-hands/index.html").match(badge)).toHaveLength(2);
    expect(html("s/steady-lobs/index.html")).not.toMatch(badge);
    expect(html("s/warm-hands/index.html")).toMatch(/<h1[^>]*>[^<]*<\/h1>\s*<p[^>]*data-session-badge/);
    expect(html("s/steady-lobs/index.html")).not.toContain("data-session-badge");
  });

  it("feedback link carries ?session=<slug>", () => {
    expect(html("s/warm-hands/index.html")).toMatch(/href="[^"]*\?session=warm-hands"/);
  });

  it("imprint has robots noindex", () => {
    expect(html("imprint/index.html")).toContain('<meta name="robots" content="noindex">');
    expect(html("privacy/index.html")).not.toContain("noindex");
    expect(html("index.html")).not.toContain("noindex");
  });

  it("no external script/style/font hosts in dist", () => {
    const external = /(?:https?:)?\/\/[a-z0-9.-]+\./i;
    for (const f of walk(out).filter((p) => /\.(html|css|js)$/.test(p))) {
      const src = readFileSync(f, "utf8");
      const tags = [
        ...(src.match(/<script[^>]*src=["'][^"']+["']/gi) ?? []),
        ...(src.match(/<link[^>]*href=["'][^"']+["']/gi) ?? []),
        ...(src.match(/<img[^>]*src=["'][^"']+["']/gi) ?? []),
        ...(src.match(/<iframe/gi) ?? []),
        ...(src.match(/@import\s+[^;]+/gi) ?? []),
        ...(src.match(/url\([^)]*\)/gi) ?? []),
      ];
      for (const t of tags) expect(t, `${f}: ${t}`).not.toMatch(external);
      expect(tags.join("\n")).not.toContain("<iframe");
    }
  });

  it("session pages carry no script except the inline Vercel Analytics loader", () => {
    for (const s of ["warm-hands", "steady-lobs"]) {
      const scripts = html(`s/${s}/index.html`).match(/<script[\s\S]*?<\/script>/gi) ?? [];
      expect(scripts).toHaveLength(1);
      expect(scripts[0]).toMatch(/^<script type="module">/);
      expect(scripts[0]).toContain("@vercel/analytics");
    }
  });

  it("version.txt exists", () => {
    expect(existsSync(join(out, "version.txt"))).toBe(true);
    expect(html("version.txt").trim().length).toBeGreaterThan(0);
  });
});
