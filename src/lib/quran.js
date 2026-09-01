import rawPages from '../data/quranPages16.json';
import rawAyahs from '../data/quranAyahs.json';
import rawWords from '../data/quranWords.json';
import surahInfoUrdu from '../data/surahInfo.json';
import surahInfoEnglish from '../data/surahInfoEn.json';
import { getJuzForReference, getPageJuz, getRevelationType } from '../data/quranMeta';
import { quranJuz } from '../data/quranJuz';
import { quranRub } from '../data/quranRub';
import { normalizeMushafAyah, normalizeMushafPage } from './mushafText';
import { getIndoPakParaQuarterTargets } from '../data/indoPakParaQuarters';

const pages = rawPages.map(normalizeMushafPage);
const ayahs = rawAyahs.map(normalizeMushafAyah);

const WORD_ID_BY_VERSE_POSITION = new Map();
rawWords.forEach((verse) => {
  const surahNumber = Number(verse?.surahNumber);
  const ayahNumber = Number(verse?.ayahNumber);
  (Array.isArray(verse?.words) ? verse.words : []).forEach((word) => {
    const position = Number(word?.word);
    const id = Number(word?.id);
    if (
      Number.isInteger(surahNumber)
      && Number.isInteger(ayahNumber)
      && Number.isInteger(position)
      && Number.isInteger(id)
    ) {
      WORD_ID_BY_VERSE_POSITION.set(`${surahNumber}:${ayahNumber}:${position}`, id);
    }
  });
});

export const quranPages = pages;
export const quranAyahs = ayahs;
export const totalPages = pages.length;

export function clampPage(pageNumber) {
  return Math.min(totalPages, Math.max(1, Number(pageNumber) || 1));
}

export function getDisplayPageNumber(pageNumber) {
  return clampPage(pageNumber);
}

export function formatReference(surahNumber, ayahNumber) {
  return `${Number(surahNumber) || 1}:${Number(ayahNumber) || 1}`;
}

function parseVerseKey(key) {
  const [surahNumber, ayahNumber] = String(key || '').split(':').map(Number);
  return { surahNumber, ayahNumber };
}

function firstLineForPage(page) {
  return page?.lines?.find((line) => line.surahNumber && line.ayahStart);
}


export const surahs = Object.values(surahInfoUrdu).map((info) => {
  const surahNumber = Number(info.surah_number);
  return {
    number: surahNumber,
    name: info.surah_name,
    verses: ayahs.filter((ayah) => ayah.surahNumber === surahNumber).length,
    revelation: getRevelationType(surahNumber),
    juz: getJuzForReference(surahNumber, 1),
    text: info.text,
    shortText: info.short_text,
  };
});

export function getPage(pageNumber) {
  return pages[clampPage(pageNumber) - 1];
}

export function getPageMeta(pageNumber) {
  const page = getPage(pageNumber);
  const firstLine = firstLineForPage(page);
  const surah = surahs.find((item) => item.number === firstLine?.surahNumber) ?? surahs[0];
  const juz = firstLine ? getJuzForReference(firstLine.surahNumber, firstLine.ayahStart) : getPageJuz(pageNumber, totalPages);
  return { surah, juz };
}


export function getSurahInfo(number, language = 'ur') {
  const safeNumber = String(Number(number) || 1);
  const source = String(language).toLowerCase().startsWith('en')
    ? surahInfoEnglish
    : surahInfoUrdu;
  const info = source[safeNumber] || source['1'];

  return {
    number: Number(info?.surah_number) || Number(safeNumber),
    name: info?.surah_name || getSurah(safeNumber)?.name || '',
    text: info?.text || '',
    shortText: info?.short_text || '',
  };
}

export function getSurah(number) {
  return surahs.find((surah) => surah.number === Number(number)) ?? surahs[0];
}

export function getSurahAyahs(number) {
  return ayahs.filter((ayah) => ayah.surahNumber === Number(number));
}

export function findPageForReference(surahNumber, ayahNumber = 1) {
  const page = pages.find((candidate) =>
    candidate.lines.some((line) =>
      line.surahNumber === Number(surahNumber) &&
      line.ayahStart !== null &&
      Number(ayahNumber) >= line.ayahStart &&
      Number(ayahNumber) <= line.ayahEnd,
    ),
  );
  return page?.page ?? 1;
}

/**
 * Return the exact Mushaf page that contains a timed Quran word. This matters
 * for the uncommon case where one ayah continues across a page boundary: the
 * ayah-level page is still the previous page until the ayah ends, while the
 * recited word may already be visible on the next page.
 */
export function findPageForWordPosition(surahNumber, ayahNumber, wordPosition) {
  const safeSurah = Number(surahNumber);
  const safeAyah = Number(ayahNumber);
  const safePosition = Number(wordPosition);
  const wordId = WORD_ID_BY_VERSE_POSITION.get(`${safeSurah}:${safeAyah}:${safePosition}`);
  if (!Number.isInteger(wordId)) return findPageForReference(safeSurah, safeAyah);

  const page = pages.find((candidate) => candidate.lines.some((line) => (
    line.type === 'ayah'
    && Number.isInteger(Number(line.firstWordId))
    && Number.isInteger(Number(line.lastWordId))
    && wordId >= Number(line.firstWordId)
    && wordId <= Number(line.lastWordId)
  )));

  return page?.page ?? findPageForReference(safeSurah, safeAyah);
}

export function getAyahMarkerPage(surahNumber, ayahNumber) {
  const safeSurah = Number(surahNumber);
  const safeAyah = Number(ayahNumber);
  const targetAyah = ayahs.find((ayah) => (
    ayah.surahNumber === safeSurah &&
    ayah.ayahNumber === safeAyah
  ));
  const marker = findLastPrivateUseCharacter(targetAyah?.text);
  if (!marker) return null;

  const markerPage = pages.find((candidate) => candidate.lines.some((line) => (
    line.type === 'ayah' &&
    line.surahNumber === safeSurah &&
    line.ayahStart <= safeAyah &&
    line.ayahEnd >= safeAyah &&
    line.text.includes(marker)
  )));

  return markerPage?.page ?? null;
}



export function findPageForJuz(juzNumber) {
  const indoPakStart = getIndoPakParaQuarterTargets(juzNumber).find((target) => target.id === 'start');
  if (indoPakStart?.page) return clampPage(indoPakStart.page);

  const juz = quranJuz[String(juzNumber)];
  const start = parseVerseKey(juz?.first_verse_key);
  return findPageForReference(start.surahNumber || 1, start.ayahNumber || 1);
}

export function findPageForRub(rubNumber) {
  const rub = quranRub[String(rubNumber)];
  const start = parseVerseKey(rub?.first_verse_key);
  return findPageForReference(start.surahNumber || 1, start.ayahNumber || 1);
}

export function getJuzQuarterTargets(juzNumber) {
  const startRub = (Number(juzNumber) - 1) * 8 + 1;
  return [
    { label: 'Start', rubNumber: startRub },
    { label: "Ar-Ruba' (¼)", rubNumber: startRub + 2 },
    { label: 'An-Nisf (½)', rubNumber: startRub + 4 },
    { label: 'Ath-Thalatha (¾)', rubNumber: startRub + 6 },
  ].map((item) => {
    const rub = quranRub[String(item.rubNumber)] || quranRub[String(startRub)];
    const start = parseVerseKey(rub?.first_verse_key);
    const page = findPageForReference(start.surahNumber || 1, start.ayahNumber || 1);
    return { ...item, page, surahNumber: start.surahNumber || 1, ayahNumber: start.ayahNumber || 1 };
  });
}

export function getMushafPageNumber(pageNumber) {
  return getDisplayPageNumber(pageNumber);
}

export function searchQuran(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const pageMatch = normalized.match(/^p(?:age)?\s*(\d+)$/);
  if (pageMatch) {
    const page = clampPage(pageMatch[1]);
    return [{ type: 'page', page, title: `Page ${getDisplayPageNumber(page)}`, subtitle: 'Open page' }];
  }

  const refMatch = normalized.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (refMatch) {
    const page = findPageForReference(refMatch[1], refMatch[2]);
    return [{ type: 'reference', page, surahNumber: Number(refMatch[1]), ayahNumber: Number(refMatch[2]), title: `${refMatch[1]}:${refMatch[2]}`, subtitle: `Page ${getMushafPageNumber(page)}` }];
  }

  const juzMatch = normalized.match(/^juz\s*(\d{1,2})$/);
  if (juzMatch) {
    const juzNumber = Number(juzMatch[1]);
    const page = findPageForJuz(juzNumber);
    const start = parseVerseKey(quranJuz[String(juzNumber)]?.first_verse_key);
    return [{ type: 'juz', page, surahNumber: start.surahNumber, ayahNumber: start.ayahNumber, title: `Juz ${juzNumber}`, subtitle: `Page ${getMushafPageNumber(page)}` }];
  }

  const surahResults = surahs
    .filter((surah) => `${surah.number} ${surah.name}`.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((surah) => ({ type: 'surah', page: findPageForReference(surah.number, 1), surahNumber: surah.number, ayahNumber: 1, title: `${surah.number}. ${surah.name}`, subtitle: `${surah.verses} verses · Page ${getMushafPageNumber(findPageForReference(surah.number, 1))}` }));

  const ayahResults = ayahs
    .filter((ayah) => ayah.text.includes(query))
    .slice(0, 20)
    .map((ayah) => {
      const page = findPageForReference(ayah.surahNumber, ayah.ayahNumber);
      return { type: 'ayah', page, surahNumber: ayah.surahNumber, ayahNumber: ayah.ayahNumber, title: `${ayah.surahNumber}:${ayah.ayahNumber}`, subtitle: `${ayah.text} · Page ${getMushafPageNumber(page)}` };
    });

  return [...surahResults, ...ayahResults].slice(0, 24);
}

function findLastPrivateUseCharacter(text = '') {
  const characters = Array.from(text);

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const codePoint = characters[index].codePointAt(0);
    if (codePoint >= 0xE000 && codePoint <= 0xF8FF) {
      return characters[index];
    }
  }

  return '';
}