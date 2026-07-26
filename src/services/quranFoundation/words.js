import { qfGet } from './client';

const wordCache = new Map();

export async function getWordByWordTranslation(surah, ayah, options = {}) {
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  const language = options.language || 'en';

  validateReference(surahNumber, ayahNumber);
  const cacheKey = `${language}:${surahNumber}:${ayahNumber}`;
  if (!options.signal && wordCache.has(cacheKey)) return wordCache.get(cacheKey);

  const data = await qfGet(`/verses/by_key/${surahNumber}:${ayahNumber}`, {
    words: true,
    language,
    word_fields: 'text_indopak,text_uthmani,translation,transliteration,location,char_type_name,position',
  }, { signal: options.signal });

  const verse = data?.verse || data?.verses?.[0] || data;
  const rawWords = Array.isArray(verse?.words) ? verse.words : [];
  const words = rawWords
    .filter((word) => !word?.char_type_name || word.char_type_name === 'word')
    .map(normalizeWord)
    .filter((word) => word.arabic || word.meaning);

  const result = {
    verseKey: verse?.verse_key || `${surahNumber}:${ayahNumber}`,
    words,
  };

  if (!options.signal) wordCache.set(cacheKey, result);
  return result;
}

export function clearWordTranslationCache() {
  wordCache.clear();
}

function normalizeWord(word, index) {
  return {
    id: word.location || word.id || `word-${index + 1}`,
    position: Number(word.position) || index + 1,
    arabic: word.text_indopak || word.text_uthmani || word.text || '',
    meaning: word.translation?.text || word.translation || '',
    transliteration: word.transliteration?.text || word.transliteration || '',
  };
}

function validateReference(surah, ayah) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Invalid Surah number.');
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new Error('Invalid Ayah number.');
  }
}
