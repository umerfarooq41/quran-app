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

const LOCAL_WBW_URLS = { en: '/data/translations/wbw-translation-en.json', ur: '/data/translations/wbw-translation-ur.json' };
const localMeaningsPromises = new Map();

async function loadLocalWordMeanings(language, signal) {
  if (!localMeaningsPromises.has(language)) {
    const request = fetch(LOCAL_WBW_URLS[language], {
      method: 'GET', headers: { Accept: 'application/json' },
    }).then(response => {
      if (!response.ok) throw new Error(`Unable to load ${language} word meanings (${response.status}).`);
      return response.json();
    }).catch(error => {
      localMeaningsPromises.delete(language);
      throw error;
    });
    localMeaningsPromises.set(language, request);
  }
  return waitForWordRequest(localMeaningsPromises.get(language), signal);
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
    request = getLocalWords(surahNumber, ayahNumber, language)
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
  localMeaningsPromises.clear();
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

async function getLocalWords(surah, ayah, language, signal) {
  const wordMeanings = await loadLocalWordMeanings(language, signal);
  const verseKey = `${surah}:${ayah}`;
  const verse = quranWordsByVerse.get(verseKey);
  const rawWords = Array.isArray(verse?.words) ? verse.words : [];

  // 2:181 is segmented differently in the Arabic and Urdu datasets:
  // Arabic positions 3+4 are one Urdu unit (بَعْدَ مَا), while Urdu
  // position 11 duplicates the meaning of إِنَّ. Align explicitly rather
  // than shifting every subsequent meaning by position.
  const specialUrdu2181 = language === 'ur' && verseKey === '2:181';
  const correctedMeanings = wordMeanings;
  const displayWords = specialUrdu2181
    ? rawWords.filter((_, index) => index !== 3).map((word) => {
      if (Number(word.word) !== 3 && word.location !== '2:181:3') return word;
      const next = rawWords[3];
      return { ...word, text: [word.text, next?.text].filter(Boolean).join(' ') };
    })
    : rawWords;
  const urdu2181MeaningKey = (position) => {
    if (position <= 3) return position;
    if (position === 5) return null; // سَمِعَهُ: supplied separately below
    if (position >= 6 && position <= 11) return position - 1;
    return position; // Skip duplicate Urdu key 11 for إِنَّ at Arabic 11
  };
  const locations = displayWords.map((word, index) => word.location || `${verseKey}:${index + 1}`);
  const missingLocations = locations.filter((location) => {
    if (specialUrdu2181 && location === '2:181:5') return false;
    const sourceKey = specialUrdu2181 ? `${verseKey}:${urdu2181MeaningKey(Number(location.split(':')[2]))}` : location;
    return !Object.prototype.hasOwnProperty.call(correctedMeanings, sourceKey);
  });
  const alignmentFallback = missingLocations.length > 0;
  const orderedMeanings = Object.entries(correctedMeanings)
    .filter(([key]) => key.startsWith(`${verseKey}:`))
    .sort(([a], [b]) => Number(a.split(':')[2]) - Number(b.split(':')[2]))
    .map(([, value]) => htmlToPlainText(value))
    .filter(Boolean);

  const words = displayWords
    .map((word, index) => {
      const location = word.location || `${verseKey}:${index + 1}`;
      const position = Number(location.split(':')[2]);
      const meaningKey = specialUrdu2181 ? urdu2181MeaningKey(position) : position;
      const sourceLocation = `${verseKey}:${meaningKey}`;
      const rawMeaning = specialUrdu2181 && position === 5
        ? 'اس کو سنا'
        : correctedMeanings[sourceLocation] || '';
      const meaningHtml = alignmentFallback ? '' : language === 'en'
        ? sanitizeEnglishMeaningHtml(rawMeaning)
        : escapeHtml(rawMeaning);
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
        language,
      };
    });

  return {
    verseKey,
    language,
    direction: getWordLanguage(language).direction,
    source: 'local-public-json',
    alignmentFallback,
    alignmentNotice: alignmentFallback ? 'Meanings for this ayah are not split word for word.' : null,
    meaningsLine: alignmentFallback ? orderedMeanings.join(' ') : null,
    missingLocations,
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
    id: String(word?.location || word?.id || `word-${index + 1}`),
    position: Number(word?.position) || index + 1,
    arabic: extractRenderableText(
      word?.text_indopak || word?.text_uthmani || word?.text || '',
    ),
    // Some Quran Foundation word responses contain a translation object whose
    // visible value is nested or absent. Never pass that object into JSX: React
    // throws and unmounts the Reader (observed on 54:48 in Urdu WBW mode).
    meaning: extractRenderableText(translation),
    meaningHtml: '',
    transliteration: extractRenderableText(word?.transliteration),
    language: translationLanguage,
  };
}

function extractRenderableText(value, depth = 0) {
  if (value == null || depth > 3) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => extractRenderableText(item, depth + 1))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (typeof value !== 'object') return '';

  const preferredKeys = [
    'text',
    'translation',
    'translated_text',
    'meaning',
    'value',
    'name',
  ];

  for (const key of preferredKeys) {
    const text = extractRenderableText(value?.[key], depth + 1);
    if (text) return text;
  }

  return '';
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
