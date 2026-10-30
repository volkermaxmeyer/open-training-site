import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("DESIGN.md", () => {
  const theme = read("src/styles/global.css").match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const declared = new Set([...theme.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const named = new Set([...read("DESIGN.md").matchAll(/`(--[a-z0-9-]+)`/g)].map((m) => m[1]));

  it("names at least the colour tokens", () => {
    expect(named.size).toBeGreaterThan(5);
  });

  for (const token of named) {
    it(`names only tokens that exist in @theme: ${token}`, () => {
      expect(declared.has(token)).toBe(true);
    });
  }

  it("names every colour token declared in @theme", () => {
    const colours = [...declared].filter((t) => t.startsWith("--color-"));
    expect(colours.filter((t) => !named.has(t))).toEqual([]);
  });
});
