export const REFLECT_MIN_AYAHS = 3;
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

/** Keep the chosen ayah inside the shortest valid initial passage. */
export function getInitialReflectRange(selectedAyah, totalAyahs) {
  const total = Number(totalAyahs);
  if (!Number.isInteger(total) || total < REFLECT_MIN_AYAHS) return null;
  const selected = Math.min(total, Math.max(1, Number(selectedAyah) || 1));
  const startAyah = Math.min(selected, total - REFLECT_MIN_AYAHS + 1);
  return { startAyah, endAyah: startAyah + REFLECT_MIN_AYAHS - 1 };
}
