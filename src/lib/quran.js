import pages from '../data/quranPages16.json';
import ayahs from '../data/quranAyahs.json';
import surahInfo from '../data/surahInfo.json';
import { getJuzForReference, getPageJuz, getRevelationType } from '../data/quranMeta';

export const quranPages = pages;
export const quranAyahs = ayahs;
export const totalPages = pages.length;

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
  const firstLine = page.lines.find((line) => line.surahNumber && line.ayahStart);
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

export function searchQuran(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const pageMatch = normalized.match(/^p(?:age)?\s*(\d+)$/);
  if (pageMatch) return [{ type: 'page', page: Number(pageMatch[1]), title: `Page ${pageMatch[1]}`, subtitle: 'Open page' }];

  const refMatch = normalized.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (refMatch) {
    const page = findPageForReference(refMatch[1], refMatch[2]);
    return [{ type: 'reference', page, surahNumber: Number(refMatch[1]), ayahNumber: Number(refMatch[2]), title: `${refMatch[1]}:${refMatch[2]}`, subtitle: `Page ${page}` }];
  }

  const juzMatch = normalized.match(/^juz\s*(\d{1,2})$/);
  if (juzMatch) {
    const page = Math.max(1, Math.round(((Number(juzMatch[1]) - 1) / 30) * totalPages) + 1);
    return [{ type: 'juz', page, title: `Juz ${juzMatch[1]}`, subtitle: `Approx. page ${page}` }];
  }

  const surahResults = surahs
    .filter((surah) => `${surah.number} ${surah.name}`.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((surah) => ({ type: 'surah', page: findPageForReference(surah.number, 1), surahNumber: surah.number, title: `${surah.number}. ${surah.name}`, subtitle: `${surah.verses} verses` }));

  const ayahResults = ayahs
    .filter((ayah) => ayah.text.includes(query))
    .slice(0, 20)
    .map((ayah) => ({ type: 'ayah', page: findPageForReference(ayah.surahNumber, ayah.ayahNumber), title: `${ayah.surahNumber}:${ayah.ayahNumber}`, subtitle: ayah.text }));

  return [...surahResults, ...ayahResults].slice(0, 24);
}
