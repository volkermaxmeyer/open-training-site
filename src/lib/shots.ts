// The Shots area (2026-11-07): one tile per hero shot, in this order. The values are the vault's `enums.shot`
// (system/datenmodell.md) without `none`, in the same order; publish.ts stops when the two drift apart.
// 2026-11-13: Footwork is no shot, Counter & block is part of Volley, Special shot is a tile of its own.

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
  "Lob",
  "Overhead",
  "Special shot",
] as const;

export type Shot = (typeof SHOTS)[number];

/** What players read for a shot: the vault value, except "Special shot", which the tile names in the plural (Volker 2026-11-13). */
export function shotLabel(shot: string): string {
  return shot === "Special shot" ? "Special shots" : shot;
}

/**
 * One sentence on a shot page above the drill list (wording pass 1.040, Volker 2026-11-12). Serve and Return have none
 * since 2026-11-13: they explained basics a player around 4.0 knows.
 */
export const SHOT_EXPLAINERS: Partial<Record<Shot, string>> = {
  Drive: "A hard, low shot from the back of the court that puts the opponents under pressure.",
  Drop: "A soft shot from the back of the court that lands in the opponents' kitchen, so you can move up to the net.",
  Drip: "Half drive, half drop: a shorter, slower drive that lands low at the feet of a player still moving in.",
  Dink: "A soft shot from the kitchen line into the opponents' kitchen, kept low so they can't attack it.",
  Volley: "Any ball you hit out of the air before it bounces.",
  Reset: "A soft shot that takes the pace off a hard ball and drops it into the kitchen, so you stop defending.",
  "Speed-up": "A planned switch from soft to fast that starts your attack or forces a weak reply.",
  Lob: "A high shot over the opponents at the net that lands deep behind them, and how to chase one down.",
  Overhead: "A hard shot hit from above your head to put away a lob or a high ball, also called a smash.",
  "Special shot": "Shots for one special moment: around the post, over the kitchen, behind your partner.",
};

/** URL part of a shot, from its label: "Special shot" -> "special-shots", "Speed-up" -> "speed-up", "A & B" -> "a-and-b". */
export function shotSlug(shot: string): string {
  return shotLabel(shot)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
