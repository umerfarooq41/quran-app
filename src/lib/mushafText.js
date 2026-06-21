const SMALL_PAUSE_SIGNS = '\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u08D3-\\u08FF';
const AYAH_MARKER_GLYPHS = '\\uF500-\\uF8FF';
const SMALL_SIGN_CLASS = `[${SMALL_PAUSE_SIGNS}]`;
const AYAH_MARKER_CLASS = `[${AYAH_MARKER_GLYPHS}]`;
const SPACE_BEFORE_SMALL_SIGNS = new RegExp(`\\s+(${SMALL_SIGN_CLASS}+)`, 'gu');
const AYAH_MARKER_CLUSTER = new RegExp(`(${SMALL_SIGN_CLASS}*${AYAH_MARKER_CLASS}+${SMALL_SIGN_CLASS}*)`, 'gu');
const MULTIPLE_SPACES = /[ \t\f\v]+/g;
const MARKER_PLACEHOLDER_PREFIX = '%%AYAH_MARKER_';
const MARKER_PLACEHOLDER_SUFFIX = '%%';

/**
 * Runtime Mushaf formatter.
 *
 * The reference app keeps ordinary pause signs attached to the previous word,
 * while ayah-end ornaments behave like their own word-sized token between two
 * words. That gives equal word-spacing before and after the ayah ornament and
 * prevents tiny pause signs from becoming separate spaced words.
 *
 * This keeps Quran JSON unchanged:
 * - pause signs such as ۚ ۖ ۛ stay attached to the previous word;
 * - ayah marker clusters, including signs above/below them, are spaced as one
 *   complete marker token;
 * - repeated spaces are collapsed without touching Arabic letters.
 */
export function normalizeMushafText(value = '') {
  const markers = [];

  const withMarkerPlaceholders = String(value).replace(AYAH_MARKER_CLUSTER, (marker) => {
    const index = markers.push(marker) - 1;
    return ` ${MARKER_PLACEHOLDER_PREFIX}${index}${MARKER_PLACEHOLDER_SUFFIX} `;
  });

  const withAttachedPauseSigns = withMarkerPlaceholders
    .replace(SPACE_BEFORE_SMALL_SIGNS, '$1')
    .replace(MULTIPLE_SPACES, ' ')
    .trim();

  return withAttachedPauseSigns
    .replace(
      new RegExp(`${MARKER_PLACEHOLDER_PREFIX}(\\d+)${MARKER_PLACEHOLDER_SUFFIX}`, 'g'),
      (_, index) => markers[Number(index)] || '',
    )
    .replace(MULTIPLE_SPACES, ' ')
    .trim();
}

export function normalizeMushafLine(line) {
  if (!line || typeof line !== 'object' || typeof line.text !== 'string') return line;
  return {
    ...line,
    text: normalizeMushafText(line.text),
  };
}

export function normalizeMushafPage(page) {
  if (!page || typeof page !== 'object' || !Array.isArray(page.lines)) return page;
  return {
    ...page,
    lines: page.lines.map(normalizeMushafLine),
  };
}

export function normalizeMushafAyah(ayah) {
  if (!ayah || typeof ayah !== 'object' || typeof ayah.text !== 'string') return ayah;
  return {
    ...ayah,
    text: normalizeMushafText(ayah.text),
  };
}
