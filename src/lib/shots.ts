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

/** One sentence per shot, shown on its shot page above the drill list (wording pass 1.040, Volker 2026-11-12). */
export const SHOT_EXPLAINERS: Record<Shot, string> = {
  Serve: "The first shot of every rally, from behind the baseline into the box diagonally across.",
  Return: "The answer to the serve, hit deep so you have time to get to the kitchen.",
  Drive: "A hard, low shot from the back of the court that puts the opponents under pressure.",
  Drop: "A soft shot from the back of the court that lands in the opponents' kitchen, so you can move up to the net.",
  Drip: "Half drive, half drop: a shorter, slower drive that lands low at the feet of a player still moving in.",
  Dink: "A soft shot from the kitchen line into the opponents' kitchen, kept low so they can't attack it.",
  Volley: "Any ball you hit out of the air before it bounces.",
  Reset: "A soft shot that takes the pace off a hard ball and drops it into the kitchen, so you stop defending.",
  "Speed-up": "A planned switch from soft to fast that starts your attack or forces a weak reply.",
  "Counter & block": "Your answer to a fast ball at you: block it soft into the kitchen, or counter it back hard.",
  Lob: "A high shot over the opponents at the net that lands deep behind them, and how to chase one down.",
  Overhead: "A hard shot hit from above your head to put away a lob or a high ball, also called a smash.",
  Footwork: "Not a shot but the steps around it: split-step, sliding sideways and turning, so you're ready for the next ball.",
};

/** URL part of a shot: "Counter & block" -> "counter-and-block", "Speed-up" -> "speed-up". */
export function shotSlug(shot: string): string {
  return shot
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
