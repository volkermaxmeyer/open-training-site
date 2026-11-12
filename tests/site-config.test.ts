import { describe, expect, it } from "vitest";
import { playersFit, playersFitParts, stagePlayersLabel } from "../src/site.config";

describe("players wording", () => {
  it("start page says the minimum, and names a stage that needs more", () => {
    expect(playersFit(["2", "2", "2"])).toBe("2+ players");
    expect(playersFit(["2", "2", "4"])).toBe("2+ players · Drill 3 needs 4");
    expect(playersFitParts(["Wall", "2", "4"])).toEqual({ base: "Wall", extras: ["Drill 2 needs 2 players", "Drill 3 needs 4 players"] });
  });



  it("a drill chip flags only the drills that need more than the first one", () => {
    expect(stagePlayersLabel("2", "2")).toBe("2 players");
    expect(stagePlayersLabel("4", "2")).toBe("Needs 4 players");
    expect(stagePlayersLabel("2", "Wall")).toBe("Needs 2 players");
  });
});
