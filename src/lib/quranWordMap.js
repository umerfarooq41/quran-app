import quranWords from '../data/quranWords.json';

const WORD_BY_ID = new Map();

quranWords.forEach((ayah) => {
  const verseKey = typeof ayah?.key === 'string'
    ? ayah.key
    : `${Number(ayah?.surahNumber)}:${Number(ayah?.ayahNumber)}`;

  (Array.isArray(ayah?.words) ? ayah.words : []).forEach((word) => {
    const id = Number(word?.id);
    const position = Number(word?.word);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(position) || position < 1) return;

    WORD_BY_ID.set(id, {
      id,
      verseKey,
      surahNumber: Number(ayah.surahNumber),
      ayahNumber: Number(ayah.ayahNumber),
      position,
      text: String(word?.text || ''),
    });
  });
});

export function getQuranWordById(wordId) {
  const id = Number(wordId);
  return Number.isInteger(id) && id > 0 ? WORD_BY_ID.get(id) || null : null;
}

/**
 * Align the already-rendered Mushaf tokens with the app's existing Quran word IDs.
 *
 * quranWords.json keeps some pause signs attached to the preceding Quran word,
 * while the Mushaf line renderer may expose those signs as separate whitespace
 * tokens. Sequential text matching avoids treating those decorative tokens as
 * Quran words and keeps firstWordId/lastWordId authoritative.
 */
export function mapRenderedTokensToQuranWords(line, renderedTokens) {
  const result = new Map();
  if (
    line?.type !== 'ayah'
    || !Number.isInteger(Number(line.firstWordId))
    || !Number.isInteger(Number(line.lastWordId))
    || !Array.isArray(renderedTokens)
  ) {
    return result;
  }

  let wordId = Number(line.firstWordId);
  const lastWordId = Number(line.lastWordId);

  for (const token of renderedTokens) {
    if (!token?.isWord || wordId > lastWordId) continue;

    const word = WORD_BY_ID.get(wordId);
    if (!word) break;

    if (normalizeToken(token.text) !== getPrimaryRenderedToken(word.text)) continue;

    result.set(token.wordIndex, word);
    wordId += 1;
  }

  return result;
}

function getPrimaryRenderedToken(value) {
  return normalizeToken(String(value).match(/\S+/u)?.[0] || '');
}

function normalizeToken(value) {
  return String(value || '').trim().normalize('NFC');
}
