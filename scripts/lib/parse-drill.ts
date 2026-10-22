import { PublishError } from "./errors";
import { splitFrontmatter, str, toPlainText } from "./text";
import type { DrillCard } from "../../src/lib/session-schema";

const WATCH = /^[ \t]*-[ \t]+\*\*▶ Watch the drill:\*\*[ \t]*(.*)$/m;
const PLAYERS = new Set(["2", "3", "4", "Wall"]);

export function parseDrill(fileText: string, id: string): DrillCard {
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

  return { id, title, players: players as DrillCard["players"], isNew: str(fm.status) === "new", watchUrl, watchLabel };
}
