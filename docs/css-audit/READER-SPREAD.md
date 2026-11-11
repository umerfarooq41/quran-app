# Adaptive Reader spread

Implemented on `feature/tadabbur-gemini-foundation`, following the independent UI audit. The existing `MushafPage` and `QuranLine` renderers are unchanged.

## Behaviour

- Installed-app orientation permits landscape on tablet/desktop-sized screens; phone portrait locking/fallback remains. The PWA manifest allows orientation changes instead of forcing all tablets to portrait.
- Auto is the default. Portrait tablets and mobile use one page. Landscape windows need at least 900px width and room for two pages each at least 360px wide.
- Spread pages maintain a 0.64 width/height ratio, at most 576px wide, with a 24px gutter. The available width and height bound the whole spread; a 64px bottom dock keeps the shared mini-player clear of page metadata. No transform stretches a page or changes its annotation coordinate system.
- Reader layout offers Auto, Single page and Two pages. The preference persists through the existing settings store; Two pages safely falls back to single when space is insufficient.
- Pages pair 1–2, 3–4, …, 547–548. Earlier page is on the right. The store retains the exact active page independently of the visible spread.
- Each page owns its Surah/Juz header and page/quarter footer. Both travel with the page during turns. Shared top controls span the viewport; audio and translation retain their central presentation; spread slider controls open centrally instead of covering page footers.
- Swipe right, Left Arrow or Next advances one page or one spread. Opposite input returns. Mouse drag begins on a non-word margin so ayah interaction retains priority. Short drags settle back. Long-press and vertical movement do not become page turns on release.
- Page turns slide for 220ms without opacity fades. Shared controls remain stationary. Outgoing page copies retain saved annotations throughout the slide and are inert to keyboard/touch interaction. Reduced motion makes navigation immediate. Layout changes cancel transitions and retain the exact active/selected page.
- Touching an ayah on either page passes that page's identity to translation, bookmarking, playback, Share and Reflect actions. Selecting the second page updates the active page, preserving it when switching to portrait.
- Timed audio updates the active page without sliding if the word remains inside the current spread. A new spread opens when the timed word crosses its boundary. Manual browsing outside the reciting spread retains the existing return-to-recitation behaviour.
- Arrow shortcuts ignore editable fields, listboxes, controls, selected text and blocking overlays. The first/last spread cannot wrap beyond the dataset.

## Cross-page annotations

Al-Baqarah 2:54 spans both visible pages 7 and 8. Al-Baqarah 2:61 crosses the spread boundary between pages 8 and 9; the spread turns at the first timed word on page 9, and saved highlighting remains on each visible portion. Both portions retain saved highlights and the current recitation background. The word highlight advances to the correct leaf without turning the spread. Index and Library highlight navigation identify both visible ayah portions. Library bookmark navigation always opens the actual ayah-end marker page, even if the saved page was the ayah start. Only its category-colored capsule flashes; it never introduces an ayah-wide destination highlight. Navigation effects expire together and ordinary page turns do not retrigger them. The marker-page rule applies in both single-page and spread modes.

## Playback intent regression

Inspection during verification identified a loading/Pause race in the transport. The transport now interprets its displayed Pause action before source availability, rejects stale play completions by request/source identity, and keeps delayed native play events from reviving a cancelled intent. New tests delay metadata and real native play-promise completion, then verify Pause remains effective and explicit Play resumes normally.

## Verification

| Check | Actual result |
| --- | --- |
| Unit tests | 25 passed, 0 failed, 0 skipped |
| ESLint and production build | Passed |
| PostCSS/Espree architecture/import analysis | 19 active stylesheets; no missing imports, inactive stylesheets or retired dependencies; `!important` remains zero |
| Original Reader geometry | 50/50 matching comparisons at 320/375/390/430/768px in both themes |
| Full browser suite before fixture correction | 181 passed, 2 failed, 0 skipped, 0 flaky |
| Final affected Reader recheck | 22 passed, 0 failed, 0 skipped, 0 flaky |
| Distinct browser cases with passing latest results | 183/183 across the full run and final rechecks |
| Existing visual references | 76 total; 13 intentionally updated, 63 unchanged; original tolerances retained |
| TypeScript | Not configured |

The two full-run failures were the same reduced-motion fixture race on mobile and desktop: it observed the silent unlock clip, then skipped the Pause click during the real-source handoff. The helper now requires real, non-data-source native playback and always issues Pause. Traces confirmed the missing click. This strengthens autoplay verification rather than weakening the pause assertion. Every file importing that helper was rerun, together with both deterministic playback-intent tests. No production code changed after the full run. The 183-case rollup is **not** presented as a single clean full-suite run after the fixture correction.

Visual review also found that the old Reader fixture overrode only the DOM theme; changing reciter could restore the persisted light setting inside a test named dark. The fixture now starts with the persisted theme and asserts it remains selected after reciter changes. Reference updates cover the approved spread/toolbar/dock changes and the corrected dark-mode player states; their overlap accounts for 13 distinct changed files. All final affected visual comparisons passed without widening tolerances.

An earlier run also had one stalled vendor-script fetch during a hard-navigation matrix check. It did not reproduce in the unchanged focused check or the subsequent full run. No timeout, retry or service-worker exception was added.

Evidence: [test results and per-case outcomes](reader-spread-test-results.json), [geometry comparisons](reader-spread-geometry.json), [architecture inventory](reader-spread-architecture.json). Native touch/mouse/keyboard, both orientation-policy branches, exact last-page jumps, active-ayah retention, page 7–8 and 8–9 annotation behaviour, outgoing annotation frames, reduced motion and real PNG/MP4 exports are covered. Geometry checks compare the original page renderer; there was no pre-existing two-page screenshot baseline.

No confirmed UI issue remains unresolved in the exercised scope. Real hardware rotation/keyboard behaviour, other browser engines and every remote reciter remain verification limits.

Physical Android/iPad keyboards, touch hardware and Safari/WebKit are not claimed as tested. Browser touch checks use Chromium native touch events. Existing PNG/MP4 export composition is unchanged.
