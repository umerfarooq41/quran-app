# Step 2 — Reader Structure Refactor

This patch keeps the current reader behavior but moves the large `ReaderScreen.jsx` internals into small, focused feature files.

## What changed

- Added `src/features/reader/ReaderScreen.jsx` as the real reader screen.
- Kept `src/pages/ReaderScreen.jsx` as a tiny compatibility export so existing imports still work.
- Added reader components:
  - `MushafPage.jsx`
  - `QuranLine.jsx`
  - `SurahHeader.jsx`
  - `ReaderTopControls.jsx`
  - `ReaderPassiveMeta.jsx`
  - `ReaderBottomControls.jsx`
  - `PageWaveSlider.jsx`
  - `AyahActionSheet.jsx`
- Added reader hooks:
  - `useReaderGestures.js`
  - `usePagePersistence.js`

## Why

The old reader file mixed page rendering, gestures, persistence, top controls, bottom controls, ayah sheet actions, tafsir preview, share preview, bookmarks, highlights, and audio navigation in one large file.

The new structure makes the next patches safer:

1. Ayah-level selection can be fixed inside `QuranLine` / future `QuranWord`.
2. Reader design can be updated without breaking bookmark/audio/share logic.
3. Bottom sheet can be redesigned independently.
4. Page slider can be replaced independently.

## Build status

Verified with:

```bash
npm run build
```

Build completed successfully.
