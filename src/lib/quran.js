import pages from '../data/quranPages16.json';
import ayahs from '../data/quranAyahs.json';
import surahInfo from '../data/surahInfo.json';
import { getJuzForReference, getPageJuz, getRevelationType } from '../data/quranMeta';
import { quranJuz } from '../data/quranJuz';
import { quranRub } from '../data/quranRub';

export const quranPages = pages;
export const quranAyahs = ayahs;
export const totalPages = pages.length;

function parseVerseKey(key) {
  const [surahNumber, ayahNumber] = String(key || '').split(':').map(Number);
  return { surahNumber, ayahNumber };
}

function firstLineForPage(page) {
  return page?.lines?.find((line) => line.surahNumber && line.ayahStart);
}


export const surahs = Object.values(surahInfo).map((info) => {
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
  return pages[Math.min(totalPages, Math.max(1, pageNumber)) - 1];
}

export function getPageMeta(pageNumber) {
  const page = getPage(pageNumber);
  const firstLine = firstLineForPage(page);
  const surah = surahs.find((item) => item.number === firstLine?.surahNumber) ?? surahs[0];
  const juz = firstLine ? getJuzForReference(firstLine.surahNumber, firstLine.ayahStart) : getPageJuz(pageNumber);
  return { surah, juz };
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



export function findPageForJuz(juzNumber) {
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
  // The 16-line IndoPak data starts after the opening display page, while many printed/mobile
  // IndoPak layouts show the visible page number one higher. Keep internal navigation 1-548,
  // but display the familiar reader page number.
  return Math.min(totalPages + 1, Math.max(1, Number(pageNumber) + 1));
}

export function searchQuran(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const pageMatch = normalized.match(/^p(?:age)?\s*(\d+)$/);
  if (pageMatch) return [{ type: 'page', page: Math.max(1, Number(pageMatch[1]) - 1), title: `Page ${pageMatch[1]}`, subtitle: 'Open page' }];

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
