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
    delete env.TALLY_FORM_URL;
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

  it("new badge only on status new drills", () => {
    expect(html("s/warm-hands/index.html").match(/New — tell us how it went/g)).toHaveLength(1);
    expect(html("s/steady-lobs/index.html")).not.toContain("New — tell us how it went");
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

  it("no <script> tags in session pages", () => {
    for (const s of ["warm-hands", "steady-lobs"]) {
      expect(html(`s/${s}/index.html`)).not.toMatch(/<script/i);
    }
  });

  it("version.txt exists", () => {
    expect(existsSync(join(out, "version.txt"))).toBe(true);
    expect(html("version.txt").trim().length).toBeGreaterThan(0);
  });
});
