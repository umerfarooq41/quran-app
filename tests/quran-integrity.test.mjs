import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPage,
  getSurah,
  getSurahAyahs,
  findPageForReference,
  quranAyahs,
  quranPages,
  surahs,
  totalPages,
} from '../src/lib/quran.js';

test('Qur’an dataset contains all 114 Surahs and a non-empty page collection', () => {
  assert.equal(surahs.length, 114);
  assert.equal(new Set(surahs.map((surah) => surah.number)).size, 114);
  assert.ok(totalPages > 0);
  assert.equal(quranPages.length, totalPages);
});

test('every Mushaf page preserves its 16-line source structure', () => {
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = getPage(pageNumber);
    assert.ok(page, `page ${pageNumber} exists`);
    assert.equal(page.lines.length, 16, `page ${pageNumber} must contain exactly 16 source lines`);
  }
});

test('every Surah has ordered Ayahs with no missing or duplicate verse numbers', () => {
  for (const surah of surahs) {
    const ayahs = getSurahAyahs(surah.number);
    assert.equal(ayahs.length, surah.verses, `Surah ${surah.number} verse count`);
    assert.deepEqual(
      ayahs.map((ayah) => ayah.ayahNumber),
      Array.from({ length: surah.verses }, (_, index) => index + 1),
      `Surah ${surah.number} Ayah sequence`,
    );
  }
});

test('Qur’an Ayah references resolve to an existing Mushaf page', () => {
  for (const ayah of quranAyahs) {
    const pageNumber = findPageForReference(ayah.surahNumber, ayah.ayahNumber);
    assert.ok(pageNumber >= 1 && pageNumber <= totalPages, `${ayah.surahNumber}:${ayah.ayahNumber} has a page`);
    assert.ok(getPage(pageNumber).lines.some((line) =>
      line.surahNumber === ayah.surahNumber
      && line.ayahStart !== null
      && ayah.ayahNumber >= line.ayahStart
      && ayah.ayahNumber <= line.ayahEnd,
    ), `${ayah.surahNumber}:${ayah.ayahNumber} appears on its resolved page`);
  }
});

test('Surah lookup returns a valid Surah for every canonical number', () => {
  for (let number = 1; number <= 114; number += 1) {
    assert.equal(getSurah(number).number, number);
  }
});
