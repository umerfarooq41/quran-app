/** Canonical QuranWords location is stable across Urdu/English WBW displays.
 * The IndoPak Quran text also uses Urdu yeh (ی) where other sources use
 * Arabic yeh (ي); normalize only for matching, never change rendered Quran.
 */
export function normalizeArabicForKeyword(value) {
  return String(value || '').normalize('NFKC')
    .replace(/\p{M}/gu, '')
    .replace(/[ـ\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[یۍێېےۓى]/g, 'ي')
    .replace(/[کڪ]/g, 'ك')
    .replace(/[ہھۀەة]/g, 'ه')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}]/gu, '');
}

export function findMatchingMeaning(words, saved) {
  if (!Array.isArray(words) || !words.length || !saved?.arabic) return null;
  const normalized = normalizeArabicForKeyword(saved.arabic);
  if (saved.location) {
    const locationMatch = words.find(word => word.id === saved.location);
    if (locationMatch?.meaning && normalizeArabicForKeyword(locationMatch.arabic) === normalized) {
      return locationMatch.meaning;
    }
  }
  const position = Number(String(saved.key || '').split(':')[1]);
  const atPosition = Number.isInteger(position) && position >= 0 ? words[position] : null;
  if (atPosition?.meaning && normalizeArabicForKeyword(atPosition.arabic) === normalized) return atPosition.meaning;
  const matches = words.filter(word => word.meaning && normalizeArabicForKeyword(word.arabic) === normalized);
  return matches.length === 1 ? matches[0].meaning : null;
}
