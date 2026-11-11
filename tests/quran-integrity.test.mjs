import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('Qur’an dataset has 114 ordered Surahs and intact 16-line Mushaf pages', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const quran = await vite.ssrLoadModule('/src/lib/quran.js');
    assert.equal(quran.surahs.length, 114);
    assert.equal(new Set(quran.surahs.map((surah) => surah.number)).size, 114);
    assert.equal(quran.quranPages.length, quran.totalPages);

    for (const [index, surah] of quran.surahs.entries()) {
      assert.equal(surah.number, index + 1, `Surah order at index ${index}`);
      const verses = quran.getSurahAyahs(surah.number);
      assert.equal(verses.length, surah.verses, `Ayah count for Surah ${surah.number}`);
      assert.deepEqual(
        verses.map((ayah) => ayah.ayahNumber),
        Array.from({ length: surah.verses }, (_, ayahIndex) => ayahIndex + 1),
        `Ayah numbering for Surah ${surah.number}`,
      );
    }

    for (const page of quran.quranPages) {
      assert.equal(page.lines.length, 16, `Mushaf page ${page.page} line count`);
    }

    const { default: quarters } = await vite.ssrLoadModule('/src/data/indoPakParaQuarters.js');
    const permanent = Object.values(quarters).flat().filter(target => target.id !== 'start');
    assert.equal(permanent.length, 90, 'Three permanent quarter landmarks per Juz');
    assert.equal(new Set(permanent.map(target => `${target.surah}:${target.ayah}`)).size, 90);
    for (const target of permanent) {
      const markerPage = quran.getAyahMarkerPage(target.surah, target.ayah);
      assert.ok(markerPage >= 1 && markerPage <= quran.totalPages,
        `Quarter ${target.surah}:${target.ayah} has a rendered ayah-end marker`);
    }

    for (const ayah of quran.quranAyahs) {
      const pageNumber = quran.findPageForReference(ayah.surahNumber, ayah.ayahNumber);
      assert.ok(pageNumber >= 1 && pageNumber <= quran.totalPages, `Page exists for ${ayah.surahNumber}:${ayah.ayahNumber}`);
      const page = quran.getPage(pageNumber);
      assert.ok(
        page.lines.some((line) => line.surahNumber === ayah.surahNumber
          && line.ayahStart !== null
          && ayah.ayahNumber >= line.ayahStart
          && ayah.ayahNumber <= line.ayahEnd),
        `Ayah ${ayah.surahNumber}:${ayah.ayahNumber} resolves to a page containing it`,
      );
    }
  } finally {
    await vite.close();
  }
});
