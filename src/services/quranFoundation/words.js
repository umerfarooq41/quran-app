import quranWords from '../../data/quranWords.json';
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
const wordPromiseCache = new Map();

const ENGLISH_WBW_URL = '/data/translations/wbw-translation-en.json';
let englishWordMeaningsPromise = null;

async function loadEnglishWordMeanings(signal) {
  if (!englishWordMeaningsPromise) {
    englishWordMeaningsPromise = fetch(ENGLISH_WBW_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load English word meanings (${response.status}).`,
          );
        }

        return response.json();
      })
      .catch((error) => {
        englishWordMeaningsPromise = null;
        throw error;
      });
  }

  if (!signal) return englishWordMeaningsPromise;

  if (signal.aborted) {
    throw new DOMException('The request was aborted.', 'AbortError');
  }

  return Promise.race([
    englishWordMeaningsPromise,
    new Promise((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The request was aborted.', 'AbortError')),
        { once: true },
      );
    }),
  ]);
}

export async function getWordByWordTranslation(surah, ayah, options = {}) {
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  const language = normalizeWordLanguage(options.language);

  validateReference(surahNumber, ayahNumber);

  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;
  if (wordCache.has(cacheKey)) return wordCache.get(cacheKey);

  let request = wordPromiseCache.get(cacheKey);
  if (!request) {
    // The shared request is intentionally not tied to a component AbortSignal.
    // Closing or changing an ayah must not cancel data that the next ayah/card
    // instance can reuse from cache.
    request = (language === 'en'
      ? getLocalEnglishWords(surahNumber, ayahNumber)
      : getApiWords(surahNumber, ayahNumber, language)
    )
      .then((result) => {
        wordCache.set(cacheKey, result);
        return result;
      })
      .finally(() => {
        wordPromiseCache.delete(cacheKey);
      });

    wordPromiseCache.set(cacheKey, request);
  }

  return waitForWordRequest(request, options.signal);
}

export function getCachedWordByWordTranslation(surah, ayah, language = 'en') {
  const cacheKey = `${normalizeWordLanguage(language)}:${Number(surah)}:${Number(ayah)}`;
  return wordCache.get(cacheKey) || null;
}

export function prefetchWordByWordTranslation(surah, ayah, options = {}) {
  if (!Number(surah) || !Number(ayah)) return Promise.resolve(null);
  return getWordByWordTranslation(surah, ayah, {
    language: options.language,
    signal: undefined,
  }).catch(() => null);
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
  wordPromiseCache.clear();
}

function waitForWordRequest(request, signal) {
  if (!signal) return request;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The request was aborted.', 'AbortError'));
  }

  return Promise.race([
    request,
    new Promise((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The request was aborted.', 'AbortError')),
        { once: true },
      );
    }),
  ]);
}

async function getLocalEnglishWords(surah, ayah, signal) {
  const englishWordMeanings = await loadEnglishWordMeanings(signal);
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
      const grammarClass = getPrimaryGrammarClass(meaningHtml);
      const arabic = String(word.text || '');
      const arabicHtml = grammarClass
        ? `<span class="${grammarClass}">${escapeHtml(arabic)}</span>`
        : escapeHtml(arabic);

      return {
        id: location,
        position: Number(word.word) || index + 1,
        arabic,
        arabicHtml,
        grammarClass,
        meaning,
        meaningHtml,
        transliteration: '',
        language: 'en',
      };
    })
    .filter((word) => word.meaningHtml || word.meaning);

  return {
    verseKey,
    language: 'en',
    direction: 'ltr',
    source: 'local-public-json',
    words,
  };
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

function getPrimaryGrammarClass(value) {
  const classes = [];
  const pattern = /<span class="([a-z]+)">/gi;
  let match;

  while ((match = pattern.exec(String(value || '')))) {
    const className = match[1].toLowerCase();
    if (
      ALLOWED_ENGLISH_CLASSES.has(className)
      && className !== 'paren'
      && className !== 'punc'
    ) {
      classes.push(className);
    }
  }

  if (classes.length === 0) return '';

  // Prefer the lexical class when explanatory particles/parentheses
  // precede the main translated word.
  return classes[classes.length - 1];
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
