export const site = {
  name: "Open Training",
  tallyFormUrl: process.env.TALLY_FORM_URL ?? "https://tally.so/r/rD5DBL",
  contactEmail: "pickleballinberlin@gmail.com",
  imprint: {
    name: "Volker Max Meyer",
    address: ["c/o BTV Olympia e.V., Abt. Pickleball", "Paul-Heyse-Str. 25", "10407 Berlin, Germany"],
  },
  goalQuestion: "What do you want to improve?",
  /** Who Open Training is for (decision-log 2026-11-11): one wording for the level chip and the link preview. */
  level: "Advanced (around 4.0+)",
  fourOnCourt: {
    text: "Four on one court?",
    rule: "Only one ball may be hit hard at a time.",
  },
  pairHint: "Only two of you?",
} as const;

export function playersLabel(players: "2" | "3" | "4" | "Wall"): string {
  return players === "Wall" ? "Wall" : `${players} players`;
}

/**
 * Start page chips: the minimum ("2+ players" / "Wall") and one entry per drill that needs something else.
 * The start page says "Drill 3 needs 4 players" (1.040); the one-line form keeps "needs 4" so it still fits beside
 * "30 min" in the session head at 360 px (Volker 2026-11-12).
 */
export function playersFitParts(players: ("2" | "3" | "4" | "Wall")[], short = false): { base: string; extras: string[] } {
  const base = players[0];
  const extras = players
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ p }) => p !== base)
    .map(({ p, n }) => `Drill ${n} needs ${p === "Wall" ? "a wall" : short ? p : `${p} players`}`);
  return { base: base === "Wall" ? "Wall" : `${base}+ players`, extras };
}

/** The same as one line: "2+ players", or "2+ players · Drill 3 needs 4". */
export function playersFit(players: ("2" | "3" | "4" | "Wall")[]): string {
  const { base, extras } = playersFitParts(players, true);
  return [base, ...extras].join(" · ");
}

/** Stage chip text: the plain count, or "Needs 4 players" when this drill asks for more than the first one. */
export function stagePlayersLabel(players: "2" | "3" | "4" | "Wall", base: "2" | "3" | "4" | "Wall"): string {
  if (players === base) return playersLabel(players);
  return players === "Wall" ? "Needs a wall" : `Needs ${players} players`;
}
