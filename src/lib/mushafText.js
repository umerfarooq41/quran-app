const PAUSE_SIGNS = '\\u06D6-\\u06ED\\u08E2\\u08E3\\u08F0-\\u08FF\\uF500-\\uF8FF';
const SPACE_BEFORE_PAUSE_SIGNS = new RegExp(`\\s+([${PAUSE_SIGNS}]+)`, 'gu');
const MULTIPLE_SPACES = /[ \t\f\v]+/g;

/**
 * Keep IndoPak pause / sajdah / ayah glyphs in the same token as the word
 * before them, matching the reference app's text model.
 *
 * The reference mushaf data does not render pause signs as standalone words;
 * signs are attached to the previous word and spacing is added only between
 * complete word tokens. This runtime normalizer lets us keep the shipped JSON
 * files unchanged while rendering/highlighting with the safer token format.
 */
export function normalizeMushafText(value = '') {
  return String(value)
    .replace(SPACE_BEFORE_PAUSE_SIGNS, '$1')
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
