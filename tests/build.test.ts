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
    env: { ...process.env, SESSIONS_DIR: join(root, "tests/fixtures/sessions-json"), DRILLS_DIR: join(root, "tests/fixtures/drills-json"), TALLY_FORM_URL: "https://tally.so/r/test" },
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

describe("shots area (2026-11-07)", () => {
  it("start page has two tabs, Goals active", () => {
    const index = html("index.html");
    expect(index).toMatch(/data-tab="goals"[^>]*aria-current="page"/);
    expect(index).toMatch(/href="\/shots\/"[^>]*data-tab="shots"/);
    expect(index).not.toContain("data-shot-tile");
    expect(html("shots/index.html")).toMatch(/data-tab="shots"[^>]*aria-current="page"/);
    expect(text(index)).toContain("Pick a goal, get three drills, play 30 minutes. For Advanced (around 4.0+) Wall"); // the fixtures start with a wall
    expect(text(html("shots/index.html"))).toContain("Pick a shot and build it up from slow to full pace. For Advanced (around 4.0+) 2+ players");
    // target group (decision-log 2026-11-11): the level chip stands on start, shots and every session page
    expect(chip(index, "data-level")).toEqual(["Advanced (around 4.0+)"]);
    expect(chip(html("shots/index.html"), "data-level")).toEqual(["Advanced (around 4.0+)"]);
    for (const f of walk(join(out, "s")).filter((f) => f.endsWith("index.html"))) {
      const page = readFileSync(f, "utf8");
      expect(chip(page, "data-level"), f).toEqual(["Advanced (around 4.0+)"]);
      expect(page, f).toMatch(/<meta property="og:description" content="\d+ min · [^"]*Advanced \(around 4\.0\+\) · free, no login"/);
      expect(page, f).toMatch(/<meta property="og:url" content="https:\/\/open-training-site\.vercel\.app\/s\/[^"]+\/"/);
      expect(page, f).toMatch(/<meta property="og:title" content="[^"]+ \| Open Training"/);
    }
    expect(index).not.toContain("Good training, no coach</p>"); // the kicker went (Volker 2026-11-07, R2)
  });

  it("Shots tab shows a tile per shot, Coming soon when nothing is released", () => {
    const index = html("shots/index.html");
    expect(index.match(/data-shot-tile=/g)?.length ?? 0).toBe(2); // Dink (2 cards) and Lob (1)
    expect(index.match(/data-shot-soon=/g)?.length ?? 0).toBe(11);
    expect(index).toMatch(/data-shot-tile="dink" href="\/shots\/dink\/"/);
    expect(index).toMatch(/data-shot-tile="lob" href="\/drill\/903\/"/); // one drill: straight to it
    expect(index).not.toMatch(/<a[^>]*data-shot-soon/); // a Coming soon tile is no link
    expect(text(index)).toContain("Coming soon");
  });

  it("shot page lists its drills with the variant as a label", () => {
    const page = html("shots/dink/index.html");
    expect(page.match(/data-drill-link/g)).toHaveLength(2);
    expect(page).toContain('href="/drill/901/"');
    expect(chip(page, "data-variant")).toEqual(["Cross-court dink"]);
    expect(existsSync(join(out, "shots/lob/index.html"))).toBe(true);
    expect(existsSync(join(out, "shots/drive/index.html"))).toBe(false);
  });

  it("drill page shows the card and the session for points", () => {
    const page = html("drill/901/index.html");
    expect(page).toContain("data-drill-card");
    expect(text(page)).toContain("Tap It Soft");
    expect(page).toContain('data-id="AAAAAAA9011"'); // in-card player
    expect(page).toMatch(/data-session-pointer href="\/s\/warm-hands\/"/);
    expect(html("drill/902/index.html")).toMatch(/data-session-pointer href="\/s\/warm-hands\/"/); // a stage of a session wins over its goal
    const lob = html("drill/903/index.html");
    expect(lob).toContain("data-watch"); // no end time: plain link
    expect(lob).toMatch(/data-session-pointer href="\/s\/warm-hands\/"/);
    // Closing row (2026-11-07): finish line, a wish mail with a subject naming the drill, the session pointer.
    expect(page).toContain("data-closing");
    expect(page).toMatch(/data-wish href="mailto:[^"?]+\?subject=Shot%20or%20drill%20wish%20\(from%20drill%20901\)"/);
    expect(text(page)).toContain("Wish for a drill? Mail me");
    expect(page).toMatch(/data-wish-address[^>]*>or write to <span[^>]*>[^<]+@[^<]+<\/span>/); // for devices without a mail app
    expect(page).not.toContain("tally.so"); // no feedback form on drill pages
  });
});

describe("built site", () => {
  it("index lists every session", () => {
    const index = html("index.html");
    expect(index).toContain("Hit soft balls");
    expect(index).toContain("Lob better");
    expect(index).toContain('href="/s/warm-hands/"');
    // second line = chips: duration, who the session fits, and which drill needs more (design critique 2026-11-04)
    expect(index).not.toContain("data-chip-minutes"); // every session is 30 min, so the chip said nothing (2026-11-04)
    // both fixtures start with a wall, so that is said once above the list, not on each card (design critique 2026-11-07)
    expect(index).not.toContain("data-chip-base");
    expect(index).toMatch(/<span[^>]*data-shared-base[^>]*>[\s\S]*?Wall<\/span>/);
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
    expect(index).toContain("What do you want to improve?");
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

  const crumbText = (h: string) => text(h.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)![0]).replace(/\s*›\s*/g, " › ");
  it("session page names the home page goal above its title, as breadcrumbs (2026-11-07)", () => {
    const page = html("s/warm-hands/index.html");
    const crumbs = page.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)![0];
    expect(crumbs).toMatch(/href="\/"[^>]*>Goals<\/a>/);
    expect(crumbText(page)).toBe("Goals › Hit soft balls");
    expect(crumbs).toMatch(/aria-current="location"[^>]*>Hit soft balls/);
    expect(page.indexOf("data-breadcrumbs")).toBeLessThan(page.indexOf("<h1"));
    expect(page).not.toContain("data-back");
  });

  it("shot and drill pages show the way back as breadcrumbs", () => {
    expect(crumbText(html("shots/dink/index.html"))).toBe("Shots › Dink");
    const drill = html("drill/901/index.html").match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)![0];
    expect(crumbText(html("drill/901/index.html"))).toBe("Shots › Dink › Cross-court dink");
    expect(drill).toContain('href="/shots/dink/"');
    expect(crumbText(html("drill/902/index.html"))).toBe("Shots › Dink"); // no variant
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
    // Without an end time the link is drawn as large as the in-card player, so the card has no gap (2026-11-07).
    expect(page).toMatch(/<a[^>]*data-watch[^>]*class="[^"]*aspect-video[\s\S]*?Watch the drill/);
    expect(page).toMatch(/<link rel="preload" href="[^"]+\.woff2" as="font" type="font\/woff2" crossorigin/);
  });

  it("next box only when next is set, after the feedback button", () => {
    const page = html("s/warm-hands/index.html");
    expect(page).toMatch(/data-next[^>]*href="\/s\/steady-lobs\/"/);
    expect(page.indexOf("data-next")).toBeGreaterThan(page.indexOf("?session=warm-hands"));
    expect(html("s/steady-lobs/index.html")).not.toContain("data-next");
    // aim only in the link preview, not on the page (Volker 2026-11-04)
    expect(page).toContain('<meta name="description" content="Keep a soft rally going for ten shots in a row.">');
    expect(page.replace(/<head>[\s\S]*<\/head>/, "")).not.toContain("Keep a soft rally going");
    for (const f of ["index.html", "s/warm-hands/index.html", "imprint/index.html"]) expect(html(f)).not.toContain("<header");
    // footer pages: "Home › <page>" breadcrumbs instead of "← All goals", right for visitors from Goals and Shots (Volker 2026-11-08, variant 2)
    for (const [f, t] of [["imprint/index.html", "Imprint"], ["privacy/index.html", "Privacy"], ["about/index.html", "About"], ["overview/index.html", "Overview"], ["not-me/index.html", "Not me"]]) {
      expect(crumbText(html(f))).toBe(`Home › ${t}`);
      expect(html(f)).not.toContain("data-back");
      expect(html(f)).not.toContain("All goals");
    }
  });

  it("footer starts with About; the about page explains the project", () => {
    expect(html("index.html")).toMatch(/<footer[\s\S]*?href="\/about\/"[\s\S]*?href="\/imprint\/"[\s\S]*?href="\/privacy\/"/);
    const about = html("about/index.html");
    for (const t of ["more than 200 reviewed YouTube videos", "AI helped turn the videos into drills and sessions", "non-commercial", "bring pickleball to the people"]) expect(about).toContain(t);
    expect(about).toMatch(/href="\/"[^>]*>Home<\/a>/);
  });

  it("overview (2026-11-07): footer order, the About link, and the page rendered from its data at build time", () => {
    const D = JSON.parse(readFileSync(join(root, "src/data/overview.json"), "utf8"));
    // special shots dissolved, hybrid drive under Drip (Volker 2026-11-07, Overview refreshed 2026-11-08)
    expect(D.shots.map((s: { name: string }) => s.name)).not.toContain("Specialty shots");
    expect(D.matrix.rows).toEqual(D.shots.map((s: { name: string }) => s.name));
    const variantsOf = (n: string) => D.shots.find((s: { name: string }) => s.name === n).variants.map((v: { name: string }) => v.name);
    expect(variantsOf("Drip")).toContain("Hybrid drive");
    expect(variantsOf("Volley")).toEqual(expect.arrayContaining(["Erne", "Switcheroo"]));
    expect(variantsOf("Drive")).toContain("ATP (around the post)");
    expect(variantsOf("Lob")).toContain("Tweener");
    for (const f of ["index.html", "about/index.html", "overview/index.html", "s/warm-hands/index.html"]) {
      const footer = html(f).match(/<footer[\s\S]*?<\/footer>/)![0];
      expect([...footer.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(["/about/", "/overview/", "/imprint/", "/privacy/"]);
    }
    expect(html("about/index.html")).toMatch(/<a href="\/overview\/" data-overview-link[^>]*>See the Training System Overview →<\/a>/);
    const page = html("overview/index.html");
    // Tiles show the totals, rendered into the HTML (not by a script in the browser).
    for (const [label, n] of [["drills", D.totals.drills], ["cues", D.totals.tactical_cues], ["plans", D.totals.plays], ["combos", D.totals.combos], ["games", D.totals.games]]) {
      expect(page).toMatch(new RegExp(`data-tile="${label}"[^>]*><b[^>]*>${n}</b>`));
    }
    const asOf = new Date(D.as_of + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    expect(page).toMatch(new RegExp(`as of <span data-as-of[^>]*>${asOf}</span>`)); // the snapshot date is visible
    expect(page.match(/data-game[ >]/g)).toHaveLength(D.games.length);
    expect(page.match(/<article class="combo/g)).toHaveLength(D.combos.length);
    for (const id of ["shots", "when", "combos", "games"]) expect(page).toMatch(new RegExp(`<section[^>]*id="${id}"`));
    expect(page).not.toMatch(/id="(shots|when|combos|games)"[^>]*hidden/); // all panels visible without JavaScript
    expect(page).not.toContain("fonts.googleapis.com");
    expect(page).toMatch(/class="[^"]*lg:max-w-\[1120px\]/); // the shared wide frame
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

  it("session pages carry exactly four inline scripts: own-visit opt-out, analytics, speed insights and the video player", () => {
    // Deliberately widened 2026-11-04 (video in the card): one inline video script, no <script src>, and the only
    // host it may load is youtube-nocookie.com/embed, and only after a tap. 2026-11-05: plus the opt-out check.
    // 2026-11-09: plus the Speed Insights script.
    for (const s of ["warm-hands", "steady-lobs"]) {
      const page = html(`s/${s}/index.html`);
      const scripts = page.match(/<script[\s\S]*?<\/script>/gi) ?? [];
      expect(scripts).toHaveLength(4);
      expect(page).not.toMatch(/<script[^>]*\ssrc=/);
      expect(scripts.filter((x) => x.includes("@vercel/analytics"))).toHaveLength(1);
      expect(scripts.filter((x) => x.includes("@vercel/speed-insights"))).toHaveLength(1);
      const optOut = scripts.filter((x) => x.includes("va-disable"));
      expect(optOut).toHaveLength(1);
      expect(optOut[0]).not.toMatch(/https?:\/\//);
      const video = scripts.find((x) => !x.includes("@vercel/analytics") && !x.includes("@vercel/speed-insights") && !x.includes("va-disable"))!;
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

  it("wide layout (2026-11-07): the classes that carry the iPad/desktop layout are in place", () => {
    // Class list of the first element whose opening tag matches `tag` (e.g. "div data-player").
    const cls = (h: string, tag: string) => (h.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1] ?? "").split(" ");
    const page = html("s/warm-hands/index.html");
    const card = page.match(/<section[^>]*data-stage-card[\s\S]*?<\/section>/)![0];
    // Video left at 16:9 with its rules, text right.
    expect(cls(card, "div data-player")).toEqual(expect.arrayContaining(["lg:row-span-5", "lg:m-0", "lg:-mb-[2px]", "lg:border-r-2", "lg:border-b-2"]));
    expect(cls(card, "a data-video")).toContain("aspect-video");
    expect(cls(card, "a data-video").some((c) => c.startsWith("lg:"))).toBe(false);
    expect(cls(card, "div data-player").some((c) => /^lg:(min-h|self-stretch|bg-)/.test(c))).toBe(false); // no stretched dark box
    expect(card).toMatch(/class="[^"]*lg:grid lg:grid-cols-\[minmax\(0,11fr\)_minmax\(0,9fr\)\]/);
    expect(cls(card, "p data-in-short")).toContain("lg:col-start-2");
    expect([...card.matchAll(/<details class="([^"]*)"/g)].every((m) => m[1].includes("lg:col-start-2"))).toBe(true);
    // Replay is a bar inside the player box; on the phone it undoes the box's bleed.
    expect(page).toContain("box.append(replay)");
    expect(page).toMatch(/replay\.className = "mx-4 mt-4 [^"]*w-\[calc\(100%-2rem\)\][^"]*lg:m-0[^"]*lg:w-full[^"]*lg:border-t-2"/);
    // Closing row: 3 columns with a next session, 2 without.
    expect(cls(page, "div data-closing")).toEqual(expect.arrayContaining(["lg:grid", "lg:grid-cols-3"]));
    expect(cls(html("s/steady-lobs/index.html"), "div data-closing")).toEqual(expect.arrayContaining(["lg:grid", "lg:grid-cols-2"]));
    // Start page grid; every page shares the lg frame, text pages keep a 600 px measure.
    expect(html("index.html")).toMatch(/<ul class="[^"]*tablet:grid tablet:grid-cols-2[^"]*lg:grid-cols-3/);
    for (const f of ["index.html", "s/warm-hands/index.html", "about/index.html", "imprint/index.html"]) {
      expect(html(f)).toMatch(/class="[^"]*max-w-\[430px\][^"]*tablet:max-w-\[720px\] lg:max-w-\[1120px\] lg:px-8/);
    }
    expect(cls(html("about/index.html"), "main")).toContain("tablet:max-w-[600px]");
    expect(cls(html("index.html"), "main")).not.toContain("tablet:max-w-[600px]");
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
    for (const s of ["Art. 6(1)(f) GDPR", "Art. 6(1)(a) GDPR", "Data Privacy Framework", "only I, the operator", "Please do not enter names"]) {
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
