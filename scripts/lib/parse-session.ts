import { PublishError } from "./errors";
import { parseDrill } from "./parse-drill";
import { splitFrontmatter, str, toPlainText } from "./text";
import type { Session, Stage } from "../../src/lib/session-schema";

const STAGES = 3;
const MAX_RULES = 6;
const MAX_IN_SHORT = 160;

export type Goals = Map<string, { label: string; order: number }>;

function labelled(block: string, label: string): string {
  const m = block.match(
    new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*([\\s\\S]*?)(?=^\\*\\*[^*\\n]+:\\*\\*|^- |^#|(?![\\s\\S]))`, "m"),
  );
  return m ? toPlainText(m[1]) : "";
}

export function parseSession(fileText: string, drills: Map<string, string>, goals: Goals = new Map()): Session {
  const parts = splitFrontmatter(fileText);
  if (!parts) throw new PublishError("(unknown)", "empty or frontmatter-less file");
  const { fm, body } = parts;

  const slug = str(fm.slug);
  if (!slug) throw new PublishError("(unknown)", "missing slug");
  const fail = (reason: string): never => {
    throw new PublishError(slug, reason);
  };

  const title = toPlainText(str(fm.title));
  const competency = str(fm.competency);
  const aim = toPlainText(str(fm.aim));
  const status = str(fm.status);
  const duration = Number(str(fm.duration));
  if (!title) fail("missing title");
  if (!competency) fail("missing competency");
  if (!aim) fail("missing aim");
  if (!status) fail("missing status");
  if (!Number.isFinite(duration) || duration <= 0) fail("duration is not a positive number");

  const goalId = str(fm.goal);
  const goalRef = goalId ? goals.get(goalId) : undefined;
  if (goalId && !goalRef) fail(`goal: unknown id '${goalId}' (see player_goals)`);

  const ids = Array.isArray(fm.drills) ? fm.drills.map(str) : [];
  if (ids.length !== STAGES) fail(`drills: needs ${STAGES} entries, has ${ids.length}`);

  const chunks = body.split(/^## Stage \d+ · (.+)$/m);
  const nStages = (chunks.length - 1) / 2;
  if (nStages !== STAGES) fail(`body: needs ${STAGES} stage headings, has ${nStages}`);

  const stages: Stage[] = [];
  for (let i = 0; i < STAGES; i++) {
    const stageTitle = toPlainText(chunks[1 + i * 2]);
    const block = chunks[2 + i * 2].split(/^## /m)[0];
    const n = i + 1;

    const rules = [...block.matchAll(/^- (.+)$/gm)].map((r) => toPlainText(r[1])).filter(Boolean);
    if (rules.length === 0) fail(`stage ${n}: no rules`);
    if (rules.length > MAX_RULES) fail(`stage ${n}: ${rules.length} rules, max ${MAX_RULES}`);

    const inShort = labelled(block, "In short");
    if (!inShort) fail(`stage ${n}: missing 'In short'`);
    if (inShort.length > MAX_IN_SHORT) fail(`stage ${n}: 'In short' has ${inShort.length} characters, max ${MAX_IN_SHORT}`);

    const onlyTwo = labelled(block, "Only two");
    if (onlyTwo.length > MAX_IN_SHORT) fail(`stage ${n}: 'Only two' has ${onlyTwo.length} characters, max ${MAX_IN_SHORT}`);

    const tooEasy = labelled(block, "Too easy");
    const tooHard = labelled(block, "Too hard");
    if (!tooEasy) fail(`stage ${n}: missing 'Too easy'`);
    if (!tooHard) fail(`stage ${n}: missing 'Too hard'`);
    const goodLooksLike = labelled(block, "Good looks like");

    const drillId = ids[i];
    const drillText = drills.get(drillId);
    if (drillText === undefined) fail(`stage ${n}: unknown drill '${drillId}'`);
    const drillFm = splitFrontmatter(drillText as string);
    if (drillFm && str(drillFm.fm.status) === "archived") {
      fail(`stage ${n}: drill '${drillId}' is archived`);
    }
    let drill;
    try {
      drill = parseDrill(drillText as string, drillId);
    } catch (e) {
      if (e instanceof PublishError) fail(`stage ${n}, drill ${drillId}: ${e.reason}`);
      throw e;
    }

    if (drill.players === "4" && !onlyTwo) fail(`stage ${n}: 4-player drill needs an '**Only two:**' line for pairs`);

    stages.push({
      title: stageTitle,
      inShort,
      ...(onlyTwo ? { onlyTwo } : {}),
      rules,
      tooEasy,
      tooHard,
      ...(goodLooksLike ? { goodLooksLike } : {}),
      drill,
    });
  }

  return {
    slug,
    title,
    competency,
    aim,
    duration,
    stages: stages as Session["stages"],
    status,
    ...(goalRef ? { goal: { id: goalId, ...goalRef } } : {}),
  };
}
