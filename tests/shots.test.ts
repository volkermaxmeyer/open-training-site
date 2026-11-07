import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PublishError } from "../scripts/lib/errors";
import { goalsOfDrill, parseCard } from "../scripts/lib/parse-card";
import { checkUnpublish, publish, readGoalFilters } from "../scripts/publish";
import { DrillPage } from "../src/lib/session-schema";
import { sessionPointer } from "../src/lib/sessions";
import { SHOTS, shotSlug } from "../src/lib/shots";

const CARD = `## Player card
**Title:** Tap It Soft
**In short:** A feeds, and B taps every ball back soft.
- A feeds calm balls.
- B taps ten in a row.
**Too easy:** A feeds faster.
**Too hard:** A feeds slower.
**Good looks like:** Soft, low taps.
`;

function drill(fm: string, card = CARD): string {
  return `---\ntype: drill\ntitle: "Wall Taps"\nplayers: "2"\nstatus: tested\n${fm}\n---\n\n# Wall Taps\n\n- **▶ Watch the drill:** Fake Channel @1:05–2:05 — https://youtu.be/AAAAAAA1111?t=65\n\n${card}\n## Practice Log\n`;
}
const RELEASED = 'competency: "Dink"\nshot: "Dink"\nisolation: true\nshot-variant: "Cross-court dink"\ncard-checked-by: "Volker, 2026-11-07"';
const GOALS = [
  { id: "dink-goal", filters: [{ field: "competency", value: "Dink" }] },
  { id: "theme-goal", filters: [{ field: "themes", value: "Split-Step" }] },
];

describe("parseCard", () => {
  it("reads a released card", () => {
    const c = parseCard(drill(RELEASED), "07-wall-taps", GOALS)!;
    expect(DrillPage.safeParse(c).success).toBe(true);
    expect(c).toMatchObject({ id: "07", cardTitle: "Tap It Soft", shot: "Dink", variant: "Cross-court dink", tested: true, goals: ["dink-goal"] });
    expect(c.rules).toEqual(["A feeds calm balls.", "B taps ten in a row."]);
    expect(c.drill).toMatchObject({ videoId: "AAAAAAA1111", start: 65, end: 125 });
  });

  it("keeps the padded number as the id", () => {
    expect(parseCard(drill(RELEASED), "00-wall-taps", GOALS)!.id).toBe("00");
  });

  it("ignores cards that are not released, not isolation or archived", () => {
    expect(parseCard(drill(RELEASED.replace(/\ncard-checked-by.*/, "")), "07-x", GOALS)).toBeNull();
    expect(parseCard(drill(RELEASED.replace("isolation: true", "isolation: false")), "07-x", GOALS)).toBeNull();
    expect(parseCard(drill(RELEASED.replace("isolation: true", 'isolation: "true"')), "07-x", GOALS)).toBeNull();
    expect(parseCard(drill(RELEASED).replace("status: tested", "status: archived"), "07-x", GOALS)).toBeNull();
  });

  it("stops the publish on a broken released card", () => {
    expect(() => parseCard(drill(RELEASED, CARD.replace("**Title:** Tap It Soft\n", "")), "07-x", GOALS)).toThrow(PublishError);
    expect(() => parseCard(drill(RELEASED, CARD.replace("**Too hard:**", "Too hard:")), "07-x", GOALS)).toThrow(/Too hard/);
    expect(() => parseCard(drill(RELEASED, ""), "07-x", GOALS)).toThrow(/Player card/);
    expect(() => parseCard(drill(RELEASED.replace('shot: "Dink"', 'shot: "none"')), "07-x", GOALS)).toThrow(/no tile/);
  });

  it("finds goals through list fields too", () => {
    expect(goalsOfDrill({ competency: "Reset", themes: ["Split-Step"] }, GOALS)).toEqual(["theme-goal"]);
  });
});

describe("shots helpers", () => {
  it("slugs every shot for its URL", () => {
    expect(shotSlug("Counter & block")).toBe("counter-and-block");
    expect(shotSlug("Speed-up")).toBe("speed-up");
    expect(new Set(SHOTS.map(shotSlug)).size).toBe(SHOTS.length);
  });

  it("points a drill at its own session, else at its one goal's session", () => {
    const s = (slug: string, goal: string, order: number, ids: string[]) => ({ slug, title: slug.toUpperCase(), goal: { id: goal, label: goal, order }, stages: ids.map((id) => ({ drill: { id } })) });
    const all = [s("later", "g2", 1, ["07"]), s("first", "g1", 0, ["07"]), s("solo", "g3", 2, ["01"])];
    expect(sessionPointer("7", [], all)).toEqual({ slug: "first", title: "FIRST" });
    expect(sessionPointer("09", ["g3"], all)).toEqual({ slug: "solo", title: "SOLO" });
    expect(sessionPointer("09", ["g3", "g1"], all)).toBeUndefined();
    expect(sessionPointer("09", ["none"], all)).toBeUndefined();
  });
});

describe("publish with player cards", () => {
  const fixture = join(__dirname, "fixtures/vault");

  it("writes one tracked file per released card and refuses to drop it silently", async () => {
    const vault = mkdtempSync(join(tmpdir(), "vault-"));
    cpSync(fixture, vault, { recursive: true });
    const f = join(vault, "drills/901-wall-taps.md");
    writeFileSync(f, drill(RELEASED));
    const root = mkdtempSync(join(tmpdir(), "pub-"));
    const outDir = join(root, "src/content");
    const r = await publish({ vaultDir: vault, outDir, repoRoot: root, dryRun: false });
    expect(r.drills).toEqual(["901"]);
    expect(r.written).toContain("src/content/drills/901.json");
    const m = JSON.parse(readFileSync(join(outDir, ".manifest.json"), "utf8"));
    expect(Object.keys(m.files)).toContain("src/content/drills/901.json");
    expect(m.drillsEverPublished).toEqual(["901"]);
    expect(DrillPage.safeParse(JSON.parse(readFileSync(join(outDir, "drills/901.json"), "utf8"))).success).toBe(true);

    writeFileSync(f, drill(RELEASED.replace(/\ncard-checked-by.*/, "")));
    const again = await publish({ vaultDir: vault, outDir, repoRoot: root, dryRun: true });
    expect(again.removed).toEqual(["src/content/drills/901.json"]);
    expect(checkUnpublish(again, false)).toMatch(/901\.json.*--allow-unpublish/s);
    expect(again.warnings.some((w) => w.includes("/drill/901/"))).toBe(true);
    expect(existsSync(join(outDir, "drills/901.json"))).toBe(true);
  });

  it("reads goal filters from the schema block", () => {
    expect(readGoalFilters(fixture).map((g) => g.id)).toEqual(["fixture-goal", "other-goal"]);
  });
});
