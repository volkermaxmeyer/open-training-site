import { load } from "js-yaml";

export function toPlainText(md: string): string {
  return md
    .replace(/\s*\[added[^\]]*\]/gi, "")
    .replace(/\s*\[UNVERIFIED[^\]]*\]/gi, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, (_, t: string) => t.split("#")[0].split("/").pop() ?? "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitFrontmatter(
  fileText: string,
): { fm: Record<string, unknown>; body: string } | null {
  const m = fileText.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/);
  if (!m) return null;
  let data: unknown;
  try {
    data = load(m[1]);
  } catch {
    return null;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  return { fm: data as Record<string, unknown>, body: m[2] ?? "" };
}

export function str(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === undefined || v === null ? "" : String(v).trim();
}
