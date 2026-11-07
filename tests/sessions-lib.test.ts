import { describe, expect, it } from "vitest";
import { cardText, sessionsByDrill, sessionsOfDrills } from "../src/lib/sessions";

// The stress test of 2026-11-07: a second session for a goal that already has one, sharing drills with it.
const goal = { id: "win-the-dink-battle", label: "Win the dink battle" };
const stages = (...ids: string[]) => ids.map((id) => ({ drill: { id } }));
const one = { slug: "steady-dinks", title: "Steady Dinks", goal, stages: stages("80", "81", "113") };
const two = { slug: "steady-dinks-two", title: "Steady Dinks Two", goal, stages: stages("80", "90", "113") };
const other = { slug: "lob-game", title: "Lob Game", goal: { id: "special-shots", label: "Special shots" }, stages: stages("64", "67", "99") };
const all = [one, two, other];

describe("sessions lookups", () => {
  it("a drill in two sessions keeps both, in session order", () => {
    const by = sessionsByDrill(all);
    expect(by.get(80)).toEqual([
      { slug: "steady-dinks", title: "Steady Dinks", stage: 1 },
      { slug: "steady-dinks-two", title: "Steady Dinks Two", stage: 1 },
    ]);
    expect(by.get(113)?.map((w) => w.stage)).toEqual([3, 3]);
    expect(by.get(81)).toHaveLength(1);
    expect(by.get(1)).toBeUndefined();
  });

  it("a group of drills lists each session once, with the drills it contains", () => {
    const by = sessionsByDrill(all);
    expect(sessionsOfDrills(by, ["80", "81", "113", "5"])).toEqual([
      { slug: "steady-dinks", title: "Steady Dinks", ns: ["80", "81", "113"] },
      { slug: "steady-dinks-two", title: "Steady Dinks Two", ns: ["80", "113"] },
    ]);
    // leading zeros in the vault's numbers ("08") match the site's numbers
    expect(sessionsOfDrills(sessionsByDrill([{ ...other, stages: stages("08", "1", "2") }]), ["8"])).toHaveLength(1);
  });

  it("two sessions for one goal never get the same card text", () => {
    expect(cardText(one, all)).toEqual({ title: "Win the dink battle", session: "Steady Dinks" });
    expect(cardText(two, all)).toEqual({ title: "Win the dink battle", session: "Steady Dinks Two" });
    expect(cardText(other, all)).toEqual({ title: "Special shots" });
    expect(cardText({ slug: "x", title: "No Goal", stages: [] }, all)).toEqual({ title: "No Goal" });
  });
});
