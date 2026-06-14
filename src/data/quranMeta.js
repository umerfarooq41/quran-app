export const JUZ_STARTS = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

const MADANI = new Set([2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110]);

export function getRevelationType(surahNumber) {
  return MADANI.has(Number(surahNumber)) ? 'Madani' : 'Makki';
}

export function compareReference(aSurah, aAyah, bSurah, bAyah) {
  if (aSurah !== bSurah) return aSurah - bSurah;
  return aAyah - bAyah;
}

export function getJuzForReference(surahNumber, ayahNumber = 1) {
  let juz = 1;
  for (let index = 0; index < JUZ_STARTS.length; index += 1) {
    const [startSurah, startAyah] = JUZ_STARTS[index];
    if (compareReference(surahNumber, ayahNumber, startSurah, startAyah) >= 0) {
      juz = index + 1;
    }
  }
  return juz;
}

export function getJuzPartByPage(page, totalPages) {
  const safeTotalPages = Math.max(1, Number(totalPages) || Number(page) || 1);
  const pagesPerJuz = safeTotalPages / 30;
  const within = ((page - 1) % pagesPerJuz) / pagesPerJuz;
  if (within < 0.25) return 'Start';
  if (within < 0.5) return "Ar-Ruba'";
  if (within < 0.75) return 'An-Nisf';
  return 'Ath-Thalatha';
}

export function getPageJuz(page, totalPages) {
  const safeTotalPages = Math.max(1, Number(totalPages) || Number(page) || 1);
  return Math.min(30, Math.max(1, Math.ceil((Number(page) / safeTotalPages) * 30)));
}
