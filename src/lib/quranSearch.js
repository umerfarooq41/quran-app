import { surahArabicNames } from '../utils/quranLabels';
import {
  clampPage,
  findPageForJuz,
  findPageForReference,
  getMushafPageNumber,
  getPageMeta,
  getSurah,
  quranAyahs,
  surahs,
} from './quran';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const QURAN_MARKERS = /[\uE000-\uF8FF]/g;
const PUNCTUATION = /[^\p{L}\p{N}]+/gu;
let cachedTranslationSource = null;
let cachedTranslationIndex = [];

export function normalizeArabicSearch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(ARABIC_DIACRITICS, '')
    .replace(QURAN_MARKERS, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئىيیېے]/g, 'ي')
    .replace(/[ةۀہھ]/g, 'ه')
    .replace(/[كک]/g, 'ك')
    .replace(/[ں]/g, 'ن')
    .replace(/[ء]/g, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:سوره|سورة)\s+/, '')
    .toLocaleLowerCase();
}

export function normalizeLatinSearch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\b(?:surah|sura|chapter)\b/g, ' ')
    .replace(/['’`]/g, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchQuranImproved(query, translations = null) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  const normalizedArabic = normalizeArabicSearch(cleanQuery);
  const normalizedLatin = normalizeLatinSearch(cleanQuery);
  const compactLatin = normalizedLatin.replace(/\s+/g, '');
  const specialResult = getSpecialResult(cleanQuery);

  if (specialResult) return [specialResult];

  const surahResults = searchSurahs(normalizedArabic, normalizedLatin, compactLatin);
  const resultMap = new Map();

  AYAH_SEARCH_INDEX.forEach(({ ayah, normalizedText, preview }) => {
    if (!normalizedArabic || !normalizedText.includes(normalizedArabic)) return;

    const result = createAyahResult(ayah, preview, 'Arabic text');
    resultMap.set(`${ayah.surahNumber}:${ayah.ayahNumber}`, result);
  });

  getTranslationIndex(translations).forEach((entry) => {
    if (
      (!normalizedArabic && !normalizedLatin) ||
      (
        !entry.normalizedArabic.includes(normalizedArabic) &&
        !entry.normalizedLatin.includes(normalizedLatin)
      ) ||
      resultMap.has(entry.reference)
    ) {
      return;
    }

    const [surahNumber, ayahNumber] = entry.reference.split(':').map(Number);
    resultMap.set(entry.reference, createAyahResult(
      { surahNumber, ayahNumber },
      entry.text,
      'Translation',
    ));
  });

  return [
    ...surahResults,
    ...Array.from(resultMap.values()).slice(0, Math.max(0, 30 - surahResults.length)),
  ].slice(0, 30);
}

function searchSurahs(normalizedArabic, normalizedLatin, compactLatin) {
  if (!normalizedArabic && !normalizedLatin) return [];

  return surahs
    .map((surah) => {
      const arabicName = surahArabicNames[surah.number] || '';
      const englishName = SURAH_ENGLISH_NAMES[surah.number] || '';
      const normalizedName = normalizeLatinSearch(surah.name);
      const normalizedEnglishName = normalizeLatinSearch(englishName);
      const compactName = normalizedName.replace(/\s+/g, '');
      const withoutArticle = normalizedName.replace(/^(?:al|an|as|at|ar|az)\s+/, '');
      const arabicMatch = normalizedArabic && normalizeArabicSearch(arabicName).includes(normalizedArabic);
      const latinMatch = normalizedLatin && (
        normalizedName.includes(normalizedLatin) ||
        withoutArticle.includes(normalizedLatin) ||
        compactName.includes(compactLatin) ||
        normalizedEnglishName.includes(normalizedLatin)
      );
      const numberMatch = normalizedLatin === String(surah.number);

      if (!arabicMatch && !latinMatch && !numberMatch) return null;

      let score = 4;
      if (numberMatch) score = 0;
      else if (
        normalizedName === normalizedLatin ||
        normalizedEnglishName === normalizedLatin ||
        normalizeArabicSearch(arabicName) === normalizedArabic
      ) score = 1;
      else if (normalizedName.startsWith(normalizedLatin) || withoutArticle.startsWith(normalizedLatin)) score = 2;
      else if (compactName.startsWith(compactLatin)) score = 3;

      const page = findPageForReference(surah.number, 1);
      return {
        type: 'surah',
        score,
        page,
        surahNumber: surah.number,
        ayahNumber: 1,
        surahName: surah.name,
        arabicSurahName: arabicName,
        englishSurahName: englishName,
        title: surah.name,
        preview: `${englishName ? `${englishName} · ` : ''}${surah.verses} ayahs · Page ${getMushafPageNumber(page)}`,
        matchType: 'Surah',
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.score - second.score || first.surahNumber - second.surahNumber)
    .slice(0, 8);
}

function createAyahResult(ayah, preview, matchType) {
  const surah = getSurah(ayah.surahNumber);
  return {
    type: 'ayah',
    page: findPageForReference(ayah.surahNumber, ayah.ayahNumber),
    surahNumber: Number(ayah.surahNumber),
    ayahNumber: Number(ayah.ayahNumber),
    surahName: surah?.name || `Surah ${ayah.surahNumber}`,
    arabicSurahName: surahArabicNames[ayah.surahNumber] || '',
    title: `${surah?.name || `Surah ${ayah.surahNumber}`} ${ayah.ayahNumber}`,
    preview,
    matchType,
  };
}

function getSpecialResult(query) {
  // Parse ayah references before generic normalization strips punctuation.
  // Supports 2:255, 2.255, 2-255, 2 255 and "Surah 2 Ayah 255".
  const rawQuery = String(query || '').normalize('NFKD').toLocaleLowerCase().trim();
  const referenceMatch = rawQuery.match(/^(?:surah|sura|chapter)?\s*(\d{1,3})\s*(?::|\.|-|\s+)\s*(?:ayah|verse)?\s*(\d{1,3})$/);
  if (referenceMatch) {
    const surahNumber = Number(referenceMatch[1]);
    const ayahNumber = Number(referenceMatch[2]);
    const surah = surahs.find((item) => item.number === surahNumber);
    if (!surah || ayahNumber < 1 || ayahNumber > surah.verses) return null;

    return createAyahResult(
      { surahNumber, ayahNumber },
      `Open ${surah.name}, ayah ${ayahNumber}`,
      'Reference',
    );
  }

  const normalized = normalizeLatinSearch(query);
  const pageMatch = normalized.match(/^p(?:age)?\s*(\d+)$/);
  if (pageMatch) {
    const page = clampPage(pageMatch[1]);
    return {
      type: 'page',
      page,
      surahName: getSurahForPage(page),
      title: `Page ${getMushafPageNumber(page)}`,
      preview: 'Open Quran page',
      matchType: 'Page',
    };
  }

  const juzMatch = normalized.match(/^juz\s*(\d{1,2})$/);
  if (juzMatch) {
    const juzNumber = Math.min(30, Math.max(1, Number(juzMatch[1])));
    const page = findPageForJuz(juzNumber);
    return {
      type: 'juz',
      page,
      surahName: getSurahForPage(page),
      title: `Juz ${juzNumber}`,
      preview: `Starts on page ${getMushafPageNumber(page)}`,
      matchType: 'Juz',
    };
  }

  return null;
}

function getTranslationIndex(translations) {
  if (!translations) return [];
  if (translations === cachedTranslationSource) return cachedTranslationIndex;

  cachedTranslationSource = translations;
  cachedTranslationIndex = Object.entries(translations).map(([reference, text]) => ({
    reference,
    text: String(text || ''),
    normalizedArabic: normalizeArabicSearch(text),
    normalizedLatin: normalizeLatinSearch(text),
  }));
  return cachedTranslationIndex;
}

function cleanAyahPreview(text) {
  return String(text || '')
    .replace(QURAN_MARKERS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSurahForPage(page) {
  return getPageMeta(page)?.surah?.name || 'Quran';
}

const AYAH_SEARCH_INDEX = quranAyahs.map((ayah) => ({
  ayah,
  normalizedText: normalizeArabicSearch(ayah.text),
  preview: cleanAyahPreview(ayah.text),
}));

const SURAH_ENGLISH_NAMES = [
  '',
  'The Opening', 'The Cow', 'Family of Imran', 'The Women', 'The Table Spread',
  'The Cattle', 'The Heights', 'The Spoils of War', 'The Repentance', 'Jonah',
  'Hud', 'Joseph', 'The Thunder', 'Abraham', 'The Rocky Tract', 'The Bee',
  'The Night Journey', 'The Cave', 'Mary', 'Ta-Ha', 'The Prophets',
  'The Pilgrimage', 'The Believers', 'The Light', 'The Criterion', 'The Poets',
  'The Ant', 'The Stories', 'The Spider', 'The Romans', 'Luqman',
  'The Prostration', 'The Combined Forces', 'Sheba', 'Originator', 'Ya-Sin',
  'Those Who Set the Ranks', 'Sad', 'The Groups', 'The Forgiver',
  'Explained in Detail', 'The Consultation', 'The Ornaments of Gold',
  'The Smoke', 'The Crouching', 'The Sandhills', 'Muhammad', 'The Victory',
  'The Rooms', 'Qaf', 'The Winnowing Winds', 'The Mount', 'The Star',
  'The Moon', 'The Most Merciful', 'The Inevitable', 'The Iron',
  'The Pleading Woman', 'The Exile', 'She That Is To Be Examined', 'The Ranks',
  'Friday', 'The Hypocrites', 'Mutual Disillusion', 'Divorce',
  'The Prohibition', 'The Sovereignty', 'The Pen', 'The Reality',
  'The Ascending Stairways', 'Noah', 'The Jinn', 'The Enshrouded One',
  'The Cloaked One', 'The Resurrection', 'Man', 'The Emissaries',
  'The Tidings', 'Those Who Drag Forth', 'He Frowned', 'The Overthrowing',
  'The Cleaving', 'Defrauding', 'The Splitting Open',
  'The Mansions of the Stars', 'The Nightcomer', 'The Most High',
  'The Overwhelming', 'The Dawn', 'The City', 'The Sun', 'The Night',
  'The Morning Hours', 'The Relief', 'The Fig', 'The Clot', 'The Power',
  'The Clear Proof', 'The Earthquake', 'The Courser', 'The Calamity',
  'Rivalry in World Increase', 'The Declining Day', 'The Traducer',
  'The Elephant', 'Quraysh', 'Small Kindnesses', 'Abundance',
  'The Disbelievers', 'Divine Support', 'Palm Fiber', 'Sincerity',
  'Daybreak', 'Mankind',
];
