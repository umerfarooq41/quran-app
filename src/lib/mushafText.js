import rawAyahs from '../data/quranAyahs.json';

const SMALL_PAUSE_SIGNS = '\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF';
const PRIVATE_USE_GLYPHS = '\uE000-\uF8FF';
const SMALL_SIGN_CLASS = `[${SMALL_PAUSE_SIGNS}]`;
const SPACE_BEFORE_SMALL_SIGNS = new RegExp(`\\s+(${SMALL_SIGN_CLASS}+)`, 'gu');
const MULTIPLE_SPACES = /[ \t\f\v]+/g;
const TRAILING_AYAH_CLUSTER = new RegExp(`\\s*([${SMALL_PAUSE_SIGNS}${PRIVATE_USE_GLYPHS}]+)\\s*$`, 'u');

const AYAH_END_CLUSTER_MAP = new Map(
  rawAyahs.map((ayah) => [
    `${Number(ayah.surahNumber)}:${Number(ayah.ayahNumber)}`,
    extractAyahEndCluster(ayah.text),
  ]),
);

function extractAyahEndCluster(text = '') {
  const match = String(text).match(TRAILING_AYAH_CLUSTER);
  return match?.[1] || '';
}

function collapseSpaces(value = '') {
  return String(value).replace(MULTIPLE_SPACES, ' ').trim();
}

function attachSmallPauseSigns(value = '') {
  return String(value).replace(SPACE_BEFORE_SMALL_SIGNS, '$1');
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAyahEndCluster(surahNumber, ayahNumber) {
  return AYAH_END_CLUSTER_MAP.get(`${Number(surahNumber)}:${Number(ayahNumber)}`) || '';
}

export function getLineAyahMarkerTokens(line) {
  if (!line || line.type !== 'ayah') return [];

  const tokens = [];
  for (let ayah = Number(line.ayahStart); ayah <= Number(line.ayahEnd); ayah += 1) {
    const cluster = getAyahEndCluster(line.surahNumber, ayah);
    if (cluster) tokens.push(cluster);
  }
  return tokens;
}

export function isAyahMarkerToken(value = '', line) {
  if (!value || !line || line.type !== 'ayah') return false;
  const token = String(value);
  return getLineAyahMarkerTokens(line).includes(token);
}

export function splitAyahMarkerToken(value = '') {
  const characters = Array.from(String(value));
  let lastPuaIndex = -1;

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const codePoint = characters[index].codePointAt(0);
    if (codePoint >= 0xE000 && codePoint <= 0xF8FF) {
      lastPuaIndex = index;
      break;
    }
  }

  if (lastPuaIndex < 0) {
    return { prefix: String(value), glyph: '', suffix: '' };
  }

  let runStart = lastPuaIndex;
  while (runStart > 0) {
    const previous = characters[runStart - 1].codePointAt(0);
    if (previous < 0xE000 || previous > 0xF8FF) break;
    runStart -= 1;
  }

  return {
    prefix: characters.slice(0, runStart).join(''),
    glyph: characters.slice(runStart, lastPuaIndex + 1).join(''),
    suffix: characters.slice(lastPuaIndex + 1).join(''),
  };
}

/**
 * Runtime Mushaf formatter.
 *
 * Keep ordinary pause signs attached to the previous word while turning only
 * the real ayah-end clusters for the current line into standalone word tokens.
 * This preserves Quran JSON data and avoids misclassifying private-use glyphs
 * that belong inside normal words.
 */
export function normalizeMushafText(value = '') {
  return collapseSpaces(attachSmallPauseSigns(value));
}

export function normalizeMushafLine(line) {
  if (!line || typeof line !== 'object' || typeof line.text !== 'string') return line;

  let text = attachSmallPauseSigns(line.text);

  if (line.type === 'ayah') {
    for (let ayah = Number(line.ayahStart); ayah <= Number(line.ayahEnd); ayah += 1) {
      const cluster = getAyahEndCluster(line.surahNumber, ayah);
      if (!cluster) continue;

      const escapedCluster = escapeRegExp(cluster);
      text = text.replace(new RegExp(`\\s*${escapedCluster}\\s*`, 'u'), ` ${cluster} `);
    }
  }

  return {
    ...line,
    text: collapseSpaces(text),
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
