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

export function getQuranWordsForAyah(surahNumber, ayahNumber) {
  const surah = Number(surahNumber);
  const ayah = Number(ayahNumber);
  if (!Number.isInteger(surah) || !Number.isInteger(ayah)) return [];

  const result = [];
  WORD_BY_ID.forEach((word) => {
    if (word.surahNumber === surah && word.ayahNumber === ayah) result.push(word);
  });
  return result.sort((first, second) => first.position - second.position);
}

export function getQuranWordById(wordId) {
  const id = Number(wordId);
  return Number.isInteger(id) && id > 0 ? WORD_BY_ID.get(id) || null : null;
}

/**
 * Align rendered Mushaf tokens with the Quran word IDs covered by this line.
 *
 * The line's first/last word IDs define the authoritative sequence, but the
 * rendered IndoPak text may contain detached pause signs or Unicode/font
 * variants. We therefore prefer exact/base-letter matches, skip decorative
 * tokens, and use a small look-ahead instead of allowing one mismatch to stall
 * the cursor for the rest of the line.
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

  const quranWordsForLine = [];
  for (
    let wordId = Number(line.firstWordId);
    wordId <= Number(line.lastWordId);
    wordId += 1
  ) {
    const word = WORD_BY_ID.get(wordId);
    if (word) quranWordsForLine.push(word);
  }

  const lexicalTokens = renderedTokens.filter((token) => (
    token?.isWord && !isDecorativeToken(token.text)
  ));

  let wordCursor = 0;

  lexicalTokens.forEach((token, tokenCursor) => {
    while (
      wordCursor < quranWordsForLine.length
      && isDecorativeToken(quranWordsForLine[wordCursor].text)
    ) {
      wordCursor += 1;
    }
    if (wordCursor >= quranWordsForLine.length) return;

    const rendered = normalizeToken(token.text);
    let matchedIndex = findMatchingWordIndex(
      quranWordsForLine,
      wordCursor,
      rendered,
    );

    if (matchedIndex < 0) {
      // When the number of remaining visible tokens equals the number of
      // remaining Quran words, their sequence is authoritative. This fallback
      // handles harmless Unicode variants without blindly shifting alignment
      // when an actual token is missing or extra.
      const remainingTokens = lexicalTokens.length - tokenCursor;
      const remainingWords = countRemainingLexicalWords(quranWordsForLine, wordCursor);
      const expected = getPrimaryRenderedToken(quranWordsForLine[wordCursor]?.text);

      if (
        remainingTokens === remainingWords
        && areLikelySameWord(rendered, expected)
      ) {
        matchedIndex = wordCursor;

        if (import.meta.env?.DEV) {
          console.warn('Word mapped by guarded sequence fallback', {
            rendered: token.text,
            expected: quranWordsForLine[wordCursor]?.text,
            wordId: quranWordsForLine[wordCursor]?.id,
          });
        }
      }
    }

    if (matchedIndex < 0) return;

    const word = quranWordsForLine[matchedIndex];
    result.set(token.wordIndex, word);
    wordCursor = matchedIndex + 1;
  });

  return result;
}

function findMatchingWordIndex(words, startIndex, rendered) {
  const LOOK_AHEAD = 3;
  const endIndex = Math.min(words.length - 1, startIndex + LOOK_AHEAD);

  for (let index = startIndex; index <= endIndex; index += 1) {
    const expected = getPrimaryRenderedToken(words[index]?.text);
    if (tokensMatch(rendered, expected)) return index;
  }

  return -1;
}

function countRemainingLexicalWords(words, startIndex) {
  let count = 0;
  for (let index = startIndex; index < words.length; index += 1) {
    if (!isDecorativeToken(words[index]?.text)) count += 1;
  }
  return count;
}

function tokensMatch(rendered, expected) {
  if (!rendered || !expected) return false;
  if (rendered === expected) return true;

  const renderedBase = normalizeArabicBase(rendered);
  const expectedBase = normalizeArabicBase(expected);
  return Boolean(renderedBase && renderedBase === expectedBase);
}


function areLikelySameWord(rendered, expected) {
  const renderedBase = normalizeArabicBase(rendered);
  const expectedBase = normalizeArabicBase(expected);
  if (!renderedBase || !expectedBase) return false;
  if (renderedBase === expectedBase) return true;

  const longestLength = Math.max(renderedBase.length, expectedBase.length);
  if (Math.abs(renderedBase.length - expectedBase.length) > 1) return false;

  // Permit one code-point difference for short words and a maximum of 20%
  // for longer words. This catches composition/font variants without letting
  // an unrelated lexical word silently shift the rest of the line.
  const maxDistance = Math.max(1, Math.floor(longestLength * 0.2));
  return levenshteinDistance(renderedBase, expectedBase) <= maxDistance;
}

function levenshteinDistance(first, second) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[second.length];
}

function getPrimaryRenderedToken(value) {
  return normalizeToken(String(value).match(/\S+/u)?.[0] || '');
}

function normalizeToken(value) {
  return String(value || '').trim().normalize('NFC');
}

function normalizeArabicBase(value) {
  return normalizeToken(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u08d3-\u08ff]/gu, '')
    .replace(/[\uE000-\uF8FF]/gu, '')
    .replace(/[ٱأإآ]/gu, 'ا')
    .replace(/[ى]/gu, 'ي')
    .replace(/[ؤ]/gu, 'و')
    .replace(/[ئ]/gu, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .normalize('NFC');
}

function isDecorativeToken(value) {
  return normalizeArabicBase(value).length === 0;
}
