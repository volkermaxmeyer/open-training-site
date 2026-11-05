import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Old session slug -> new slug, read from the /s/ redirects in vercel.json (the one place a rename is recorded). */
export function renamedSlugs(repoRoot: string): Record<string, string> {
  const file = join(repoRoot, "vercel.json");
  if (!existsSync(file)) return {};
  const redirects: { source: string; destination: string }[] = JSON.parse(readFileSync(file, "utf8")).redirects ?? [];
  const slug = (p: string) => p.match(/^\/s\/([a-z0-9-]+)\/?$/)?.[1];
  const out: Record<string, string> = {};
  for (const r of redirects) {
    const from = slug(r.source);
    const to = slug(r.destination);
    if (from && to) out[from] = to;
  }
  return out;
}
