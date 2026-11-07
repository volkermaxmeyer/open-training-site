import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "ots-dist-"));
const html = (p: string) => readFileSync(join(out, p), "utf8");
/** Visible text of an HTML snippet: icons and tags dropped, whitespace collapsed. */
const text = (h: string) => h.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const chip = (h: string, attr: string) => [...h.matchAll(new RegExp(`<span[^>]*${attr}[^>]*>[\\s\\S]*?</span>`, "g"))].map((m) => text(m[0]));

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
    expect(index).toContain("Hit soft balls");
    expect(index).toContain("Lob better");
    expect(index).toContain('href="/s/warm-hands/"');
    // second line = chips: duration, who the session fits, and which drill needs more (design critique 2026-11-04)
    expect(index).not.toContain("data-chip-minutes"); // every session is 30 min, so the chip said nothing (2026-11-04)
    expect(chip(index, "data-chip-base")).toContain("Wall");
    expect(chip(index, "data-chip-extra")).toEqual(expect.arrayContaining(["Drill 2 needs 2", "Drill 3 needs 4"]));
  });

  it("session page has 3 stage cards and 3 watch links", () => {
    const page = html("s/warm-hands/index.html");
    expect(page.match(/data-stage-card/g)).toHaveLength(3);
    // exactly one YouTube link per card: the black button, or the tap-to-play area (a link without JavaScript)
    const watch = page.match(/<a[^>]+href="https:\/\/youtu\.be\/[^"]+"[^>]*>/g) ?? [];
    expect(watch).toHaveLength(3);
    for (const a of watch) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener"');
    }
  });

  it("no \"New — tell us how it went\" badge anywhere (Volker 2026-11-04)", () => {
    expect(html("s/warm-hands/index.html")).not.toContain("New — tell us how it went");
    expect(html("s/warm-hands/index.html")).not.toContain("data-session-badge");
  });

  it("feedback link carries ?session=<slug>", () => {
    expect(html("s/warm-hands/index.html")).toMatch(/href="[^"]*\?session=warm-hands" target="_blank" rel="noopener"/);
  });

  it("index asks the goal question with one button per goal, in goal order", () => {
    const index = html("index.html");
    expect(index).toContain("What do you want to get better at today?");
    const goals = [...index.matchAll(/data-goal="([^"]+)"/g)].map((m) => m[1]);
    expect(goals).toEqual(["fixture-goal", "other-goal"]);
    expect(index).toContain("Hit soft balls");
    expect(index).toContain("Lob better");
  });

  it("stage card: watch first, one visible sentence, two collapsed sections", () => {
    const cards = html("s/warm-hands/index.html").match(/<section[^>]*data-stage-card[\s\S]*?<\/section>/g)!;
    expect(cards).toHaveLength(3);
    cards.forEach((c, i) => {
      expect(c.match(/<details/g)).toHaveLength(2);
      expect(c).not.toMatch(/<details[^>]*\sopen/);
      expect(c.indexOf("data-watch")).toBeLessThan(c.indexOf("<details"));
      expect(c).toContain(`Short line for stage ${i + 1}.`);
      expect(c.indexOf("data-in-short")).toBeLessThan(c.indexOf("<details"));
    });
  });

  it("players badge on every stage, summary on top, pair hint only on 4-player stages", () => {
    const page = html("s/warm-hands/index.html");
    const cards = page.match(/<section[^>]*data-stage-card[\s\S]*?<\/section>/g)!;
    expect(cards.map((c) => chip(c, "data-players-badge")[0])).toEqual(["Wall", "Needs 2 players", "Needs 4 players"]);
    expect(cards.map((c) => c.includes("data-pair-hint"))).toEqual([false, false, true]);
    // authored per 4-player stage, not borrowed from Drill 2's "Too easy" (critique round 2)
    expect(cards[2]).toMatch(/data-pair-hint[\s\S]*?Only two of you\?<\/span>\s*<span[^>]*>Play stage 2 again with a target\.</);
    expect(cards[2]).not.toContain("Add a target.</p>");
    expect(cards.map((c) => chip(c, "data-minutes")[0])).toEqual(["10 min", "10 min", "10 min"]);
    // same wording as the start page, so both chips fit one row (layout pass 2026-11-04)
    expect(chip(page, "data-players-summary")[0]).toBe("Wall · Drill 2 needs 2 · Drill 3 needs 4");
  });

  it("four-on-court warning appears exactly once per session page, before the first stage", () => {
    for (const s of ["warm-hands", "steady-lobs"]) {
      const page = html(`s/${s}/index.html`);
      expect(page.match(/data-four-on-court/g)).toHaveLength(1);
      expect(page.indexOf("data-four-on-court")).toBeLessThan(page.indexOf("data-stage-card"));
      expect(page).toContain("Never two balls with pace.");
    }
  });

  it("jump tabs are a fixed colour index, the rule line is short, the watch label has no handle-style @", () => {
    const page = html("s/warm-hands/index.html");
    const tabs = page.match(/<a[^>]*href="#stage-\d"[^>]*>/g)!;
    expect(tabs.map((t) => t.match(/background: var\(--color-(stage-\d)\)/)![1])).toEqual(["stage-1", "stage-2", "stage-3"]);
    expect(page).not.toContain("jump-tab");
    expect(page).toMatch(/data-four-on-court[^>]*>\s*Four of you\?\s*<strong>Never two balls with pace\.<\/strong>/);
    expect(page).not.toMatch(/data-watch[\s\S]{0,600}@\d/);
    expect(page).toContain('<span aria-hidden="true">\u25B6\uFE0E</span> Watch the drill');
    expect(page).toMatch(/<link rel="preload" href="[^"]+\.woff2" as="font" type="font\/woff2" crossorigin/);
  });

  it("next box only when next is set, after the feedback button", () => {
    const page = html("s/warm-hands/index.html");
    expect(page).toMatch(/data-next[^>]*href="\/s\/steady-lobs\/"/);
    expect(page.indexOf("data-next")).toBeGreaterThan(page.indexOf("?session=warm-hands"));
    expect(html("s/steady-lobs/index.html")).not.toContain("data-next");
    expect(page).toContain('href="/" data-back');
    // aim only in the link preview, not on the page (Volker 2026-11-04)
    expect(page).toContain('<meta name="description" content="Keep a soft rally going for ten shots in a row.">');
    expect(page.replace(/<head>[\s\S]*<\/head>/, "")).not.toContain("Keep a soft rally going");
    for (const f of ["index.html", "s/warm-hands/index.html", "imprint/index.html"]) expect(html(f)).not.toContain("<header");
    for (const f of ["imprint/index.html", "privacy/index.html"]) expect(html(f)).toContain('href="/" data-back');
  });

  it("footer starts with About; the about page explains the project", () => {
    expect(html("index.html")).toMatch(/<footer[\s\S]*?href="\/about\/"[\s\S]*?href="\/imprint\/"[\s\S]*?href="\/privacy\/"/);
    const about = html("about/index.html");
    for (const t of ["more than 200 reviewed YouTube videos", "Made with AI, checked by a player", "non-commercial", "bring pickleball to the people"]) expect(about).toContain(t);
    expect(about).toContain('href="/" data-back');
  });

  it("imprint shows the site version", () => {
    expect(html("imprint/index.html")).toMatch(/data-version[^>]*>Version \d+\.\d{3}</);
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

  it("session pages carry exactly three inline scripts: own-visit opt-out, analytics and the video player", () => {
    // Deliberately widened 2026-11-04 (video in the card): one inline video script, no <script src>, and the only
    // host it may load is youtube-nocookie.com/embed, and only after a tap. 2026-11-05: plus the opt-out check.
    for (const s of ["warm-hands", "steady-lobs"]) {
      const page = html(`s/${s}/index.html`);
      const scripts = page.match(/<script[\s\S]*?<\/script>/gi) ?? [];
      expect(scripts).toHaveLength(3);
      expect(page).not.toMatch(/<script[^>]*\ssrc=/);
      expect(scripts.filter((x) => x.includes("@vercel/analytics"))).toHaveLength(1);
      const optOut = scripts.filter((x) => x.includes("va-disable"));
      expect(optOut).toHaveLength(1);
      expect(optOut[0]).not.toMatch(/https?:\/\//);
      const video = scripts.find((x) => !x.includes("@vercel/analytics") && !x.includes("va-disable"))!;
      const hosts = [...video.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((m) => m[0]);
      expect(hosts.length).toBeGreaterThan(0);
      expect(new Set(hosts)).toEqual(new Set(["https://www.youtube-nocookie.com"]));
      expect(page).not.toContain("<iframe");
    }
  });

  it("a drill with an end time gets the edge-to-edge tap-to-play area; others keep the button", () => {
    const cards = html("s/warm-hands/index.html").match(/<section[^>]*data-stage-card[\s\S]*?<\/section>/g)!;
    expect(cards[0]).toMatch(/data-video[^>]*data-id="AAAAAAA1111"[^>]*data-start="10"[^>]*data-end="70"/);
    expect(cards[0]).toMatch(/<a data-video[^>]*role="button"[^>]*href="https:\/\/youtu\.be\/AAAAAAA1111\?t=10"/);
    expect(cards[0]).toContain("0:10–1:10 · about 1 min");
    expect(cards[0]).not.toContain("or open it on YouTube"); // removed 2026-11-04 (Volker)
    // Edge to edge on the phone; the lg: classes after it only apply from 1024 px (wide layout, 2026-11-07).
    expect(cards[0]).toMatch(/<div data-player class="-mx-4 -mt-4(?: lg:[^"]*)?">/);
    expect(cards[1]).not.toContain("data-video");
    expect(cards[1]).toContain("Watch the drill");
  });

  it("footer shows no version to players; check-deploy reads version.txt instead", () => {
    expect(html("index.html")).not.toMatch(/<footer[\s\S]*?>v [^<]*<\/span>[\s\S]*?<\/footer>/);
    expect(html("index.html")).not.toContain(">v local<");
  });

  it("finish moment sits once before the feedback button; the favicon is the pickleball", () => {
    const page = html("s/warm-hands/index.html");
    expect(page.match(/data-finish/g)).toHaveLength(1);
    expect(page.indexOf("data-finish")).toBeLessThan(page.indexOf("?session=warm-hands"));
    expect(page).toMatch(/That's 30 minutes\.\s*<span[^>]*>Good rally, everyone\.<\/span>/);
    for (const icon of ["favicon.ico", "favicon.svg", "apple-touch-icon.png"]) expect(page).toContain(`href="/${icon}?v=2"`);
    const fav = readFileSync(join(out, "favicon.svg"), "utf8");
    expect(fav).toContain("#c5e17a");
    expect(fav).not.toContain("M50.4 78.5"); // the old Astro rocket
    expect(existsSync(join(out, "apple-touch-icon.png"))).toBe(true);
  });

  it("privacy page covers the YouTube links and tap-to-load", () => {
    expect(html("privacy/index.html")).toContain("a video from YouTube (Google)");
    expect(html("privacy/index.html")).toContain("Nothing is loaded from YouTube until you");
  });

  it("privacy page names legal bases, transfers and the operator", () => {
    const page = html("privacy/index.html");
    for (const s of ["Art. 6(1)(f) GDPR", "Art. 6(1)(a) GDPR", "Data Privacy Framework", "only the operator", "Please do not enter names"]) {
      expect(page).toContain(s);
    }
    expect(page).not.toContain("organisers");
  });

  it("every video button names YouTube before the tap", () => {
    const page = html("s/warm-hands/index.html");
    const buttons = page.match(/<a[^>]*data-(?:video|watch)[\s\S]*?<\/a>/g) ?? [];
    expect(buttons.length).toBe(3);
    for (const b of buttons) expect(b).toMatch(/· YouTube<|on YouTube</);
  });

  it("own visits: the opt-out check runs before the analytics loader on every page; /not-me/ is hidden", () => {
    for (const p of ["index.html", "about/index.html", "s/warm-hands/index.html"]) {
      const page = html(p);
      const opt = page.indexOf("webAnalyticsBeforeSend");
      expect(opt, p).toBeGreaterThan(-1);
      expect(opt, p).toBeLessThan(page.indexOf("@vercel/analytics"));
      expect(page).toContain('localStorage.getItem("va-disable")');
    }
    const notMe = html("not-me/index.html");
    expect(notMe).toContain('<meta name="robots" content="noindex"');
    expect(notMe).toContain("data-toggle");
    for (const f of walk(out).filter((p) => p.endsWith(".html") && !p.includes("not-me"))) {
      expect(readFileSync(f, "utf8"), f).not.toContain("/not-me/");
    }
  });

  it("version.txt exists", () => {
    expect(existsSync(join(out, "version.txt"))).toBe(true);
    expect(html("version.txt").trim().length).toBeGreaterThan(0);
  });
});
