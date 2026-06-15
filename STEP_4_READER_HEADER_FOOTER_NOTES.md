# Step 4 Reader Header/Footer Notes

This patch intentionally freezes the Qur'an page body.

## Changed

- Refined passive reader header spacing and typography.
- Refined passive reader footer spacing and typography.
- Added explicit header/footer CSS positioning instead of relying on Tailwind utility strings in the React component.
- Kept muted reference-style metadata color.

## Not Changed

- `MushafPage.jsx`
- `QuranLine.jsx`
- `SurahHeader.jsx`
- `AyahMarker.jsx`
- Arabic line sizing
- Arabic word spacing
- 16-line body layout
- page body width/scaling logic

The current Arabic 16-line page body should remain visually unchanged.
