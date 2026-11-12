import { PublishError } from "./errors";
import { parseDrill } from "./parse-drill";
import { MAX_IN_SHORT, MAX_RULES, labelled } from "./parse-session";
import { splitFrontmatter, str, toPlainText } from "./text";
import { SHOTS } from "../../src/lib/shots";
import type { DrillPage } from "../../src/lib/session-schema";

/** A goal and the theme filters that put a drill under it (vault schema: player_goals → weekly_themes). */
export type GoalFilter = { id: string; filters: { field: string; value: string }[] };

/**
 * Goals whose themes reach a drill, by its competency / cluster / themes, like validate.py's drill_theme_ids().
 * A competency filter also matches `also-trains` (2026-11-12): a drill that trains several skills in sequence keeps one
 * main competency and lists the others there.
 */
export function goalsOfDrill(fm: Record<string, unknown>, goals: GoalFilter[]): string[] {
  const has = (field: string, value: string): boolean => {
    const v = fm[field];
    if (Array.isArray(v) ? v.map(String).includes(value) : str(v) === value) return true;
    return field === "competency" && has("also-trains", value);
  };
  return goals.filter((g) => g.filters.some((f) => has(f.field, f.value))).map((g) => g.id);
}

/**
 * The released player card of a drill (Shots area, 2026-11-07). A card counts only on a live drill with
 * `isolation: true` and a `card-checked-by`; anything else returns null. A released card that breaks the format
 * stops the publish, like a broken session. Format and rules: vault system/datenmodell.md, "Player card".
 */
export function parseCard(fileText: string, name: string, goals: GoalFilter[]): DrillPage | null {
  const parts = splitFrontmatter(fileText);
  if (!parts) throw new PublishError(name, `drill ${name}: no parseable frontmatter`);
  const { fm, body } = parts;
  if (str(fm.status) === "archived" || fm.isolation !== true || !str(fm["card-checked-by"])) return null;

  const fail = (reason: string): never => {
    throw new PublishError(name, `player card of ${name}: ${reason}`);
  };
  const shot = str(fm.shot);
  if (!(SHOTS as readonly string[]).includes(shot)) fail(`shot '${shot}' has no tile`);
  const section = body.split(/^## Player card[ \t]*$/m);
  if (section.length !== 2) fail("released, but there is not exactly one '## Player card' section");
  const block = section[1].split(/^## /m)[0];

  const cardTitle = labelled(block, "Title");
  if (!cardTitle) fail("missing 'Title'");
  const inShort = labelled(block, "In short");
  if (!inShort) fail("missing 'In short'");
  if (inShort.length > MAX_IN_SHORT) fail(`'In short' has ${inShort.length} characters, max ${MAX_IN_SHORT}`);
  const rules = [...block.matchAll(/^- (.+)$/gm)].map((r) => toPlainText(r[1])).filter(Boolean);
  if (rules.length === 0) fail("no rules");
  if (rules.length > MAX_RULES) fail(`${rules.length} rules, max ${MAX_RULES}`);
  const tooEasy = labelled(block, "Too easy");
  const tooHard = labelled(block, "Too hard");
  if (!tooEasy) fail("missing 'Too easy'");
  if (!tooHard) fail("missing 'Too hard'");
  const goodLooksLike = labelled(block, "Good looks like");

  const drill = parseDrill(fileText, name);
  const variant = str(fm["shot-variant"]);
  const status = str(fm.status);
  return {
    id: drill.id,
    cardTitle,
    shot: shot as DrillPage["shot"],
    ...(variant ? { variant } : {}),
    tested: status === "tested" || status === "favorite",
    inShort,
    rules,
    tooEasy,
    tooHard,
    ...(goodLooksLike ? { goodLooksLike } : {}),
    goals: goalsOfDrill(fm, goals),
    drill,
  };
}
