# Quran App coordinated source and CI audit — 2026-11-14

## Reviewed
The GitHub main source tree, main screens, Reader/Audio and Reflect components, storage and word-by-word services, all 18 active CSS files, GitHub CI and failing E2E specs. The stylesheets have zero `!important` declarations; reviewed core screens contained no TODO/FIXME markers. These static checks do not establish runtime correctness.

## Evidence
- [Run 43589376294](https://github.com/umerfarooq41/quran-app/actions/runs/43589376294): 24/25 unit tests passed. The lone failing CSS-owner assertion required ornamental gold on the Index Read more link, conflicting with the accessibility fix. Build and Playwright were skipped.
- [Run 43585164966](https://github.com/umerfarooq41/quran-app/actions/runs/43585164966): unit tests and Vite build passed; 192/265 browser tests passed. Failures grouped around old screenshot baselines, swipe gesture expectations, retired Reader navigation arrows, Surah introduction text sizing and Reflect keyword navigation/data. Subsequent commits addressed several groups, but have not yet passed an entire E2E run.

## Changes
Update the obsolete Index CSS-owner assertion, validate the real opaque foreground and colored pseudo-element of swipe-to-delete, validate the solid Reflect passage card instead of a retired transparent variant, assert saved Quran word-location persistence, and ensure CI runs independent checks in one attempt while still failing if **any** quality gate fails. The CI step summary reports each gate separately.

## Outstanding verification
Review visual snapshot diffs against the approved app design before updating image baselines: Home, Index, Reader, Audio, Share, Search, Reflect, Settings, and light/dark states. Do not auto-accept or disable snapshot tests. Verify gestures, 16-line/page pairing, native Android haptics/back navigation, offline functionality, backup/restore, export/Share media and reciter Bismillah transitions on a debug APK.

The above is a source and CI audit, not a claim that every browser or Android runtime defect is resolved; follow the new complete CI result before release.
