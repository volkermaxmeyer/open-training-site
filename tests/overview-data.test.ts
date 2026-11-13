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

  it("the matrix has one row of cells per shot and one cell per moment", () => {
    expect(D.matrix.cells).toHaveLength(D.matrix.rows.length);
    for (const row of D.matrix.cells) expect(row).toHaveLength(D.matrix.cols.length);
    expect(D.matrix.cells.flat().every((n: unknown) => Number.isInteger(n) && (n as number) >= 0)).toBe(true);
  });

  it("counts each drill once (1.046, vault rule under-the-hood-counting-rule)", () => {
    type Row = { name: string; drills: number };
    const rows = [...D.shots, ...D.serve_return] as Row[];
    expect(rows.reduce((n, r) => n + r.drills, 0)).toBeLessThanOrEqual(D.totals.drills);
    expect(D.moments.reduce((n: number, m: Row) => n + m.drills, 0)).toBe(D.totals.drills);
    D.matrix.rows.forEach((name: string, i: number) => {
      const row = (D.shots as Row[]).find((s) => s.name === name);
      expect(row, name).toBeDefined();
      expect(D.matrix.cells[i].reduce((n: number, c: number) => n + c, 0)).toBeLessThanOrEqual(row!.drills);
    });
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
