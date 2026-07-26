import { qfGet } from './client';

export const WORD_BY_WORD_LANGUAGES = Object.freeze([
  { id: 'en', label: 'English', direction: 'ltr' },
  { id: 'ur', label: 'Urdu', direction: 'rtl' },
]);

const SUPPORTED_LANGUAGE_CODES = new Set(
  WORD_BY_WORD_LANGUAGES.map((language) => language.id),
);

const wordCache = new Map();

export async function getWordByWordTranslation(surah, ayah, options = {}) {
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  const language = normalizeWordLanguage(options.language);

  validateReference(surahNumber, ayahNumber);

  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;
  if (!options.signal && wordCache.has(cacheKey)) return wordCache.get(cacheKey);

  const data = await qfGet(`/verses/by_key/${surahNumber}:${ayahNumber}`, {
    words: true,
    language,
    word_fields: [
      'text_indopak',
      'text_uthmani',
      'translation',
      'transliteration',
      'location',
      'char_type_name',
      'position',
    ].join(','),
  }, { signal: options.signal });

  const verse = data?.verse || data?.verses?.[0] || data;
  const rawWords = Array.isArray(verse?.words) ? verse.words : [];
  const words = rawWords
    .filter((word) => !word?.char_type_name || word.char_type_name === 'word')
    .map((word, index) => normalizeWord(word, index, language))
    .filter((word) => word.arabic || word.meaning);

  const result = {
    verseKey: verse?.verse_key || `${surahNumber}:${ayahNumber}`,
    language,
    direction: getWordLanguage(language).direction,
    words,
  };

  if (!options.signal) wordCache.set(cacheKey, result);
  return result;
}

export function getWordLanguage(language) {
  const code = normalizeWordLanguage(language);
  return WORD_BY_WORD_LANGUAGES.find((item) => item.id === code)
    || WORD_BY_WORD_LANGUAGES[0];
}

export function normalizeWordLanguage(language) {
  const code = String(language || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGE_CODES.has(code) ? code : 'en';
}

export function clearWordTranslationCache() {
  wordCache.clear();
}

function normalizeWord(word, index, requestedLanguage) {
  const translation = word?.translation;
  const translationLanguage = normalizeReturnedLanguage(
    translation?.language_name || translation?.language || requestedLanguage,
  );

  return {
    id: word.location || word.id || `word-${index + 1}`,
    position: Number(word.position) || index + 1,
    arabic: word.text_indopak || word.text_uthmani || word.text || '',
    meaning: translation?.text || translation || '',
    transliteration: word.transliteration?.text || word.transliteration || '',
    language: translationLanguage,
  };
}

function normalizeReturnedLanguage(language) {
  const value = String(language || '').toLowerCase();
  if (value === 'urdu' || value === 'ur') return 'ur';
  if (value === 'english' || value === 'en') return 'en';
  return value || null;
}

function validateReference(surah, ayah) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Invalid Surah number.');
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new Error('Invalid Ayah number.');
  }
}
