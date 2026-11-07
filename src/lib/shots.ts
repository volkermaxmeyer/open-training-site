// The Shots area (2026-11-07): one tile per hero shot, in this order. The values are the vault's `enums.shot`
// (system/datenmodell.md) without `none`; publish.ts warns when the two drift apart.

export const SHOTS = [
  "Serve",
  "Return",
  "Drive",
  "Drop",
  "Drip",
  "Dink",
  "Volley",
  "Reset",
  "Speed-up",
  "Counter & block",
  "Lob",
  "Overhead",
  "Footwork",
] as const;

export type Shot = (typeof SHOTS)[number];

/** URL part of a shot: "Counter & block" -> "counter-and-block", "Speed-up" -> "speed-up". */
export function shotSlug(shot: string): string {
  return shot
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
