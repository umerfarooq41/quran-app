> Current verification: [Independent post-refactor audit](POST-REFACTOR-AUDIT.md). This document records an earlier stage.

# Coordinated CSS architecture audit

**Current status:** the [UI follow-up](UI.md) resolves all remaining source CSS
`!important` declarations. The counts and exceptions below describe the earlier
architecture commit, not the current source tree.

Baseline: `33a2c4c611aa8ae7f3306b2760cc8d28ad04b535` on
`feature/tadabbur-gemini-foundation`. Production `main` is outside this change.

## Method

`scripts/audit-ui-css.mjs` parses every source stylesheet with PostCSS. It walks
nested conditional rules, selector lists and declarations, and records source
locations, conditional context, conflicting values, exact duplicate declarations
and selectors with multiple file owners. Run `npm run audit:css`.

The complete machine-readable inventories are [before.json](before.json) and
[after.json](after.json). Conflicting values are review candidates, not automatic
errors: responsive breakpoints, states, fallbacks and theme scopes are valid.
[retired-selectors.json](retired-selectors.json) records the reviewed old action
sheet, Index slider and tab/filter selectors removed after checking the current
source. Dynamic annotation, marker and export classes were excluded from that
obsolete-class review.

## Architecture

| Owner | Responsibility |
| --- | --- |
| `tokens.css` | Font faces, typography, spacing, radii, safe-area and sizing primitives |
| `theme.css` | Semantic light/dark colors, surfaces, control roles and responsive sizing tokens; no component selectors |
| `base.css` | Browser reset, default font/color scheme and form primitives |
| `app.css` | Shared page shell, fixed headers' container, scrolling and landscape viewport behavior |
| `shared-surfaces.css` | Cards, controls, sheets, disclosure triggers, shared header content, segmented controls and dropdown primitives |
| `home.css`, `index.css`, `tabs.css`, `reflect.css`, `search.css`, `settings.css`, `help.css`, `tafsir.css` | Screen-owned layout, content, responsive rules and states; `tabs.css` owns Library, `help.css` also owns About |
| `mushaf.css` | Reader paper, sixteen-line geometry, glyphs, banners, annotations, markers and their theme/responsive states |
| `reader.css` | Reader chrome, playback UI, translation cards and ayah action controls |
| `share.css` | Share Quran composition, preview, media controls and full-screen/orientation states |

`mobile-first.css`, `ui-polish.css` and `index-refined.css` are deleted. Their live
rules moved to the owners above. No replacement override stylesheet or cascade
layer was added. Selector lists spanning several components remain in the shared
owner. Responsive declarations live beside the component they affect.

The old `theme.css` combined tokens with more than four thousand lines of screen,
Reader and export overrides. The new file contains custom-property definitions
only. Reader geometry from several original files now has one owner, so an older
Mushaf rule cannot win merely because its file was imported later.

## Source corrections

* Shared page shells own their sizing and padding. Obsolete Index, Search,
  Settings and Home shell sizing was removed where it competed with that owner.
* Shared segmented controls own button metrics and selected states. Old Index,
  Library and Reflect tab button presentation was removed.
* Shared card surfaces own `.tab-card-surface`. The legacy
  `.tabs-screen.app-page-shell .tab-card-surface` solid-white background was the
  higher-specificity cause of white saved Reflect lesson cards. Its surface
  declarations were removed rather than countered with another Reflect override.
* Reflect cards and answer fields consume `--ui-card-bg` and `--ui-control-bg`.
  Question menus and navigation buttons now request semantic sheet/control
  styling instead of a hardcoded `bg-white` utility.
* Settings picker text uses the semantic text token, preventing an old green text
  value from overriding dark-theme text. Dark controls retain the shared neutral
  control surface. Empty states use the muted text role.
* Exact duplicate and superseded declarations were consolidated within selector
  and conditional context, retaining progressive syntax fallbacks. Font faces
  remain separate definitions; conditional contexts and keyframes remain intact.

## Before / after

| Metric | Before | After |
| --- | ---: | ---: |
| Stylesheets | 17 | 17 |
| Rules | 2,839 | 2,543 |
| Declarations | 9,603 | 8,090 |
| Important | 2,321 | 1,443 |
| Hardcoded hex occurrences | 831 | 695 |
| Font-size declarations | 487 | 329 |
| Exact duplicate declarations | 0 | 0 |
| Repeated selectors in the same condition | 667 | 540 |
| Cross-file selector ownership | 326 | 2 |
| Conflicting selector/property values | 1,236 | 365 |

The two cross-file owners are intentional `:root` and `:root[data-theme=dark]` token/reset scopes. Component selectors have a single file owner.

### Historical `!important` exceptions

Ordinary screen, base, layout and shared primitive owners contain **zero**
`!important` declarations. The remaining flags are confined to three protected
rendering boundaries:

| Owner | Remaining | Retained boundary |
| --- | ---: | --- |
| `mushaf.css` | 157 | Paper/line geometry, glyph sizing, combined Surah headers, persistent annotation and marker metrics, flash states and responsive layout |
| `reader.css` | 728 | Reader-specific chrome, translation/ayah panels and playback control metrics, gesture and visibility states previously defined across Reader/theme/mobile styles |
| `share.css` | 558 | Image/video preview framing, composition scaling, media tabs, orientation, full-screen and generated export presentation |
| **Total** | **1,443** | **878 fewer than baseline (37.8%)** |

These are deliberate compatibility exceptions in the protected rendering
owners, not a claim that every individual flag is inherently indispensable.
They preserve the existing cascade against inline composition values, utility
classes and nested playback/annotation states. No flags were added to ordinary
UI owners to fix a regression. Future changes to these boundaries must verify
both the affected state and the protected rendering/export output before
reducing their specificity further.

### Visual policy

Original-branch screenshots were captured from a separate, detached checkout at
the baseline SHA. Light and dark comparisons cover Home, Index, Search, Library,
Reflect, Settings and Reader at 390×844 and 1365×900. Reader references remain
original-branch baselines. Intentional corrections to neutral shared surfaces
are reviewed separately from geometry/typography regressions.

### Validation

* **23 unit tests passed**, including the existing Quran, translation/tafsir,
  audio timeline and Reflect integrity checks plus the CSS ownership contracts.
* **Production build passed.** Existing large-chunk/Browserslist warnings do not
  fail the build.
* **54 Playwright interaction/accessibility checks passed** across mobile and
  desktop: navigation, responsive overflow, passage pickers, shared surfaces,
  playback/seek/repeat/speed, saved bookmarks/highlights/studies, note persistence,
  service-worker offline reload, Help disclosures and real PNG download plus
  video preview controls.
* **28 light/dark visual comparisons passed** against the original branch's
  unchanged reference PNGs. All 28 reference files were byte-compared with the
  detached original checkout; no references were regenerated to hide differences.
* `git diff --check` passed. Reader, Quran data, recitation, annotation and export
  JavaScript were left unchanged.

The full 82-case browser run initially passed 81 checks and identified one dark
Library empty-state text mismatch. That token was corrected in the app owner;
unit tests and the production build were rerun, followed by the complete 28-case
visual matrix, which passed. No known test failures remain.

For a normal checkout:

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:e2e -- --workers=2
```

The verification environment used Chromium 153 via
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`; the Playwright CDN archive download was truncated
in this environment. The optional executable-path setting does not change normal
Playwright browser discovery. PNG export is exercised through the real download
flow; video preview/control states are exercised without depending on a live
recitation CDN or claiming a full-length video encoding benchmark.
