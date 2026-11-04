export const REFLECT_MIN_AYAHS = 1;
export const REFLECT_MAX_AYAHS = 15;

export function getReflectRangeCount(startAyah, endAyah) {
  const start = Number(startAyah);
  const end = Number(endAyah);
  return Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : 0;
}

export function isValidReflectRange(startAyah, endAyah, totalAyahs) {
  const start = Number(startAyah);
  const end = Number(endAyah);
  const total = Number(totalAyahs);
  const count = getReflectRangeCount(start, end);
  return Number.isInteger(start) && Number.isInteger(end) && Number.isInteger(total)
    && start >= 1 && end >= start && end <= total
    && count >= REFLECT_MIN_AYAHS && count <= REFLECT_MAX_AYAHS;
}
