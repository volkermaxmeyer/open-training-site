# Open Training

Self-explanatory pickleball training sessions for peer-led groups, one phone page per session:
https://open-training-site.vercel.app/

Each session is a ladder of three drills for one player goal. Every drill shows a short sentence, the part of a YouTube
video that demonstrates it (it plays inside the card after a tap), the rules, how to make it easier or harder, and what
good looks like. A feedback link at the end tells
us whether the session worked without anyone explaining it.

## Why

Our club's advanced group trains without trained coaches. A drill only helps if the players can pick it up from a
phone on court and run it. Sessions are written for two players; groups of four get one warning line. The sessions come from a larger private training system; this site publishes the parts
that are ready, in a form that needs no explanation.

## How it works

```text
private notes ──publish script──▶ src/content/sessions/*.json ──git push──▶ Vercel build ──▶ static site
                 (validate, extract,            (leak guard runs on commit and push)
                  allowlist fields)
```

- **Astro, static output, no adapter.** Tailwind for styling. No external fonts or third-party scripts; a YouTube player
  (youtube-nocookie.com) loads only after a tap on a video.
- **Content is JSON, not copied notes.** `scripts/publish.ts` reads the sessions marked for publishing and builds
  each one from named fields only, so private notes and links never reach the repo. The site validates the JSON
  against `src/lib/session-schema.ts`.
- **Feedback** goes to a Tally form; the link carries the session slug as a hidden field. `scripts/canary.ts` reads
  the connected Google Sheet and reports rows without a session, rows with an unknown one, and published sessions
  that never received a row.
- **Visitor statistics** come from Vercel Web Analytics: no cookies, no personal profiles.
- **Every deploy is checkable.** The site serves `version.txt` with the commit it was built from;
  `scripts/check-deploy.ts` polls it until the pushed commit is live.

## Publishing

```sh
npm run publish:site -- --dry-run   # show what would change
npm run publish:site                # validate, write JSON, guard, commit, push
npx tsx scripts/check-deploy.ts     # wait until Vercel serves the new commit
```

The script aborts before writing anything if a source note is unreadable or a slug does not match its filename.
Removing a session that is already live needs `--allow-unpublish`. It commits only `src/content`, the bumped `src/version.json` and its `CHANGELOG.md` line.

## Version

The imprint shows the site version from `src/version.json`. It started at 1.000 and goes up by 0.001 with every push
to main, and every version gets one line in `CHANGELOG.md`. The publish script does both itself and names the sessions
it changed; a code change runs `npm run version:bump -- "what changed"` before its commit. To jump to another number,
write it into the file by hand and add its changelog line. The pre-push guard blocks a push to main whose version is
not higher than the live one or has no changelog line.

## Leak guard

`scripts/guard.ts` runs before every commit the publish script makes and, as a git pre-push hook, on every push. On
a push it scans every file of every commit being pushed, so something committed and deleted again is still caught.
It fails on:

- personal paths and private email addresses, including URL- and HTML-encoded forms
- notes markup that should never reach the site
- content files the publish script did not produce, or whose hash does not match its manifest
- session files that do not match the schema
- a push to main without a higher version or without its changelog line

After cloning, enable the hook once:

```sh
git config core.hooksPath .githooks
```

The hook lives in each clone, and `git push --no-verify` skips it. Both are accepted risks.

## Development

Node 24 (`.nvmrc`).

```sh
npm install
npm run dev     # local server
npm test        # vitest
npm run build
```

Local settings go in `.env.local` (gitignored), see `.env.example`.

## Credits

The drills are demonstrated in videos by these channels. Each card plays only the part that shows the drill; all
videos remain theirs.

- Backpaddle Pickleball
- Briones Pickleball Academy
- Building Pickleball
- Cam Luhring
- Catherine Parenteau
- Coach Jess | Athena Pickleball
- Cracked Pickleball
- Enhance Pickleball
- In2Pickle
- Jack Munro
- John Cincola Pickleball
- Pickleball Hub
- Pickleball Studio
- PickleballPlaybook - Austin Hardy
- Simone Jardim Pickleball
- ThatPickleballGuy - Kyle Koszuta
- Troy Akin Pickleball
- Walker Sisters Pickleball - Angie & Alex Walker
- Zane Navratil Pickleball

## Contact

BTV Olympia e.V., Abt. Pickleball, Berlin — pickleballinberlin@gmail.com
