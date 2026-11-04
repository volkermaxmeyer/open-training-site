import { PublishError } from "./errors";
import { splitFrontmatter, str, toPlainText } from "./text";
import type { DrillCard } from "../../src/lib/session-schema";

const WATCH = /^[ \t]*-[ \t]+\*\*▶ Watch the drill:\*\*[ \t]*(.*)$/m;
const PLAYERS = new Set(["2", "3", "4", "Wall"]);
const VIDEO_ID = /(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
const START = /[?&]t=(\d+)s?(?:&|$)/;
const SEGMENT = /@(\d+):(\d{2})\s*[–-]\s*(\d+):(\d{2})/;

export function parseDrill(fileText: string, id: string): DrillCard {
  const number = id.match(/^(\d+)(?:-|$)/)?.[1];
  if (!number) throw new PublishError(id, `drill ${id}: filename has no leading number`);
  const parts = splitFrontmatter(fileText);
  if (!parts) throw new PublishError(id, `drill ${id}: no parseable frontmatter`);
  const { fm, body } = parts;

  const title = toPlainText(str(fm.title));
  if (!title) throw new PublishError(id, `drill ${id}: missing title`);

  const players = str(fm.players);
  if (!PLAYERS.has(players)) {
    throw new PublishError(id, `drill ${id}: players '${players}' not one of 2/3/4/Wall`);
  }

  const watch = body.match(WATCH);
  const urlMatch = watch?.[1].match(/https?:\/\/[^\s)]+/);
  if (!watch || !urlMatch) {
    throw new PublishError(id, `drill ${id}: no parseable '▶ Watch the drill' line`);
  }
  const watchUrl = urlMatch[0];
  const before = watch[1].slice(0, urlMatch.index).replace(/[\s—–-]+$/, "");
  const watchLabel = toPlainText(before) || "Watch the drill";

  // In-card player (2026-11-04): only when the line gives a video id, a start (t=) and an end ("@1:41–2:41"),
  // and is not marked "(embed: no)". Anything else keeps the plain link to YouTube.
  const after = watch[1].slice((urlMatch.index ?? 0) + watchUrl.length);
  const videoId = watchUrl.match(VIDEO_ID)?.[1];
  const start = Number(watchUrl.match(START)?.[1]);
  const seg = before.match(SEGMENT);
  const end = seg ? Number(seg[3]) * 60 + Number(seg[4]) : NaN;
  const player =
    videoId && Number.isFinite(start) && Number.isFinite(end) && end > start && !/\(embed:\s*no\)/i.test(after)
      ? { videoId, start, end }
      : {};

  return { id: number, title, players: players as DrillCard["players"], watchUrl, watchLabel, ...player };
}
