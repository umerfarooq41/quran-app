import { db } from '../../lib/db';
import { qfGet } from './client';

export const WORD_BY_WORD_LANGUAGES = Object.freeze([
  { id: 'en', label: 'English', direction: 'ltr', source: 'local' },
  { id: 'ur', label: 'Urdu', direction: 'rtl', source: 'api' },
]);

const SUPPORTED_LANGUAGE_CODES = new Set(
  WORD_BY_WORD_LANGUAGES.map((language) => language.id),
);

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const wordCache = new Map();
const pendingRequests = new Map();
let englishDataPromise;

export async function getWordByWordTranslation(surah, ayah, options = {}) {
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  const language = normalizeWordLanguage(options.language);

  validateReference(surahNumber, ayahNumber);

  if (language === 'en') {
    return getLocalEnglishWords(surahNumber, ayahNumber);
  }

  return getCachedApiWords(surahNumber, ayahNumber, language, options);
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
  pendingRequests.clear();
}

async function getLocalEnglishWords(surahNumber, ayahNumber) {
  const cacheKey = `en:${surahNumber}:${ayahNumber}`;
  if (wordCache.has(cacheKey)) return wordCache.get(cacheKey);

  const { meanings, arabicByVerse } = await loadEnglishData();
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const arabicWords = arabicByVerse.get(verseKey) || [];

  const words = arabicWords
    .filter((word) => meanings[word.location] !== undefined)
    .map((word, index) => ({
      id: word.location || `en-${verseKey}-${index + 1}`,
      position: Number(word.word) || index + 1,
      arabic: word.text || '',
      meaning: htmlToPlainText(meanings[word.location]),
      transliteration: '',
      language: 'en',
      source: 'local',
    }))
    .filter((word) => word.arabic || word.meaning);

  const result = {
    verseKey,
    language: 'en',
    direction: 'ltr',
    source: 'local',
    words,
  };

  wordCache.set(cacheKey, result);
  return result;
}

async function loadEnglishData() {
  if (!englishDataPromise) {
    englishDataPromise = Promise.all([
      import('../../data/wbw-translation-en.json'),
      import('../../data/quranWords.json'),
    ]).then(([translationModule, wordsModule]) => {
      const meanings = translationModule.default || translationModule;
      const rows = wordsModule.default || wordsModule;
      const arabicByVerse = new Map(
        rows.map((row) => [row.key || `${row.surahNumber}:${row.ayahNumber}`, row.words || []]),
      );

      return { meanings, arabicByVerse };
    });
  }

  return englishDataPromise;
}

async function getCachedApiWords(surahNumber, ayahNumber, language, options) {
  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;
  const memoryValue = wordCache.get(cacheKey);
  if (memoryValue) return memoryValue;

  const stored = await db.wordTranslations.get(cacheKey).catch(() => null);
  if (stored?.result?.words?.length) {
    wordCache.set(cacheKey, stored.result);

    if (Number(stored.expiresAt) <= Date.now()) {
      refreshApiWords(surahNumber, ayahNumber, language).catch(() => {});
    }

    return stored.result;
  }

  return fetchAndCacheApiWords(surahNumber, ayahNumber, language, options);
}

async function refreshApiWords(surahNumber, ayahNumber, language) {
  return fetchAndCacheApiWords(surahNumber, ayahNumber, language, { force: true });
}

async function fetchAndCacheApiWords(surahNumber, ayahNumber, language, options = {}) {
  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;

  if (!options.force && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const request = qfGet(`/verses/by_key/${surahNumber}:${ayahNumber}`, {
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
  }, { signal: options.signal })
    .then((data) => {
      const verse = data?.verse || data?.verses?.[0] || data;
      const rawWords = Array.isArray(verse?.words) ? verse.words : [];
      const words = rawWords
        .filter((word) => !word?.char_type_name || word.char_type_name === 'word')
        .map((word, index) => normalizeApiWord(word, index, language))
        .filter((word) => word.arabic || word.meaning);

      const result = {
        verseKey: verse?.verse_key || `${surahNumber}:${ayahNumber}`,
        language,
        direction: getWordLanguage(language).direction,
        source: 'api',
        words,
      };

      const fetchedAt = Date.now();
      wordCache.set(cacheKey, result);
      db.wordTranslations.put({
        key: cacheKey,
        language,
        surahNumber,
        ayahNumber,
        result,
        fetchedAt,
        expiresAt: fetchedAt + CACHE_MAX_AGE_MS,
      }).catch(() => {});

      return result;
    })
    .finally(() => {
      if (pendingRequests.get(cacheKey) === request) pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
  return request;
}

function normalizeApiWord(word, index, requestedLanguage) {
  const translation = word?.translation;
  const translationLanguage = normalizeReturnedLanguage(
    translation?.language_name || translation?.language || requestedLanguage,
  );

  return {
    id: word.location || word.id || `word-${index + 1}`,
    position: Number(word.position) || index + 1,
    arabic: word.text_indopak || word.text_uthmani || word.text || word.code_v1 || '',
    meaning: translation?.text || translation || '',
    transliteration: word.transliteration?.text || word.transliteration || '',
    language: translationLanguage,
    source: 'api',
  };
}

function htmlToPlainText(value) {
  const html = String(value || '');
  if (!html) return '';

  if (typeof document !== 'undefined') {
    const element = document.createElement('div');
    element.innerHTML = html;
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
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
