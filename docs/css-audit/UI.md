> Current verification: [Independent post-refactor audit](POST-REFACTOR-AUDIT.md). This document records an earlier stage.

# Remaining UI cascade cleanup

Baseline: `cd5a4fce158880a0ef052c2b3746a124b5a1da7d`, on
`feature/tadabbur-gemini-foundation`. All changes remain on that feature branch.

## Result

The 1,443 remaining source CSS `!important` declarations have been resolved into
normal component/state rules. **No source CSS exceptions remain.** The unit
contract now checks Reader, audio, translation, Share and Mushaf owners as well
as the ordinary application screens.

[ui-before.json](ui-before.json) and [ui-after.json](ui-after.json) are full PostCSS
inventories. [ui-retired-selectors.json](ui-retired-selectors.json) records the
removed selector branches and declaration consolidation performed during the
ownership rewrite. The original architecture audit remains historical evidence
for the preceding commit, rather than a current list of exceptions.

| Metric | Before | After |
| --- | ---: | ---: |
| Rules | 2,543 | 2,243 |
| Declarations | 8,090 | 7,843 |
| !important | 1,443 | 0 |
| Exact duplicate declarations | 0 | 0 |
| Cross-file selector ownership | 2 | 2 |

The remaining two cross-file selector owners are the intentional root token and
color-scheme scopes; component selectors have a single file owner. Repeated
values in the inventory include intentional conditional rules and progressive
syntax fallbacks, and are not automatically treated as dead CSS.

## What changed

* `reader.css` owns Reader chrome, page controls and the ayah toolbar. Obsolete
  dark slider colors were removed so both themes use the Reader primary token.
* `reader-audio.css` owns player layout, expanded/collapsed phases, reciter
  selection, transport buttons and playback control states. Generic row layout
  now precedes the grid variants, instead of relying on flags to defeat an older
  flex layout. Audio-related footer behavior moved from the Mushaf owner here.
* `translation.css` owns translation cards, word-by-word rows and tafsir notes.
* `share.css` owns Share Quran controls and preview composition. The obsolete
  image preview height limit and rounded-corner rule were removed from its old
  selector; the preview stage supplies the image geometry. The existing desktop
  padding breakpoint follows its base definition, preserving the original width
  through the normal responsive cascade.
* `mushaf.css` owns glyph and line layout, recitation styling, saved highlights,
  marker presentation and page transitions. Base line rules precede alignment
  variants, preserving centered opening-page lines through normal source order.
* Shared back-button rules moved to `shared-surfaces.css`.
* Reduced-motion rules match the actual next/previous transition phases. This
  preserves the preference without an important declaration on a weaker generic
  selector.

The PostCSS rewrite resolved the original declaration priority for each selector
and conditional state before emitting its component definition. Superseded
properties and 226 retired selector branches were removed. Normal and important
properties were not treated as equal during that resolution. Responsive context,
keyframes, native input pseudo-elements and progressive syntax fallbacks were
preserved. Base/variant conflicts exposed by the visual checks were corrected
inside the owning definitions; no replacement override layer was introduced.

The retired-selector check is restricted to literal Reader/player/Share component
classes absent from runtime JS/JSX source. It deliberately excludes constructed
`is-*`, `tab-*`, saved-color and marker class names. No recitation, navigation,
annotation, export-generation or Quran data JavaScript changed.

## Verification

The previous 28 screen references remain unchanged. Another 48 references were
captured from the baseline implementation for Reader chrome and saved
annotations, expanded/selected/collapsed audio, reciter dropdowns, translation
navigation, and Share settings/controls. Together they exercise 76 screenshots in
light/dark themes at mobile and desktop sizes.

The decorative video raster is paused and hidden for the Share control crop, so
frame decoding cannot produce false differences behind unchanged controls. Those
reference crops were captured from a frozen copy of the baseline production
build; they were not regenerated from the refactored implementation. Fullscreen
entry/exit and real PNG download are also exercised by interaction tests.

* **23 unit tests passed**, including the extended normal-cascade contract for
  every component owner.
* **Production build passed.**
* **100 distinct Playwright cases are verified** across mobile and desktop. They
  cover the prior screen, accessibility, persistence/offline, playback and export
  suite plus the added Reader/Share states and reduced-motion phases.
* **76 light/dark screenshots** are checked by 44 visual scenarios: 28 original
  screen references and 48 additional baseline UI-state references.
* Source CSS audit: **0 important declarations**, **0 exact duplicate
  declarations**, and **2 intentional root-scope cross-file owners**.
* `git diff --check` passed. The original 28 reference PNGs were not modified.

The first 100-case run passed 95 checks. Its five failures exposed desktop Share
padding order and a fixture race that paused before native autoplay actually
started. The Share breakpoint was put after its base rule, and the fixture now
waits for native playback before clicking Pause. Unit tests and the build were
rerun, followed by all 18 added UI/motion cases plus both existing PNG export
cases: **20 passed**. The other 80 distinct browser checks had already passed;
no known failures remain.

Run the checks with:

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:e2e -- --workers=2
npm run audit:css
```

The verification environment used Chromium 153 via the existing optional
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` setting. Its browser recorder used the installed
system ffmpeg. These environment adjustments do not change the application's
build or normal browser discovery.
