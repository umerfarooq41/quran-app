import quranWords from '../../data/quranWords.json';
import englishWordMeanings from '../../data/wbw-translation-en.json';
import { qfGet } from './client';

export const WORD_BY_WORD_LANGUAGES = Object.freeze([
  { id: 'en', label: 'English', direction: 'ltr' },
  { id: 'ur', label: 'Urdu', direction: 'rtl' },
]);

const SUPPORTED_LANGUAGE_CODES = new Set(
  WORD_BY_WORD_LANGUAGES.map((language) => language.id),
);

const ALLOWED_ENGLISH_CLASSES = new Set([
  'n',
  'v',
  'p',
  'pn',
  'paren',
  'punc',
]);

const quranWordsByVerse = new Map(
  quranWords.map((verse) => [String(verse.key), verse]),
);

const wordCache = new Map();

export async function getWordByWordTranslation(surah, ayah, options = {}) {
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  const language = normalizeWordLanguage(options.language);

  validateReference(surahNumber, ayahNumber);

  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;
  if (wordCache.has(cacheKey)) return wordCache.get(cacheKey);

  const request = language === 'en'
    ? getLocalEnglishWords(surahNumber, ayahNumber)
    : getApiWords(surahNumber, ayahNumber, language, options.signal);

  if (!options.signal) wordCache.set(cacheKey, request);

  try {
    const result = await request;
    if (!options.signal) wordCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!options.signal) wordCache.delete(cacheKey);
    throw error;
  }
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

function getLocalEnglishWords(surah, ayah) {
  const verseKey = `${surah}:${ayah}`;
  const verse = quranWordsByVerse.get(verseKey);
  const rawWords = Array.isArray(verse?.words) ? verse.words : [];

  const words = rawWords
    .map((word, index) => {
      const location = word.location || `${verseKey}:${index + 1}`;
      const meaningHtml = sanitizeEnglishMeaningHtml(
        englishWordMeanings[location] || '',
      );
      const meaning = htmlToPlainText(meaningHtml);

      return {
        id: location,
        position: Number(word.word) || index + 1,
        arabic: String(word.text || ''),
        meaning,
        meaningHtml,
        transliteration: '',
        language: 'en',
      };
    })
    .filter((word) => word.meaningHtml || word.meaning);

  return Promise.resolve({
    verseKey,
    language: 'en',
    direction: 'ltr',
    source: 'local',
    words,
  });
}

async function getApiWords(surah, ayah, language, signal) {
  const data = await qfGet(`/verses/by_key/${surah}:${ayah}`, {
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
  }, { signal });

  const verse = data?.verse || data?.verses?.[0] || data;
  const rawWords = Array.isArray(verse?.words) ? verse.words : [];
  const words = rawWords
    .filter((word) => !word?.char_type_name || word.char_type_name === 'word')
    .map((word, index) => normalizeApiWord(word, index, language))
    .filter((word) => word.arabic || word.meaning);

  return {
    verseKey: verse?.verse_key || `${surah}:${ayah}`,
    language,
    direction: getWordLanguage(language).direction,
    source: 'api',
    words,
  };
}

function normalizeApiWord(word, index, requestedLanguage) {
  const translation = word?.translation;
  const translationLanguage = normalizeReturnedLanguage(
    translation?.language_name || translation?.language || requestedLanguage,
  );

  return {
    id: word.location || word.id || `word-${index + 1}`,
    position: Number(word.position) || index + 1,
    arabic: word.text_indopak || word.text_uthmani || word.text || '',
    meaning: translation?.text || translation || '',
    meaningHtml: '',
    transliteration: word.transliteration?.text || word.transliteration || '',
    language: translationLanguage,
  };
}

function sanitizeEnglishMeaningHtml(value) {
  const input = String(value || '');
  if (!input) return '';

  let output = '';
  let cursor = 0;
  const tagPattern = /<[^>]*>/g;
  let match;

  while ((match = tagPattern.exec(input))) {
    output += escapeHtml(input.slice(cursor, match.index));

    const tag = match[0];
    const opening = tag.match(
      /^<span\s+class\s*=\s*['"]([a-z]+)['"]\s*>$/i,
    );

    if (opening && ALLOWED_ENGLISH_CLASSES.has(opening[1].toLowerCase())) {
      output += `<span class="${opening[1].toLowerCase()}">`;
    } else if (/^<\/span\s*>$/i.test(tag)) {
      output += '</span>';
    }

    cursor = match.index + tag.length;
  }

  output += escapeHtml(input.slice(cursor));
  return output;
}

function htmlToPlainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
