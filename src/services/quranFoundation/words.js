import quranWords from '../../data/quranWords.json';


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

  // The Mushaf may split an Arabic display unit differently from the WBW
  // source. Only the display grouping is handled here; all meanings come
  // directly from the language-specific JSON file.
  const displayWords = language === 'ur' && verseKey === '2:181'
    ? rawWords.filter((_, index) => index !== 3).map((word) => {
      if (word.location !== '2:181:3') return word;
      return { ...word, text: [word.text, rawWords[3]?.text].filter(Boolean).join(' ') };
    })
    : rawWords;
  const locations = displayWords.map((word, index) => word.location || `${verseKey}:${index + 1}`);
  const missingLocations = locations.filter((location) => !Object.prototype.hasOwnProperty.call(wordMeanings, location));
  const alignmentFallback = missingLocations.length > 0;
  const orderedMeanings = Object.entries(wordMeanings)
    .filter(([key]) => key.startsWith(`${verseKey}:`))
    .sort(([a], [b]) => Number(a.split(':')[2]) - Number(b.split(':')[2]))
    .map(([, value]) => htmlToPlainText(value))
    .filter(Boolean);

  const words = displayWords
    .map((word, index) => {
      const location = word.location || `${verseKey}:${index + 1}`;
      const rawMeaning = wordMeanings[location] || '';
      const meaningHtml = language === 'en'
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



function validateReference(surah, ayah) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Invalid Surah number.');
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new Error('Invalid Ayah number.');
  }
}
