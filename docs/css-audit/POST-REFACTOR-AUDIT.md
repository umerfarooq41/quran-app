# Independent post-refactor UI audit

Branch: `feature/tadabbur-gemini-foundation`. Audit baseline: `d857f8802b61fafcb904441888b7db47f071716e`.
Reader comparison baseline: `33a2c4c611aa8ae7f3306b2760cc8d28ad04b535` (before the coordinated CSS refactor).

## 1. Architecture audit and fixes

PostCSS parsed all 19 source stylesheets. Espree followed static imports, re-exports and literal dynamic imports from `src/main.jsx`; selector/value parsers inventoried states, tokens, typography, spacing, radii, media conditions and literal class references. The expanded inventory also records JSX inline-style owners and arbitrary Tailwind color utilities. Compiled Tailwind utilities remain generated dependencies, not another hand-authored override layer.

| Owner inspected | Responsibility and result |
| --- | --- |
| `styles.css`, `tokens.css`, `theme.css`, `base.css` | Tailwind entry, fonts/design tokens, theme roles and document defaults. Introduction typography now shares language-specific tokens; the document font references the shared font token. Theme accent aliases the brand token. |
| `app.css`, `shared-surfaces.css` | App layout/chrome and canonical surfaces/controls. Removed superseded header declarations and obsolete selectors. Default card painting was removed from screen owners rather than defeated with more overrides. Audio-specific token definitions moved out of app layout. |
| `reader.css`, `reader-audio.css`, `mushaf.css` | Reader chrome, player and protected glyph/annotation rendering. Fixed repeated dark-theme ancestors. Restored the pre-refactor 42px narrow-screen top inset; a later base declaration had incorrectly won with 44px. Removed obsolete ring/word-highlight CSS and an effect that measured rings into state which was never rendered. Active capsule and SVG highlight paths remain intact. |
| `translation.css`, `tafsir.css` | Translation/WBW/footnotes and introduction presentation. Removed obsolete branches. Made full introduction scrolling keyboard accessible. Fixed the retained full Translation view's missing `Card` import. |
| `index.css`, `home.css`, `search.css`, `settings.css`, `help.css` | Screen layout and functional states. Canonical card surfaces now own default backgrounds/borders/shadows, including Index dark mode. Hero styling and meaningful state differences remain. Index introduction previews use the same body size, family and leading as the full introduction. |
| `tabs.css`, `reflect.css` | Library and Reflect layout/state owners. Delete red belongs only to the exposed action, not translucent card wrappers. Added the missing Highlights swipe wiring. Reflect introduction text is complete when opened, the period picker has one compact control, and passage content has no enclosing white card or inner painted body. The introduction reveal no longer fades text opacity. |
| `share.css` | Share controls, image/video previews, responsive composition. Retired unused selectors. Corrected `.webm` download naming for the actual MP4 encoder output. |

Picker accessible names include their visible selected values. Whole-card accessible names retain their visible content, including Arabic. Shared dropdown keyboard behavior now covers compact and avatar/viewport-aware Settings variants: selected-option focus, arrows, Home/End, Escape and focus return. Shared dialogs/sheets trap Tab and restore focus; Settings reset uses that shell. App-level Escape respects events already handled by a picker/dialog. Disclosures identify their content panels. Nested Index/Surah Info `main` landmarks were corrected.

ESLint was added with JavaScript recommended rules, JSX reference checks and hook-order checks. It found dead bindings/helpers and empty cleanup catches; cleanup preserves intentional idempotent media teardown. JSX undefined-component checking additionally caught the Translation view import defect. No lint rules or failing assertions were disabled.

## 2. CSS metrics

| Metric | Baseline | Final |
| --- | ---: | ---: |
| Active source stylesheets | 19 | 19 |
| Rules | 2,243 | 2,031 |
| Declarations | 7,843 | 7,172 |
| `!important` | 0 | 0 |
| Exact duplicate declarations within a rule | 0 | 0 |
| Repeated selector/context keys | 312 | 245 |
| Conflicting exact selector/context/property candidates | 210 | 21 |
| Hardcoded hexadecimal occurrences, including fallbacks/tokens | 636 | 481 |
| `font-size` declarations | 296 | 279 |
| Static absent-class selector candidates | 78 | 0 |
| Repeated dark-theme ancestor selectors | 3 | 0 |
| Missing local imports / inactive source stylesheets / retired-file dependencies | 0 / 0 / 0 | 0 / 0 / 0 |

There are **no `!important` exceptions**. The previous refactor had already reached zero; this audit found real regressions despite that count.

The 21 remaining conflicting-value candidates are intentional progressive syntax fallbacks: nine `vh`/`dvh` dimension pairs and twelve `color-mix()` paint fallbacks. They do not represent competing component owners. Repeated selector keys also include non-overlapping property groups and token scopes; deleting or moving them solely to lower a counter would not prove equivalent cascade behavior. Four inert earlier horizontal-inset declarations were also removed from responsive Mushaf blocks; their later unconditional definition already supplied the same computed geometry. See [responsive cleanup](independent-responsive-cleanup.json). The only cross-file selector keys are intentional root token/color-scheme scopes. The inventory retains 59 structural high-specificity review candidates, including scoped Reader/translation states; it does not mislabel this count as 59 confirmed defects.

The static absent-class heuristic is conservative; zero candidates is not a mathematical proof that every dynamically assembled selector is reachable. Likewise, repeated semantic token values can be intentional aliases. All 17 media-condition groups are inventoried. Responsive behavior was checked at 320, 375, 390, 430 and 768px, with existing desktop coverage at 1365px.

Machine-readable evidence: [baseline](independent-architecture-before.json), [final](independent-architecture-after.json), [CSS baseline](independent-before.json), [CSS final](independent-after.json), [declaration cleanup](independent-redundant-declarations.json), [retired legacy selectors](independent-retired-rules.json).

## 3. Visual and interaction audit

| Page/state | Light and dark verification |
| --- | --- |
| Home | Existing screenshot references, cards/navigation, all five widths; favorite swipe exposure and removal. Continue Reading hero preserved. |
| Index | Juz/Surahs, expanded card, introduction preview/full-view typography equality, all five widths, existing screenshots and accessibility checks. |
| Library | Persisted bookmark/highlight lists, tabs/menus and removal; native touch-event swipe checks for both card types. |
| Reflect | Saved cards and neutral editable fields, all four existing tabs, lesson creation/persistence/completion, questions, themes, commitment review, full introduction, passage background, compact period dropdown and keyboard navigation. Answer editing is tested with available viewport height reduced to 500px. |
| Search | Empty/query/result states, exact reference search, shared surfaces, all five widths and existing screenshots. |
| Settings / Help / About | Existing screen references; light/dark accessibility and disclosure checks; Settings listbox keyboard navigation and reset-dialog focus/escape checks; About screenshots. |
| Reader / translation / Tafsir | Existing visual references; exact pre-refactor geometry comparison; permanent capsules/highlights; native playback and cross-page word follow; translation card and retained full Translation route restored from a saved navigation snapshot. |
| Share Quran | Existing control/preview references, fullscreen behavior, actual PNG/MP4 downloads and stream inspection; additional responsive control checks are recorded in the final test results. |

Coverage describes the implementation actually present in this branch. Reflect uses Lessons/Questions/Discover/Progress (Discover contains keyword/theme browsing). Lesson content uses Reading Guidance, Surah Introduction, Read the passage, Keywords, My Reflection, Contemplation/Remembrance, Questions, Themes and Finish & Revisit. It does not expose separate screens named Prepare/Understand. Share currently exposes Audio/Background/Text; text sizing is within Text, with no separate Style tab. No speculative feature redesign was introduced to manufacture those absent labels.

## 4. Reader regression protection

The dataset integrity test checks all 114 Surahs, all ayah references and all 548 IndoPak pages for 16 rows, and resolves all 90 permanent quarter landmarks to actual rendered ayah-end markers. The browser checks the loaded IndoPak font and 16-row grid.

[Geometry evidence](independent-reader-geometry.json) compares pages **1, 7, 238, 239 and 548**, at **320/375/390/430/768px**, in **both themes**. It compares every word/ayah-marker rectangle (to 0.01 CSS px) and font size, page padding/grid/text, SVG highlight path geometry/fill and capsule dimensions/colors/transforms. Page 7 seeds all five highlight colors and four bookmark categories alongside its permanent quarter marker. Results are hashed only after full in-memory equality comparison; a mismatch fails the script. The final page in this dataset is 548.

Additional browser tests verify that quarter/bookmark capsules survive page turns without an unsolicited flash and that saved highlights render. Native audio tests cover Listen, play/pause/seek/repeat/speed, player expansion/collapse, reciter selection and close. A long-press Play test uses real Mishari timing metadata and a range-capable deterministic WAV response to verify one-tap autoplay and movement from word 3 on page 238 to word 4 on page 239 within ayah 15:60. No network timing guess substitutes for that assertion.

Translation card and Share controls retain their prior screenshot references. PNG signature/dimensions and MP4 container, duration, portrait dimensions and audio/video streams are checked from actual downloads. A non-silent fixture tone is decoded from the exported audio and measured, so an empty audio track cannot satisfy the test. [Export inspection](independent-export-inspection.json) records the available Chromium encoder's VP9/Opus MP4 output; H.264/AAC and third-party player compatibility are not claimed.

## 5. Final verification

| Check | Result |
| --- | --- |
| PostCSS/Espree architecture and import analysis | Passed; all 19 stylesheets reachable, missing imports/retired dependencies zero |
| ESLint / whitespace checks | Passed, no errors |
| Unit/integration tests | 23 passed, 0 failed, 0 skipped |
| Production build | Passed, PWA generated; advisory bundle-size warnings |
| Playwright | 137 passed, 0 failed, 0 skipped, 0 flaky; isolated run, 16.4 minutes |
| Existing visual references | 76 unchanged; comparisons passed within existing tolerances |
| Original Reader geometry | 50/50 matching comparisons |
| TypeScript | Not configured in this JavaScript project |

[Final test results](independent-test-results.json) records the actual cases and project outcomes. The responsive matrix covers 320, 375, 390, 430 and 768px in both themes; existing desktop coverage uses 1365px. Accessibility checks include axe WCAG 2A/AA and 2.1A/AA on the audited responsive routes. Native touch swipe tests cover Favorites, Bookmarks, Highlights, Reflect lessons and questions. PNG/MP4 export verification passes on mobile and desktop; decoded fixture audio measured -9.6 dB in the recorded mobile export.

Commands: `npm run lint`, `npm test`, `npm run build`, `npm run audit:architecture`, Playwright with the configured Chromium executable, and `QURAN_BASELINE_DIRECTORY=<built original checkout> node scripts/verify-reader-geometry.mjs`.

Existing visual references were not regenerated or loosened. Newly captured responsive evidence is separate from those established regression references. Test fixture corrections use actual persisted color enums and HTTP Range semantics; assertions for playback, colors, navigation and deletion remain active. The short 550 ms word is observed within the browser instead of after a potentially longer IPC round trip; real playback is not slowed or replaced. Browser concurrency is bounded at two to avoid software-renderer/recording contention; original screenshot tolerances and test timeouts remain unchanged.

## 6. Remaining issues and verification limits

No confirmed unresolved UI regression remains in the exercised scope. Remaining verification gaps are listed below; they must not be read as verified physical-device or cross-browser behavior. The static CSS audit also retains intentional fallbacks and scoped selector groups documented in section 2, rather than deleting them merely to reduce counts.

Real Android/iOS software keyboards, Safari/Firefox/WebKit, every live remote reciter/provider and third-party video-player codec compatibility were not exercised. Keyboard tests use Chromium keyboard input and viewport reduction; they are not presented as physical-device testing. Production bundle size warnings remain advisory for this data-heavy offline app. No production deployment, merge or `main` update was performed.

## 7. Commit scope

One consolidated audit/fix commit on `feature/tadabbur-gemini-foundation`, parent `d857f8802b61fafcb904441888b7db47f071716e`. The commit containing this report is the final commit reference. `main` remains at `d6d12eded2d60c285ad4b8704eb1eba545151085`.
