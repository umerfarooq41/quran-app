import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const translationFiles = [
  'en-haleem.json',
  'en-al-maududi.json',
  'en-maarif-ul-quran.json',
  'ur-al-maududi.json',
  'ur-bayan-ul-quran.json',
];

test('local translation datasets cover every Quran ayah with non-empty source text', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const quran = await vite.ssrLoadModule('/src/lib/quran.js');
    const expectedReferences = new Set(
      quran.quranAyahs.map((ayah) => `${ayah.surahNumber}:${ayah.ayahNumber}`),
    );

    for (const file of translationFiles) {
      const raw = await readFile(resolve(root, 'public/data/translations', file), 'utf8');
      const dataset = JSON.parse(raw);
      const references = Object.keys(dataset);
      const actualReferences = new Set(references);
      const missing = [...expectedReferences].filter((key) => !actualReferences.has(key));
      const malformed = references.filter((key) => {
        const entry = dataset[key];
        const text = typeof entry === 'string' ? entry : entry?.t || entry?.text || '';
        return !(typeof text === 'string') || (entry?.f != null && (typeof entry.f !== 'object' || Array.isArray(entry.f)));
      });

      assert.equal(missing.length, 0, `${file} missing references: ${missing.slice(0, 8).join(', ')}`);
      assert.ok(references.some((key) => String(dataset[key]?.t || dataset[key]?.text || dataset[key] || '').trim()), `${file} should contain populated source text`);
      assert.equal(malformed.length, 0, `${file} has malformed translation entries: ${malformed.slice(0, 8).join(', ')}`);
    }
  } finally {
    await vite.close();
  }
});

test('Tafsir grouped verse ranges match only references inside the source range', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const translations = await vite.ssrLoadModule('/src/lib/translations.js');
    const matches = translations.tafsirRowCoversVerse;

    const grouped = { group_verse_key_from: '2:10', group_verse_key_to: '2:14' };
    assert.equal(matches(grouped, 2, 10), true);
    assert.equal(matches(grouped, 2, 12), true);
    assert.equal(matches(grouped, 2, 14), true);
    assert.equal(matches(grouped, 2, 9), false);
    assert.equal(matches(grouped, 2, 15), false);
    assert.equal(matches(grouped, 3, 1), false);

    assert.equal(matches({ verse_key: '3:5' }, 3, 5), true);
    assert.equal(matches({ verse_key: '3:5' }, 3, 6), false);
    assert.equal(matches({ group_verse_key_from: 'bad', group_verse_key_to: '3:8' }, 3, 6), false);
  } finally {
    await vite.close();
  }
});
