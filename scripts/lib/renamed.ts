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

/** Drill ids whose page redirects elsewhere (a `/drill/<id>/` source in vercel.json), so an unpublished page does not 404. */
export function redirectedDrills(repoRoot: string): Set<string> {
  const file = join(repoRoot, "vercel.json");
  if (!existsSync(file)) return new Set();
  const redirects: { source: string }[] = JSON.parse(readFileSync(file, "utf8")).redirects ?? [];
  return new Set(redirects.map((r) => r.source.match(/^\/drill\/(\d+)\/?$/)?.[1]).filter((x): x is string => !!x));
}
