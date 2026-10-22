import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { Session } from "./lib/session-schema";

const sessions = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: process.env.SESSIONS_DIR ?? "./src/content/sessions",
    generateId: ({ data }) => String(data.slug),
  }),
  schema: Session,
});

export const collections = { sessions };
