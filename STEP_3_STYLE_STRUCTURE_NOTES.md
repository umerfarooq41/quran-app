# Step 3 — Style Structure Cleanup

## What changed

- Kept `src/styles.css` as the Tailwind entry file only.
- Added smaller CSS files under `src/styles/`:
  - `tokens.css` — font face, app design tokens, safe-area variables.
  - `base.css` — global resets, app backgrounds, utility helpers.
  - `reader.css` — reader page, Mushaf lines, bottom controls, ayah sheet, share sheet, reader fit rules.
  - `tabs.css` — Tabs screen, saved cards, filters, card menus.
  - `tafsir.css` — Tafsir/translation card styling.
  - `home.css` — home screen and bottom navigation polish.
- Updated `src/main.jsx` to import the CSS files in a stable cascade order.
- Removed generated local Vite log files from the packaged project.
- Added `*.log` and `*.err.log` to `.gitignore`.

## Why this step matters

The old `src/styles.css` file was too large and mixed all screen styles together. This split makes it easier to rebuild one screen at a time without breaking unrelated screens.

## Next recommended step

Step 4 should start actual visual work on the Reader screen using the new style structure:

1. Make the Reader background/page match the reference.
2. Fix line sizing and spacing screen by screen.
3. Polish passive top/bottom metadata.
4. Polish tap-revealed controls.
5. Then rebuild the bottom ayah sheet.
