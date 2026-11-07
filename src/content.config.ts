import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { DrillPage, Session } from "./lib/session-schema";

const sessions = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: process.env.SESSIONS_DIR ?? "./src/content/sessions",
    generateId: ({ data }) => String(data.slug),
  }),
  schema: Session,
});

// Released player cards for the Shots area (2026-11-07), one file per drill, written by scripts/publish.ts.
const drills = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: process.env.DRILLS_DIR ?? "./src/content/drills",
    generateId: ({ data }) => String(data.id),
  }),
  schema: DrillPage,
});

export const collections = { sessions, drills };
