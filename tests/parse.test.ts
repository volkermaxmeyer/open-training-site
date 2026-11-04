import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Session } from "../src/lib/session-schema";
import { PublishError } from "../scripts/lib/errors";
import { parseDrill } from "../scripts/lib/parse-drill";
import { parseSession } from "../scripts/lib/parse-session";
import { toPlainText } from "../scripts/lib/text";

const root = join(__dirname, "fixtures/vault");
const drills = new Map<string, string>(
  readdirSync(join(root, "drills")).map((f) => [f.slice(0, -3), readFileSync(join(root, "drills", f), "utf8")]),
);
const session = readFileSync(join(root, "sessions/web/fixture-session.md"), "utf8");

function fails(text: string, d = drills): PublishError {
  try {
    parseSession(text, d);
  } catch (e) {
    expect(e).toBeInstanceOf(PublishError);
    return e as PublishError;
  }
  throw new Error("expected PublishError");
}

describe("parseSession", () => {
  it("parses three stages with rules and drill cards", () => {
    const s = parseSession(session, drills);
    expect(s.stages).toHaveLength(3);
    expect(s.duration).toBe(45);
    expect(s.stages[0].rules).toHaveLength(2);
    expect(s.stages[0].goodLooksLike).toBe("Ten taps without a bounce.");
    expect(s.stages[1].goodLooksLike).toBeUndefined();
    expect(s.stages[0].drill.watchUrl).toBe("https://youtu.be/AAAA1111?t=65");
    expect(s.stages[0].drill.watchLabel).toBe("Fake Channel @1:05");
    expect(s.stages[0].drill.players).toBe("Wall");
    expect(s.stages[0].drill.isNew).toBe(false);
    expect(s.stages[1].drill.isNew).toBe(true);
    expect(s.stages[1].drill.watchUrl).toBe("https://youtu.be/BBBB2222");
    expect(s.stages[1].drill.watchLabel).toBe("Demo Club");
    expect(s.stages[2].drill.players).toBe("4");
    expect(s.stages[2].drill.title).toBe("Cone Game");
  });

  it("strips wikilinks to alias text", () => {
    const s = parseSession(session, drills);
    expect(s.stages[0].rules[0]).toBe("Stand close to the wall");
    expect(s.aim).toBe("Keep a soft rally going for ten shots in a row.");
    expect(s.stages[1].drill.title).toBe("Paired Lobs (see Wall Taps)");
    expect(JSON.stringify(s)).not.toContain("[[");
    expect(toPlainText("Play like [[113-x|Dinkles]] and [[plain]]")).toBe("Play like Dinkles and plain");
  });

  it("reduces alias-less wikilinks and removes embeds", () => {
    expect(toPlainText("[[a#h]]")).toBe("a");
    expect(toPlainText("[[folder/note]]")).toBe("note");
    expect(toPlainText("[[folder/note#h]]")).toBe("note");
    expect(toPlainText("[[a#h|Shown]]")).toBe("Shown");
    const out = toPlainText("see ![[x.png]] here");
    expect(out).toBe("see here");
    expect(toPlainText("a ![[x.png|cap]] b")).toBe("a b");
    expect(out).not.toMatch(/!|x\.png|\[\[/);
  });

  it("drops [added] and [UNVERIFIED] markers", () => {
    const s = parseSession(session, drills);
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/\[added|UNVERIFIED/);
    expect(s.stages[0].rules[1]).toBe("Keep eyes on the ball");
    expect(s.stages[1].rules[1]).toBe('Call "mine"');
  });

  it("rejects unknown drill", () => {
    const e = fails(session.replace("902-paired-lobs", "999-ghost"));
    expect(e.slug).toBe("fixture-session");
    expect(e.message).toContain("fixture-session");
    expect(e.message).toContain("999-ghost");
  });

  it("rejects archived drill", () => {
    const e = fails(session.replace("903-cone-game", "904-old-drill"));
    expect(e.message).toContain("904-old-drill");
    expect(e.message).toContain("archived");
  });

  it("rejects drill without watch line", () => {
    const e = fails(session.replace("903-cone-game", "905-no-video"));
    expect(e.slug).toBe("fixture-session");
    expect(e.message).toContain("905-no-video");
  });

  it("rejects stage/drill count mismatch", () => {
    expect(fails(session.replace("drills: [901-wall-taps, 902-paired-lobs, 903-cone-game]", "drills: [901-wall-taps, 902-paired-lobs]")).reason).toMatch(/drills/);
    expect(fails(session.replace(/## Stage 3[\s\S]*$/, "")).reason).toMatch(/stage headings/);
  });

  it("rejects more than 6 rules", () => {
    const seven = Array.from({ length: 7 }, (_, i) => `- extra ${i}`).join("\n");
    const e = fails(session.replace("- Play to 11.", seven));
    expect(e.reason).toMatch(/stage 3.*7 rules/);
  });

  it("rejects empty or frontmatter-less file", () => {
    expect(fails("")).toBeInstanceOf(PublishError);
    expect(fails("# Just a heading\n\n## Stage 1 · x\n- a")).toBeInstanceOf(PublishError);
  });

  it("output passes Session.strict().parse", () => {
    const s = parseSession(session, drills);
    expect(() => Session.strict().parse(s)).not.toThrow();
    const json = JSON.parse(JSON.stringify(s));
    expect(Object.keys(json).sort()).toEqual(["aim", "competency", "duration", "slug", "stages", "status", "title"]);
    expect(JSON.stringify(json)).not.toMatch(/court-card|tags|publish/);
  });
});

describe("In short and goal", () => {
  it("reads one In-short sentence per stage without swallowing the rules", () => {
    const s = parseSession(session, drills);
    expect(s.stages.map((st) => st.inShort)).toEqual([
      "Short line for stage 1.",
      "Short line for stage 2.",
      "Short line for stage 3.",
    ]);
    expect(s.stages[0].rules).toHaveLength(2);
  });

  it("rejects a stage without In short, or one over 160 characters", () => {
    expect(fails(session.replace("**In short:** Short line for stage 2.\n", "")).reason).toMatch(/stage 2.*In short/);
    expect(fails(session.replace("Short line for stage 1.", "x".repeat(161))).reason).toMatch(/stage 1.*161 characters/);
  });

  it("resolves a known goal and rejects an unknown one", () => {
    const goals = new Map([["g1", { label: "Hit soft balls", order: 0 }]]);
    const withGoal = session.replace("publish: false\n", "publish: false\ngoal: g1\n");
    expect(parseSession(withGoal, drills, goals).goal).toEqual({ id: "g1", label: "Hit soft balls", order: 0 });
    expect(parseSession(session, drills, goals).goal).toBeUndefined();
    expect(fails(withGoal.replace("goal: g1", "goal: nope")).reason).toMatch(/unknown id 'nope'/);
  });
});

describe("Only two", () => {
  it("is read on a 4-player stage and required there", () => {
    expect(parseSession(session, drills).stages[2].onlyTwo).toBe("Play stage 2 again with a target.");
    expect(fails(session.replace("**Only two:** Play stage 2 again with a target.\n", "")).reason).toMatch(/stage 3.*Only two/);
  });
});

describe("drill id", () => {
  it("drill card id is the number only", () => {
    const s = parseSession(session, drills);
    expect(s.stages.map((st) => st.drill.id)).toEqual(["901", "902", "903"]);
    expect(JSON.stringify(s)).not.toContain("wall-taps");
    const d = new Map(drills);
    d.set("00-zero-drill", drills.get("901-wall-taps")!);
    const z = parseSession(session.replace("drills: [901-wall-taps", "drills: [00-zero-drill"), d);
    expect(z.stages[0].drill.id).toBe("00");
  });

  it("rejects drill filename without a leading number", () => {
    const d = new Map(drills);
    d.set("wall-taps", drills.get("901-wall-taps")!);
    const e = fails(session.replace("drills: [901-wall-taps", "drills: [wall-taps"), d);
    expect(e.slug).toBe("fixture-session");
    expect(e.message).toContain("wall-taps");
  });
});

describe("parseDrill", () => {
  it("coerces players and flags new", () => {
    const d = parseDrill(drills.get("902-paired-lobs")!, "902-paired-lobs");
    expect(d.players).toBe("2");
    expect(d.isNew).toBe(true);
  });
});
