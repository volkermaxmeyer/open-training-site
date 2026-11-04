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
  it, the video area is a plain link to YouTube.

## Origin

Derived from the **Y2K theme of Astryx**, Meta's open source design system (MIT). We take its values and look, not
its code: Astryx is React and StyleX, this site is static Astro and Tailwind.

Deviations from Y2K, each for the 7:1 rule or a site constraint:

| Y2K | Here | Why |
| --- | --- | --- |
| secondary text `#675d52` | `--color-ink-soft` (Y2K's darker gray) | 6.4:1 on white, 4.2:1 on periwinkle |
| secondary text on any surface | `--color-ink-soft` only on `--color-card` | 6.2:1 on periwinkle |
| green and pink badges | the "new" badge in the feedback green (`--color-go`), ink text | 6.3:1 and 6.6:1 |
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
| Go | `--color-go` | the feedback button and the "New — tell us how it went" badge (neon green) |
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
- Borders: 2 px in `--color-ink` around cards, badges, the feedback button and between card sections.
- Shadow: hard offset, 6 px right and down, in `--color-ink`, no blur. Only on cards and the feedback button.

## Patterns

- **Jump bar:** sticky at the top of the session page, on `--color-paper`. Three equal tabs, each the drill number in the
  display font over the small label "DRILL", 64 px high, 10 px apart, 2 px `--color-ink` border. The **selected tab** takes
  its stage colour, the hard shadow and a 2 px lift; the others stay `--color-card` with `--color-ink-soft` text. The
  selection is the drill named in the URL hash, Drill 1 when there is none: pure CSS (`:has(:target)`), no script. It
  changes when a tab is tapped, not while scrolling. Each stage card has `scroll-margin` so the bar does not cover it.
- **Chips:** 14 px Poppins 600, 2 px `--color-ink` border, optional person icon. Plain on `--color-card` (duration), `--color-chip`
  (player counts), `--color-warn` (a drill that needs more people than the first one).
- **Stage card:** number block (stage colour, display font) beside the title and, under it, two chips: the duration
  ("10 min", session duration ÷ 3) and the players ("2 players", or "Needs 4 players" in warn when it asks for more than
  the first drill). No "Stage N" label: the number block and the jump bar carry it. Then the **video first**: a full-width
  `--color-ink` "▶ Watch the drill" button, at least 72 px high, with the channel and time on a second line. Below it the
  one-sentence summary ("In short"), visible. On a 4-player stage, one regular-weight line for pairs that carries Drill 2's
  actual "Too easy" rule. Then two collapsed `<details>`: "How to play" (the "new" badge and the rules) and "Too easy? Too
  hard?" (Too easy, Too hard, Good looks like).
- **Session top:** title, then two chips (the aim is not shown on the page, only as the meta description for link
  previews; Volker 2026-11-04): the duration and a players summary ("Drills 1–2: 2 players · Drill 3: 4
  players", or "All drills: 2 players"). Then the **four-on-court line**: one line on `--color-warn` with a 6 px `--color-ink`
  bar on the left, no box shadow, the safety rule in bold. Red, not yellow, so it does not rhyme with Drill 3 (design critique
  2026-11-04).
- **Badges:** one inside "How to play" when its drill is new. No session badge under the title (removed 2026-11-04,
  Volker).
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
- Load fonts, scripts or images from another host.

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
- **Polish (2026-11-04):**
  - The "new" badge is green like the feedback button it asks for, so yellow means Stage 3 only. The badge tokens are
    gone.
  - One focus ring everywhere: 3 px ink, 3 px offset. Text selection uses the Stage-3 yellow.
  - Card-style links shift on hover for mouse users, as they do on tap.
  - Footer and back links share the same underline offset. "← All goals" is one component.
  - The watch link tells screen readers it opens YouTube.
  - The footer shows only Imprint and Privacy; the version number is gone (check-deploy reads `version.txt`). The kicker
    "Good training, no coach" and the goal "Special shots" stay (Volker's call, against Impeccable's kicker ban).
- **Delight (2026-11-04):** one authored mark and one authored moment.
  - **The pickleball** (`Ball.astro`, the same drawing as `public/favicon.svg` and `apple-touch-icon.png`): a
    `--color-go` disc, 4 px ink outline, seven ink holes. It replaces the Astro default favicon.
  - **The finish:** before the feedback button, the ball plus "That's 30 minutes. / Good rally, everyone." The ball
    drops in and bounces once as it scrolls into view. This is CSS only (scroll timeline), skipped for reduced motion, and
    static where unsupported. No other motion on the site.
- **Video in the card (2026-11-04):** for a drill whose Watch line has an end time (`@1:41–2:41`), the stage card shows
  a 16:9 `--color-ink` surface with a round play mark: "Play the drill here" and "Channel · 1:41–2:41 · about 1 min".
  It is a link to YouTube. A tap swaps it for a youtube-nocookie player with start, end, `playsinline`, `rel=0`, and
  "↺ Replay the drill" below it; replay inserts a new iframe, so the back gesture is untouched. Below the area, always:
  "or open it on YouTube". Nothing loads from YouTube before the tap. Drills without an end time keep the black button.
  - **Note for later:** a content security policy would need `frame-src https://www.youtube-nocookie.com`, and
    `Referrer-Policy: no-referrer` breaks YouTube embeds.

