import { z } from "astro/zod";

export const DrillCard = z
  .object({
    id: z.string().regex(/^\d+$/),
    title: z.string().min(1),
    players: z.enum(["2", "3", "4", "Wall"]),
    isNew: z.boolean(),
    watchUrl: z.string().url(),
    watchLabel: z.string().min(1),
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

export type DrillCard = z.infer<typeof DrillCard>;
export type Stage = z.infer<typeof Stage>;
export type Session = z.infer<typeof Session>;
