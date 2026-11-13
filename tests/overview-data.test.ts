import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Overview's data is a hand-kept snapshot, and since 2026-11-07 this file is its only copy. These checks catch a miscount or
// a private detail in a refresh; they compare the totals with the lists, never the data with itself.
const text = readFileSync(new URL("../src/data/overview.json", import.meta.url), "utf8");
const D = JSON.parse(text);

describe("overview data", () => {
  it("totals agree with the lists they count", () => {
    expect(D.totals.combos).toBe(D.combos.length);
    expect(D.totals.games).toBe(D.games.length);
    const sessions = readdirSync(new URL("../src/content/sessions/", import.meta.url)).filter((f) => f.endsWith(".json"));
    expect(D.totals.web_sessions).toBe(sessions.length);
    expect(D.games.filter((g: { tested: boolean }) => g.tested).length).toBeLessThanOrEqual(D.totals.tested);
  });

  it("counts each drill once (vault rule under-the-hood-counting-rule)", () => {
    type Row = { name: string; drills: number };
    const rows = [...D.shots, ...D.serve_return] as Row[];
    expect(rows.reduce((n, r) => n + r.drills, 0)).toBeLessThanOrEqual(D.totals.drills);
  });

  it("When tab (1.047): parts add up per phase, phases + full points = all drills, plans add up", () => {
    type Part = { name: string; drills: number; kind: string };
    type Phase = { name: string; drills: number; tested: number; plays: number; parts: Part[] };
    const W = D.when;
    expect(W.phases.map((p: Phase) => p.name)).toEqual(["Serve", "Return", "Third ball", "Fourth ball", "Transition", "At the kitchen"]);
    for (const p of W.phases as Phase[]) {
      expect(p.parts.reduce((n, x) => n + x.drills, 0), p.name).toBe(p.drills);
      expect(p.parts.every((x) => ["shot", "footwork"].includes(x.kind) && x.drills > 0), p.name).toBe(true);
      expect(p.tested).toBeLessThanOrEqual(p.drills);
    }
    expect(W.phases.reduce((n: number, p: Phase) => n + p.drills, 0) + W.whole_point_drills).toBe(D.totals.drills);
    expect(W.phases.reduce((n: number, p: Phase) => n + p.tested, 0) + W.whole_point_tested).toBe(D.totals.tested);
    expect(W.phases.reduce((n: number, p: Phase) => n + p.plays, 0) + W.between_points_plays).toBe(D.totals.plays);
    expect(D.matrix).toBeUndefined();
    expect(D.moments).toBeUndefined();
  });

  it("carries a date, and nothing private or external", () => {
    expect(D.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Vault markup, links and addresses: the repository is public. Local paths and account names are left to the push
    // guard (scripts/guard.ts), which checks them in every file, this one included.
    for (const bad of ["[[", "[added", "[UNVERIFIED]", "claude.ai", "@", "http://", "https://", "www."]) {
      expect(text.includes(bad), bad).toBe(false);
    }
  });
});
