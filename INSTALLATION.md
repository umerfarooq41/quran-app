# Quran Foundation word-by-word integration

Copy the included files into the same paths in your Quran app and replace the existing files when prompted.

## Local development

1. Keep your real credentials in the project-root `.env` file:

   QF_CLIENT_ID=...
   QF_CLIENT_SECRET=...
   QF_PROXY_PORT=8787

2. Start the secure API proxy:

   npm run qf:proxy

3. In a second terminal start Vite:

   npm run dev

The frontend requests `/api/qf/...`; Vite forwards it to the local proxy. The client secret is never exposed to the browser.

## Production / Vercel

Add `QF_CLIENT_ID` and `QF_CLIENT_SECRET` in the hosting dashboard environment variables. The included `api/qf/[...path].js` route handles authentication and proxying.

## Current feature

Settings now includes a Word-by-word translation switch. When enabled, the translation card displays Quran Foundation English word meanings between the Arabic ayah and the selected full translation.

## API structure for later features

- `src/services/quranFoundation/client.js`: reusable authenticated proxy client
- `src/services/quranFoundation/words.js`: word-by-word feature module
- `src/services/quranFoundation/index.js`: public exports

Future modules such as chapters, recitations, tafsir, and translations can be added beside `words.js` while reusing `qfGet()`.
