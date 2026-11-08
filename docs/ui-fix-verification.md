# Coordinated UI verification

Branch: `feature/tadabbur-gemini-foundation`.

## Final behavior

The Reader automatically selects its layout. There is no layout selector in Reader or Settings, and obsolete stored layout preferences are ignored. Single-page navigation advances one page; side-by-side navigation pairs 1–2, 3–4, 5–6. The earlier PDF pairing instruction is superseded by the user's clarification.

## Root causes and changes

- Settings, Share and the player independently implemented menus inside transformed, blurred and clipped ancestors. All now use `AppOptionPicker`, with native top-layer rendering, viewport collision handling, solid cream/dark menu surfaces, bounded scrolling and shared keyboard behavior. Focus scrolling stays inside the listbox.
- The player reciter used a bordered nested picker and a separate expanding list. It now uses the shared picker with an unbordered avatar/name/chevron trigger.
- Search and Index had separate input styling and conflicting focus rules. `SearchField` now also serves Reflect question/theme searches. Main Search retains live matching and keyboard submission; the redundant submit button is removed. Clearing keeps input focus.
- Swipe gestures and action geometry were duplicated. `SwipeActions` now owns touch/mouse drag, axis locking, thresholds and click suppression. The action translates into the revealed strip instead of lying beneath translucent foreground content. Existing confirmation/removal handlers remain feature-owned.
- Every timed word rerendered unrelated Quran lines. Memoized lines now receive timed-word state only when their verse range contains the active ayah. Stable event bridges preserve current interactions. Geometry measurement remains independent of word-position changes.
- The Reader reloaded all annotations on every page change. Annotation loading now follows mount/annotation changes, preserving the same maps during page turns. Exact recitation-page state still updates within a stationary spread so rotation and persistence retain the correct leaf.
- Superseded picker/search/swipe CSS was removed from its owners. No `!important` rules were added; the architecture audit reports zero.

## Requirements

| Brief section | Result |
| --- | --- |
| 1. Recitation highlighting | Relevant-line updates; saved/live overlays remain independent. Timed-word and saved-highlight tests pass across visible pages and spread boundaries. |
| 2. Player reciter | Compact integrated row; shared avatar listbox; switching reciter and continued controls tested. |
| 3. Responsive layout | Automatic only, per the latest instruction. All six requested viewports verified. |
| 4. Spread navigation | User-approved 1–2 / 3–4 pairing retained. RTL order, keyboard, mouse/touch and reduced-motion behavior verified. |
| 5. Bookmark/highlight navigation | Marker-page bookmarks and existing marker feedback retained; no whole-ayah bookmark flash. Saved highlights across visible pages and quarter-marker persistence verified. |
| 6. Search fields | Shared input on Search, Index Surahs, Reflect Questions and theme search; no change to matching/indexing. No Juz/Library search input existed to replace. |
| 7. Reader Search | Top duplicate removed; bottom Search retained. |
| 8. Translator menu | Shared top-layer listbox prevents sibling-card occlusion; viewport, selection, Escape, focus and scrolling tested. |
| 9. Settings reciter | Same architecture as Translator; avatars, long names and selected state retained. |
| 10. Other dropdowns | Share Surah/From/To/reciter, Reflect range and Progress period all use the shared picker. No other JSX listbox/select implementation remains. |
| 11. Reflect passage | Existing bare passage section was already card-free and is retained. Neutral saved cards/answer fields, lesson persistence and interactions verified. |
| 12. Swipe actions | Shared by Bookmarks, Highlights, Favorites, Reflect Questions/Lessons. Partial-reveal geometry and vertical-gesture rejection verified in both themes. |
| 13. Audio progress | Elapsed/total labels have explicit accessible names; original RTL time/slider arrangement retained. Pause/resume, seek, repeat and speed tested; no source-selection logic changed. |
| 14. UI consistency | Shared menu/search/swipe architecture; neutral surfaces retained. Home, Reader, Index, Search, Library, Settings, Help, Reflect and Share checks included. |

## Verification

- `npm run build`: passes, including PWA service-worker generation. Existing large-chunk warning remains.
- `npm run lint`: passes.
- `npm test`: 25 tests pass, including translation/Tafsir integrity and responsive layout.
- Browser run A: 29 checks pass covering requested viewports, light/dark dropdowns/search/swipes, audio transport, loading/pause races, saved lessons/bookmarks/highlights, offline cold reload and cross-page recitation.
- Browser run B: 35 checks pass covering final Settings/focus behavior, compact reciter switching, neutral Reflect/Help surfaces, Share image export, permanent markers, long-press playback across pages 238–239, spread controls, rotation and gestures.
- Desktop checks: 13 responsive/menu/search/swipe/audio checks passed. The Share test initially expected a video-only reciter control in image mode; it was corrected to select Video before testing that control.
- Final focused mobile/desktop run: 4 checks pass for Share Surah/From/To/reciter selection and compact audio controls.
- Architecture audit: 19 CSS files, zero `!important` declarations. Static audit candidates are not treated as proven defects.
- `git diff --check`: passes.

| Viewport | Actual Reader layout |
| --- | --- |
| 390 × 844 | Single page |
| 844 × 390 | Single page |
| 768 × 1024 | Single page |
| 1024 × 768 | Two pages |
| 1280 × 800 | Two pages |
| 1440 × 900 | Two pages |

Browser verification used Chromium. A compatible standalone Chromium was used after the standard download failed; failure-video recording was disabled because the Playwright FFmpeg package was unavailable. Screenshots, native media playback and browser interaction checks still ran. Mobile Settings menus, the compact player and light/dark spreads were visually reviewed.

Audio tests use generated WAV media with the repository's production timing data. They validate control/synchronization behavior, not the availability of every live reciter CDN recording. The optional local Quran Foundation proxy was unavailable; local translation data and offline paths were exercised. Physical Android/iOS, other browser engines and an exhaustive full-Quran live-recitation run remain unverified. No data migration or Mushaf typography/page-data changes were introduced.

## Changed files

- `docs/ui-fix-verification.md`
- `src/components/common/Dropdown.jsx`
- `src/components/common/SearchField.jsx`
- `src/components/common/SwipeActions.jsx`
- `src/features/reader/ReaderScreen.jsx`
- `src/features/reader/components/MushafPage.jsx`
- `src/features/reader/components/QuranLine.jsx`
- `src/features/reader/components/ReaderAudioPanel.jsx`
- `src/features/reader/components/ReaderTopControls.jsx`
- `src/features/reader/components/ShareAyahSheet.jsx`
- `src/features/reader/hooks/useReaderLayout.js`
- `src/features/reflect/components/QuestionsTab.jsx`
- `src/features/reflect/components/StudiesTab.jsx`
- `src/features/reflect/components/ThemeEditorSheet.jsx`
- `src/pages/BookmarksScreen.jsx`
- `src/pages/HomeScreen.jsx`
- `src/pages/IndexScreen.jsx`
- `src/pages/ReflectScreen.jsx`
- `src/pages/SearchScreen.jsx`
- `src/pages/SettingsScreen.jsx`
- `src/store/useAppStore.js`
- `src/styles/home.css`
- `src/styles/index.css`
- `src/styles/reader-audio.css`
- `src/styles/reader.css`
- `src/styles/search.css`
- `src/styles/settings.css`
- `src/styles/share.css`
- `src/styles/shared-surfaces.css`
- `src/styles/tabs.css`
- `src/styles/tokens.css`
- `tests/e2e/coordinated-ui-fixes.spec.js`
- `tests/e2e/independent-responsive.spec.js`
- `tests/e2e/reader-regression.spec.js`
- `tests/e2e/reader-spread.spec.js`
- `tests/e2e/reader-ui-states.spec.js`
- `tests/e2e/shared-surfaces.spec.js`
- `tests/reader-layout.test.mjs`
