import { describe, expect, it } from "vitest";
import { checkCanary, parseFeedback } from "../scripts/canary";

describe("checkCanary", () => {
  it("flags empty session", () => {
    const problems = checkCanary([{ session: "", submittedAt: "2026-11-05 16:35:56" }], []);
    expect(problems).toEqual(["row submitted 2026-11-05 16:35:56 has no session"]);
  });

  it("flags unknown session", () => {
    const problems = checkCanary([{ session: "test", submittedAt: "2026-11-05 16:38:49" }], ["win-the-dink-battle"]);
    expect(problems).toContain('row submitted 2026-11-05 16:38:49 has unknown session "test"');
  });

  it("passes known session", () => {
    const rows = [{ session: "win-the-dink-battle", submittedAt: "2026-11-05 10:00:00" }];
    expect(checkCanary(rows, ["win-the-dink-battle"])).toEqual([]);
  });

  it("counts a row for a renamed session towards its new slug", () => {
    const rows = [{ session: "old-name", submittedAt: "2026-11-05 10:00:00" }];
    expect(checkCanary(rows, ["new-name"], undefined, { "old-name": "new-name" })).toEqual([]);
  });

  it("flags a published session without any row", () => {
    expect(checkCanary([], ["work-your-way-in"])).toEqual(['no feedback row for published session "work-your-way-in"']);
  });
});

describe("parseFeedback", () => {
  it("finds the columns by header name and sorts by submission time", () => {
    const values = [
      ["Submission ID", "Submitted at", "session", "Other"],
      ["b", "2026-10-30 16:38:49", "test", "x"],
      ["a", "2026-10-30 16:35:56"],
    ];
    expect(parseFeedback(values)).toEqual([
      { session: "", submittedAt: "2026-10-30 16:35:56" },
      { session: "test", submittedAt: "2026-10-30 16:38:49" },
    ]);
  });

  it("throws when a column is missing", () => {
    expect(() => parseFeedback([["Submitted at"]])).toThrow(/session/);
  });
});

describe("checkCanary: pre-launch test rows", () => {
  it("skips rows before LIVE_SINCE but still flags a bad row after it", () => {
    const rows = [
      { session: "", submittedAt: "2026-10-30 16:35:56" },
      { session: "test", submittedAt: "2026-10-30 16:38:49" },
      { session: "work-your-way-in", submittedAt: "2026-11-04 21:00:00" },
    ];
    expect(checkCanary(rows, ["work-your-way-in"])).toEqual([]);
    expect(checkCanary([...rows, { session: "", submittedAt: "2026-11-05 10:00:00" }], ["work-your-way-in"])).toEqual([
      "row submitted 2026-11-05 10:00:00 has no session",
    ]);
  });
});
