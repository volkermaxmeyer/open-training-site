// Lookups over the published sessions that must not assume "one session per goal" or "one session per drill"
// (data architecture review 2026-11-07: both broke silently once a goal or a drill had a second session).

type SessionLike = { slug: string; title: string; goal?: { id: string; label: string }; stages: { drill: { id: string } }[] };

export type SessionStage = { slug: string; title: string; stage: number };

/** Every session stage a drill appears in, keyed by drill number, in the order the sessions are given. */
export function sessionsByDrill(sessions: SessionLike[]): Map<number, SessionStage[]> {
  const by = new Map<number, SessionStage[]>();
  for (const s of sessions) {
    s.stages.forEach((st, i) => {
      const n = Number(st.drill.id);
      const list = by.get(n) ?? [];
      list.push({ slug: s.slug, title: s.title, stage: i + 1 });
      by.set(n, list);
    });
  }
  return by;
}

/** The sessions that contain any of these drill numbers, once per session, with the numbers each one contains. */
export function sessionsOfDrills(by: Map<number, SessionStage[]>, ns: string[]): { slug: string; title: string; ns: string[] }[] {
  const out = new Map<string, { slug: string; title: string; ns: string[] }>();
  for (const n of ns) {
    for (const w of by.get(Number(n)) ?? []) {
      const entry = out.get(w.slug) ?? { slug: w.slug, title: w.title, ns: [] };
      entry.ns.push(n);
      out.set(w.slug, entry);
    }
  }
  return [...out.values()];
}

/**
 * Start page card text: the goal label as the title. When a goal has more than one session, each card also names its
 * session, so two cards for one goal never read the same.
 */
export function cardText(s: SessionLike, all: SessionLike[]): { title: string; session?: string } {
  if (!s.goal) return { title: s.title };
  const shared = all.filter((o) => o.goal?.id === s.goal!.id).length > 1;
  return shared ? { title: s.goal.label, session: s.title } : { title: s.goal.label };
}

/**
 * "Ready for points?" on a drill page (Shots area, 2026-11-07): the session the drill is a stage of (by goal order when
 * several), else the one session of the one goal that reaches the drill. Several goals or several sessions of that goal:
 * no pointer, rather than a guess (the vault reserves an override field for that case).
 */
export function sessionPointer(
  drillId: string,
  goals: string[],
  sessions: (SessionLike & { goal?: { id: string; label: string; order?: number } })[],
): { slug: string; title: string } | undefined {
  const order = (s: { goal?: { order?: number } }) => s.goal?.order ?? Number.MAX_SAFE_INTEGER;
  const holding = sessions.filter((s) => s.stages.some((st) => Number(st.drill.id) === Number(drillId))).sort((a, b) => order(a) - order(b));
  if (holding.length) return { slug: holding[0].slug, title: holding[0].title };
  if (goals.length !== 1) return undefined;
  const ofGoal = sessions.filter((s) => s.goal?.id === goals[0]);
  return ofGoal.length === 1 ? { slug: ofGoal[0].slug, title: ofGoal[0].title } : undefined;
}
