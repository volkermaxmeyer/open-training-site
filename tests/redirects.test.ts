import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renamedSlugs } from "../scripts/lib/renamed";

const root = resolve(import.meta.dirname, "..");

describe("session URLs", () => {
  it("every slug ever published is still live or redirects to a live one", () => {
    const manifest = JSON.parse(readFileSync(join(root, "src/content/.manifest.json"), "utf8"));
    const live = (slug: string) => existsSync(join(root, "src/content/sessions", `${slug}.json`));
    const renamed = renamedSlugs(root);
    for (const slug of manifest.slugsEverPublished as string[]) {
      if (live(slug)) continue;
      expect(renamed[slug], `"${slug}" is gone without a redirect in vercel.json`).toBeDefined();
      expect(live(renamed[slug]), `"${slug}" redirects to "${renamed[slug]}", which is not live`).toBe(true);
    }
  });

  it("never reuses a slug: no live session sits on a redirected address", () => {
    // A retired slug keeps its redirect forever (decision log 2026-11-14), and Vercel applies redirects before pages,
    // so a new session on a redirected slug could never be reached.
    const renamed = renamedSlugs(root);
    const liveSlugs = readdirSync(join(root, "src/content/sessions"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    for (const slug of liveSlugs) {
      expect(renamed[slug], `"${slug}" is live but /s/${slug} redirects to "${renamed[slug]}": pick a new slug`).toBeUndefined();
    }
  });

  it("reads the /s/ redirects from vercel.json", () => {
    expect(renamedSlugs(root)["win-the-dink-battle"]).toBe("steady-dinks");
  });
});
