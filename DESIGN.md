# Design

How Open Training looks and why. Colour values live only in `src/styles/global.css` (`@theme`); this file names the
tokens and gives the reasons. `tests/design-doc.test.ts` fails if a token named here does not exist there, and
`tests/contrast.test.ts` checks every text/background pair.

## Intent

- **Direct sun, midday.** Every text/background pair reaches at least 7:1. Light mode only: dark surfaces wash out in
  glare.
- **One hand, thumb only.** Tap targets at least 48 px high, primary buttons 56 px. No precise taps.
- **Four people, one phone.** Base text 18 px, readable at arm's length. The glance question is always "what are the
  rules of this stage again?", so the stage number and title must be findable by scanning.
- **A bit funky.** Playful and sporty, never at the cost of the three points above.
- **No JavaScript in the design.** Native `<details>` for anything that opens. The page carries only the cookieless
  analytics loader.

## Origin

Derived from the **Y2K theme of Astryx**, Meta's open source design system (MIT). We take its values and look, not
its code: Astryx is React and StyleX, this site is static Astro and Tailwind.

Deviations from Y2K, each for the 7:1 rule or a site constraint:

| Y2K | Here | Why |
| --- | --- | --- |
| secondary text `#675d52` | `--color-ink-soft` (Y2K's darker gray) | 6.4:1 on white, 4.2:1 on periwinkle |
| secondary text on any surface | `--color-ink-soft` only on `--color-card` | 6.2:1 on periwinkle |
| green and pink badges | badge in yellow (`--color-badge`) | 6.3:1 and 6.6:1 |
| soft shadows | hard offset shadow | more character, no blur to wash out in sun |
| fonts from Google Fonts | self-hosted | no third-party request, no IP sent to Google |
| light and dark mode | light only | sun |

## Colour roles

| Role | Token | Used for |
| --- | --- | --- |
| Text | `--color-ink` | all body text, headings, borders, shadows |
| Secondary text | `--color-ink-soft` | small labels ("Stage 1"), **only on cards** |
| Page | `--color-paper` | page background (periwinkle) |
| Card | `--color-card` | stage cards, session list items |
| Text on dark | `--color-on-ink` | text on `--color-ink` buttons |
| Stage blocks | `--color-stage-1`, `--color-stage-2`, `--color-stage-3` | the number block of each stage card (blue, purple, yellow) |
| Badge | `--color-badge`, `--color-badge-ink` | "New — tell us how it went" |
| Go | `--color-go` | the feedback button (neon green) |

## Type

- **Headings:** Poppins 700. **Display** (session title, stage numbers): Crimson Text 700. Both OFL, self-hosted under
  `public/fonts/`.
- **Body:** open — Poppins or the system font. Poppins is wide and the rules are long; decided on a phone, not by a
  ratio.
- **Sizes:** base 18 px · stage title 26 px · session title 44 px · stage number 64 px · labels 14 px uppercase,
  letter-spaced.

## Shapes

- Corners: 0 radius everywhere.
- Borders: 2 px in `--color-ink` around cards, badges, the feedback button and between card sections.
- Shadow: hard offset, 6 px right and down, in `--color-ink`, no blur. Only on cards and the feedback button.

## Patterns

- **Stage card:** number block (stage colour, display font) beside label and title; then rules as a list; a full-width
  `--color-ink` "▶ Watch" button; then `<details>` "Too easy? Too hard?" holding Too easy, Too hard and Good looks
  like.
- **Badges:** one per session under the title until the session is tested; one per card when its drill is new.
- **Feedback button:** after the last card, `--color-go` with the card border and shadow.
- **Open:** sticky jump links 1 · 2 · 3, because Stage 2 starts about two screens down.

## Don't

- Put `--color-ink-soft` on `--color-paper` or a stage colour.
- Add a colour without adding its pair to `tests/contrast.test.ts`.
- Write a hex value outside `@theme`.
- Load fonts, scripts or images from another host.
