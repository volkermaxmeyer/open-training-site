import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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

  it("reads the /s/ redirects from vercel.json", () => {
    expect(renamedSlugs(root)["win-the-dink-battle"]).toBe("steady-dinks");
  });
});
