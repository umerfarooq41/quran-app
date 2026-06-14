# Step 1 Patch Notes

## Completed

- Added central route constants in `src/app/routes.js`.
- Normalized legacy route names:
  - `bookmarks` -> `tabs`
  - `info` -> `surahInfo`
- Fixed `App.jsx` routing:
  - `surah` now opens `SurahScreen`.
  - `surahInfo` now opens `SurahInfoScreen`.
  - `tabs` opens the existing saved items screen.
- Added placeholder but working screens:
  - `src/pages/SurahScreen.jsx`
  - `src/pages/SurahInfoScreen.jsx`
- Moved page clamp logic into `src/lib/quran.js`.
- Removed hardcoded `548` from the Zustand store.
- Removed hardcoded page-count fallback from `src/data/quranMeta.js`.
- Added central helpers:
  - `clampPage()`
  - `getDisplayPageNumber()`
  - `formatReference()`
- Changed display page number behavior to match internal dataset page for now.
- Fixed page search so `page 10` opens internal page 10 instead of page 9.
- Removed manual `/sw.js` registration from `src/main.jsx` so VitePWA owns service worker generation.
- Removed dead `surah/info` route handling from `IndexScreen.jsx`.

## Build Verification

`npm run build` completed successfully.

## Next Step

Step 2 should split `ReaderScreen.jsx` into smaller reader feature components without changing the visual design yet.
