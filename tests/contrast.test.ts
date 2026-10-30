import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every text/background pair the site uses. Text must reach 7:1 in direct sun.
const PAIRS: [text: string, background: string][] = [
  ["ink", "paper"],
  ["ink", "card"],
  ["ink-soft", "card"],
  ["on-ink", "ink"],
  ["ink", "stage-1"],
  ["ink", "stage-2"],
  ["ink", "stage-3"],
  ["badge-ink", "badge"],
  ["ink", "go"],
];

function themeColors(css: string): Map<string, string> {
  const theme = css.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  return new Map([...theme.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast", () => {
  it("computes known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#2d241b", "#cccffa")).toBeCloseTo(10.1, 1);
  });

  const colors = themeColors(readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8"));
  for (const [text, bg] of PAIRS) {
    it(`text/background token pairs ≥ 7:1: ${text} on ${bg}`, () => {
      const t = colors.get(text);
      const b = colors.get(bg);
      expect(t, `--color-${text} missing in @theme`).toBeDefined();
      expect(b, `--color-${bg} missing in @theme`).toBeDefined();
      expect(contrast(t!, b!)).toBeGreaterThanOrEqual(7);
    });
  }
});
