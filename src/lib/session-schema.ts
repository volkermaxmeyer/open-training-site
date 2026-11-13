import { z } from "astro/zod";
import { SHOTS } from "./shots";

export const DrillCard = z
  .object({
    id: z.string().regex(/^\d+$/),
    title: z.string().min(1),
    players: z.enum(["2", "3", "4", "Wall"]),
    watchUrl: z.string().url(),
    watchLabel: z.string().min(1),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
    start: z.number().int().min(0).optional(),
    end: z.number().int().positive().optional(),
  })
  .strict();

export const Stage = z
  .object({
    title: z.string().min(1),
    inShort: z.string().min(1).max(160),
    onlyTwo: z.string().min(1).max(160).optional(),
    rules: z.array(z.string().min(1)).min(1).max(6),
    tooEasy: z.string().min(1),
    tooHard: z.string().min(1),
    goodLooksLike: z.string().min(1).optional(),
    drill: DrillCard,
  })
  .strict();

export const Session = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    competency: z.string().min(1),
    aim: z.string().min(1),
    duration: z.number().positive(),
    stages: z.tuple([Stage, Stage, Stage]),
    status: z.string().min(1),
    goal: z.object({ id: z.string().min(1), label: z.string().min(1), order: z.number().int().min(0) }).strict().optional(),
    next: z.object({ slug: z.string().min(1), title: z.string().min(1) }).strict().optional(),
  })
  .strict();

/** A released player card of an isolation drill, one file per drill in src/content/drills (Shots area, 2026-11-07). */
export const DrillPage = z
  .object({
    id: z.string().regex(/^\d+$/),
    cardTitle: z.string().min(1),
    shot: z.enum(SHOTS),
    variant: z.string().min(1).optional(),
    /** Volley only: the heading the drill sits under on the Volley page (vault `volley-role`, 2026-11-13). */
    role: z.enum(["attack", "defend", "basics"]).optional(),
    tested: z.boolean(),
    inShort: z.string().min(1).max(160),
    rules: z.array(z.string().min(1)).min(1).max(6),
    tooEasy: z.string().min(1),
    tooHard: z.string().min(1),
    goodLooksLike: z.string().min(1).optional(),
    /** Player goals that reach the drill (vault goal filters); the page picks the session pointer from these. */
    goals: z.array(z.string().min(1)),
    drill: DrillCard,
  })
  .strict();

export type DrillCard = z.infer<typeof DrillCard>;
export type Stage = z.infer<typeof Stage>;
export type Session = z.infer<typeof Session>;
export type DrillPage = z.infer<typeof DrillPage>;
