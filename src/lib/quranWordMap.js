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
