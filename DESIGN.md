# Design

How Open Training looks and why. Colour values live only in `src/styles/global.css` (`@theme`); this file names the
tokens and gives the reasons. `tests/design-doc.test.ts` fails if a token named here does not exist there, and
`tests/contrast.test.ts` checks every text/background pair.

## Intent

- **Direct sun, midday.** Every text/background pair reaches at least 7:1. Light mode only: dark surfaces wash out in
  glare.
- **One hand, thumb only.** Tap targets at least 48 px high, primary buttons 56 px. No precise taps.
- **Four people, one phone.** Base text 18 px, readable at arm's length. The glance question is always "what are we
  doing in this stage?", so the drill number, title and the one-sentence summary must be findable by scanning. The
  rules sit one tap away (collapsed, Volker 2026-11-04). Whether that holds on court is checked on the first Friday.
- **A bit funky.** Playful and sporty, never at the cost of the three points above.
- **No JavaScript in the design**, with one exception. Native `<details>` for anything that opens. Besides the
  cookieless analytics loader, session pages carry one inline script for the in-card video player (2026-11-04). Without
  it, the video area is a plain link to YouTube. Every page also carries a tiny opt-out check before the loader, and the
  hidden `/not-me/` page has one button script, so the operator's own visits are not counted (2026-11-05).

## Origin

Derived from the **Y2K theme of Astryx**, Meta's open source design system (MIT). We take its values and look, not
its code: Astryx is React and StyleX, this site is static Astro and Tailwind.

Deviations from Y2K, each for the 7:1 rule or a site constraint:

| Y2K | Here | Why |
| --- | --- | --- |
| secondary text `#675d52` | `--color-ink-soft` (Y2K's darker gray) | 6.4:1 on white, 4.2:1 on periwinkle |
| secondary text on any surface | `--color-ink-soft` only on `--color-card` | 6.2:1 on periwinkle |
| green and pink badges | no badges (the "new" badge was removed 2026-11-04) | – |
| soft shadows | hard offset shadow | more character, no blur to wash out in sun |
| fonts from Google Fonts | bundled into the site (Fontsource) | no third-party request, no IP sent to Google |
| light and dark mode | light only | sun |

## Colour roles

| Role | Token | Used for |
| --- | --- | --- |
| Text | `--color-ink` | all body text, headings, borders, shadows |
| Secondary text | `--color-ink-soft` | small labels and the inactive jump tabs, **only on cards** |
| Page | `--color-paper` | page background (periwinkle) |
| Card | `--color-card` | stage cards, session list items |
| Text on dark | `--color-on-ink` | text on `--color-ink` buttons |
| Stage blocks | `--color-stage-1`, `--color-stage-2`, `--color-stage-3` | the number block of each stage card (blue, purple, yellow) |
| Go | `--color-go` | the feedback button (neon green) |
| Warn | `--color-warn` | the one-line four-on-court rule and the chips for a drill that needs more people (light red, ink text) |
| Chip | `--color-chip` | player-count chips (light periwinkle, ink text) |

## Type

- **Headings, labels, buttons:** Poppins 600/700 (`--font-head`). **Display** (session title, stage numbers, jump
  links): Crimson Text 700 (`--font-display`). Both OFL, latin subset only, bundled from Fontsource into the site's
  own assets (~41 KB woff2 in total).
- **Body:** the system font (`--font-sans`). Chosen over Poppins on a phone: Poppins is wide and the rules are long;
  the narrower system font shortens each card and leaves room for clearer gaps between rules.
- **Sizes:** base 18 px · stage title 26 px · session title 44 px · stage number 64 px · labels 14 px uppercase,
  letter-spaced.

## Shapes

- Corners: 0 radius everywhere.
- Borders: 2 px in `--color-ink` around cards, the feedback button and between card sections.
- Shadow: hard offset, 6 px right and down, in `--color-ink`, no blur. Only on cards and the feedback button.

## Patterns

- **Jump bar:** sticky on the session page, on `--color-paper`. Three equal tabs, 56 px high, 10 px apart, 2 px
  `--color-ink` border, each permanently in its stage colour with the drill number and "DRILL" on one line. No selected
  state (see critique round 2). Each stage card has `scroll-margin` so the bar does not cover it.
- **Chips:** 14 px Poppins 600, 2 px `--color-ink` border, optional person icon. Plain on `--color-card` (duration), `--color-chip`
  (player counts), `--color-warn` (a drill that needs more people than the first one).
- **Stage card:** number block (stage colour, display font) beside the title and, under it, two chips: the duration
  ("10 min", session duration ÷ 3) and the players ("2 players", or "Needs 4 players" in warn when it asks for more than
  the first drill). No "Stage N" label: the number block and the jump bar carry it. Then the **video first**: the in-card
  player surface (see "Video in the card"); only a drill without an end time falls back to the black "▶ Watch the drill"
  button. Below it the one-sentence summary ("In short"), visible. On a 4-player stage, the authored "Only two of you?"
  block (see critique round 2). Then two collapsed `<details>`: "How to play" (the rules) and "Too
  easy? Too hard?" (Too easy, Too hard, Good looks like).
- **Session top:** back link, title, then two chips (the aim is not shown on the page, only as the meta description for
  link previews; Volker 2026-11-04): "30 min" and the players ("2+ players · Drill 3 needs 4"). Then the jump bar, then
  the **four-on-court line**: one line on `--color-warn` with a 6 px `--color-ink`
  bar on the left, no box shadow, the safety rule in bold. Red, not yellow, so it does not rhyme with Drill 3 (design critique
  2026-11-04).
- **Badges:** none. The session badge under the title and the per-drill "New — tell us how it went" badge were both
  removed on 2026-11-04 (Volker). The `isNew` field was removed from the data the same day.
- **Feedback button:** after the last card, `--color-go` with the card border and shadow. Below it, when the next
  session is published, a card-style link "Got another 30 min? Next: …".
- **Start page:** the goal question as the display heading, then one card-style button per goal: the goal label large, a
  chevron on the right, and chips under the label: the minimum ("2+ players" or "Wall") and one warn chip per drill that
  needs more ("Drill 3 needs 4"). No duration chip: every session is 30 min. All cards share one height (room for a
  two-line label and one chip row), content centred, so the list reads as an even grid. No site-name header on any page: the start page is the question, and every
  other page has "← All goals".

## Don't

- Put `--color-ink-soft` on `--color-paper` or a stage colour.
- Add a colour without adding its pair to `tests/contrast.test.ts`.
- Write a hex value outside `@theme`.
- Load fonts, scripts or images from another host. The one exception is the YouTube player, and only after a tap.

## Changes after critique round 2 (2026-11-04, 24/36)

- **Jump bar:** the three tabs sit permanently in their stage colours with ink text, without any "selected" state. A
  state driven by the URL hash showed Drill 1 after scrolling, which is wrong status on the one fixed element.
- **Pairs on a 4-player stage:** an authored `**Only two:**` line per such stage (required by parser and validator). It
  is shown as a block on `--color-chip` with a 6 px ink bar and the label "ONLY TWO OF YOU?". It replaces the
  automatic reuse of Drill 2's "Too easy", which told a pair to play with a serving team.
- **Four-on-court rule:** "Four of you? **Never two balls with pace.**" At 390 px it still takes two lines.
- **Watch label:** channel only, and "at 1:41" instead of "@1:41". ▶ uses text presentation (U+FE0E) and is
  `aria-hidden`.
- **Small fixes:** the "+"/"–" of summaries is not read aloud; the three woff2 files are preloaded; the "new" badge has
  6.75 px vertical padding; titles use `text-wrap: balance`; goal cards are taller below 360 px so they stay equal.
- **Session page order (Volker, the same evening):** back link, title, the two chips, then the sticky jump tabs, then the
  rule line and the cards. The title comes first, so the page opens on what the session is.
- **Layout pass (2026-11-04):** the session page reads in three groups. (1) Title and one chip row, tight: the players chip
  uses the start-page wording ("2+ players · Drill 3 needs 4"), so it fits beside "30 min". (2) Jump tabs, 56 px high
  with the number and "DRILL" on one line, and the rule line tight under them as one band. (3) The drill cards, after a
  clear break. In the watch button, "at 3:54" never wraps on its own.
- **Wide screens (Volker, 2026-11-07):** for the moment of preparing at home on a laptop or iPad and sending the link on.
  Picked from a switchable preview (start page "B", session "B", closing "2"). Below 700 px nothing changes: the
  phone on court is measured element by element against the version before. From 700 px (`tablet:`, so an iPad mini held
  upright counts): the column is 720 px, headings 60 px, the goals a 2-column grid. From 1024 px (`lg:`), on the start
  page and sessions only (`Base` prop `wide`): up to 1120 px, goals in 3 columns, and in each drill card the video fills
  the left column at 16:9, before and after play (a stretched dark box left a black band under the YouTube frame), with
  the text on the right. Replay is a bar on the video's bottom edge, inside the player box, so it stays on the video
  however long the text column gets (Volker, after testing on the iPad). The closing becomes one row under a rule: finish, feedback,
  next, all 96 px high. Text pages (About, Imprint, Privacy) share the same 1120 px frame but keep their text at
  a 600 px measure from 700 px, about 74 characters (684 px ran to ~88 a line, and 65ch is wider still in the system font; audit 2026-11-07), left-aligned, so the footer links never move between pages; `scrollbar-gutter: stable` keeps short pages from
  sitting 7 px off where scrollbars take space (Volker, 2026-11-07). The start page question has no line-length cap
  on purpose: a 16ch cap broke it into three short lines on a laptop, and Volker wants the full width used (one line from
  1024 px, two balanced lines on an iPad held upright). The closing row has 3 columns, or 2 when a session has no next. A phone held sideways
  (844–932 px) gets the 700 px layout; accepted, since on court the phone is held upright.
- **Polish (2026-11-04):**
  - The "new" badge is green like the feedback button it asks for, so yellow means Stage 3 only. The badge tokens are
    gone.
  - One focus ring everywhere: 3 px ink, 3 px offset. Text selection uses the Stage-3 yellow.
  - Card-style links shift on hover for mouse users, as they do on tap.
  - Footer and back links share the same underline offset. "← All goals" is one component.
  - The watch link tells screen readers it opens YouTube.
  - The footer shows no version number (check-deploy reads `version.txt`). Since 2026-11-04 it reads About · Imprint ·
    Privacy, see below. The kicker
    "Good training, no coach" and the goal "Special shots" stay (Volker's call, against Impeccable's kicker ban).
- **Delight (2026-11-04):** one authored mark and one authored moment.
  - **The pickleball** (`Ball.astro`, the same drawing as `public/favicon.svg` and `apple-touch-icon.png`): a
    `--color-go` disc, 4 px ink outline, seven ink holes. It replaces the Astro default favicon.
  - **The finish:** before the feedback button, the ball plus "That's 30 minutes. / Good rally, everyone." The ball
    drops in and bounces once as it scrolls into view. This is CSS only (scroll timeline), skipped for reduced motion, and
    static where unsupported. No other motion on the site.
- **Video in the card (2026-11-04):** for a drill whose Watch line has an end time (`@1:41–2:41`), the stage card shows
  a 16:9 `--color-ink` surface with a round play mark: "Play the drill here" and "Channel · 1:41–2:41 · about 1 min".
  It runs edge to edge in the card, directly under the title row, and the channel/segment line is 14 px. It is a link to
  YouTube. A tap swaps it for a youtube-nocookie player with start, end, `playsinline` and `rel=0`, and adds "↺ Replay the
  drill" below it. Replay inserts a new iframe, so the back gesture is untouched. **Only one video at a time:** when one player starts (by tap, replay or its own play button), every other player on the page pauses in place, via YouTube's postMessage protocol (`enablejsapi=1`, no extra script). A paused player keeps its frame and resumes where it stopped (Volker, after the phone test). There is no separate YouTube link (removed
  by Volker): without JavaScript the area itself opens YouTube. Nothing loads from YouTube before the tap. Drills without an end time keep the black button.
  - **Note for later:** a content security policy would need `frame-src https://www.youtube-nocookie.com`, and
    `Referrer-Policy: no-referrer` breaks YouTube embeds.

## About page and site version (2026-11-04)

- **Footer:** About · Imprint · Privacy, About first.
- **About** (`/about/`): what the site is, where the drills come from, how a session ladder and its constraints work, a
  note that AI helped and a player decides what goes online, and that the project is non-commercial. It names no club
  until the club has agreed; the imprint keeps the legal address.
- **Version:** `src/version.json`, shown as the last line of the imprint ("Version 1.000", 14 px, ink, thin rule above;
  grey would miss 7:1 on paper). It goes up by 0.001 with every push to main, see README.
