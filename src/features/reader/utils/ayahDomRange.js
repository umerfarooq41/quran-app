import { quranAyahs } from '../../../lib/quran';

const AYAH_END_MARKERS = new Map(quranAyahs.map((ayah) => [
  `${ayah.surahNumber}:${ayah.ayahNumber}`,
  findLastPrivateUseCharacter(ayah.text),
]));

export function createAyahDomRange(line, textElement, ayahNumber) {
  if (!textElement) return null;

  const offsets = getAyahOffsets(line, ayahNumber);
  if (!offsets) return null;

  return createTextDomRange(textElement, offsets.start, offsets.end);
}

export function createTextDomRange(textElement, startOffset, endOffset) {
  if (!textElement) return null;

  const start = getTextPosition(textElement, startOffset);
  const end = getTextPosition(textElement, endOffset);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

export function createWordDomRange(textElement, value, wordIndex) {
  const offsets = getWordOffsets(value, wordIndex);
  if (!offsets) return null;
  return createTextDomRange(textElement, offsets.start, offsets.end);
}

export function getRenderedWordTokens(value = '') {
  const tokens = [];
  const matcher = /\S+|\s+/gu;
  let wordIndex = 0;
  let match = matcher.exec(String(value));

  while (match) {
    const text = match[0];
    const isWord = /\S/u.test(text);
    tokens.push({
      text,
      start: match.index,
      end: match.index + text.length,
      wordIndex: isWord ? wordIndex : null,
      isWord,
    });
    if (isWord) wordIndex += 1;
    match = matcher.exec(String(value));
  }

  return tokens;
}

export function getWordAtRenderedPoint(textElement, clientX, clientY) {
  if (!textElement) return null;

  const words = Array.from(textElement.querySelectorAll('[data-quran-word-index]'));
  let closestIndex = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  words.forEach((word) => {
    const rect = word.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const wordIndex = Number(word.dataset.quranWordIndex);
    if (pointInsideRect(clientX, clientY, rect)) {
      closestIndex = wordIndex;
      closestDistance = -1;
      return;
    }

    if (closestDistance < 0) return;
    const distance = distanceToRect(clientX, clientY, rect);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = wordIndex;
    }
  });

  return Number.isInteger(closestIndex) ? closestIndex : null;
}

export function getAyahAtRenderedPoint(line, textElement, clientX, clientY) {
  if (!textElement || line.type !== 'ayah') return line.ayahStart;

  let closestAyah = line.ayahStart;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let ayahNumber = line.ayahStart; ayahNumber <= line.ayahEnd; ayahNumber += 1) {
    const range = createAyahDomRange(line, textElement, ayahNumber);
    if (!range) continue;

    const rects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    for (const rect of rects) {
      if (pointInsideRect(clientX, clientY, rect)) return ayahNumber;

      const distance = distanceToRect(clientX, clientY, rect);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAyah = ayahNumber;
      }
    }
  }

  return closestAyah;
}

export function getAyahRangeRects(line, textElement, ayahNumber) {
  const range = createAyahDomRange(line, textElement, ayahNumber);
  if (!range) return [];

  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

export function getAyahHighlightRects(pageElement, pageData, surahNumber, ayahNumber) {
  if (!pageElement || !pageData || !surahNumber || !ayahNumber) return [];

  const pageRect = pageElement.getBoundingClientRect();
  const renderedRects = pageData.lines.flatMap((line) => {
    if (!lineContainsReference(line, surahNumber, ayahNumber)) return [];

    const textElement = pageElement.querySelector(
      `[data-quran-line="${line.line}"] .quran-line-text`,
    );
    return getAyahRangeRects(line, textElement, ayahNumber);
  });

  return mergeRectsByVisualLine(renderedRects)
    .map((rect) => {
      const horizontalPadding = 2;
      const verticalInset = Math.min(6, Math.max(3, rect.height * 0.22));
      const left = Math.max(0, rect.left - pageRect.left - horizontalPadding);
      const right = Math.min(pageRect.width, rect.right - pageRect.left + horizontalPadding);
      const top = Math.max(0, rect.top - pageRect.top + verticalInset);
      const bottom = Math.min(pageRect.height, rect.bottom - pageRect.top - verticalInset);

      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

export function getAyahOffsets(line, ayahNumber) {
  if (
    line.type !== 'ayah' ||
    Number(ayahNumber) < Number(line.ayahStart) ||
    Number(ayahNumber) > Number(line.ayahEnd)
  ) {
    return null;
  }

  const safeAyah = Number(ayahNumber);
  let start = 0;

  for (
    let precedingAyah = Number(line.ayahStart);
    precedingAyah < safeAyah;
    precedingAyah += 1
  ) {
    const previousMarker = getAyahEndMarker(line.surahNumber, precedingAyah);
    const previousMarkerOffset = previousMarker
      ? line.text.indexOf(previousMarker, start)
      : -1;

    if (previousMarkerOffset < 0) return null;
    start = previousMarkerOffset + previousMarker.length;
  }

  const marker = getAyahEndMarker(line.surahNumber, safeAyah);
  const markerOffset = marker ? line.text.indexOf(marker, start) : -1;
  const end = markerOffset < 0
    ? line.text.length
    : markerOffset + marker.length;

  if (!Number.isFinite(start) || start >= end) return null;

  return { start, end };
}

export function getAyahEndMarkerOffset(line, ayahNumber) {
  const marker = getAyahEndMarker(line.surahNumber, ayahNumber);
  const offsets = getAyahOffsets(line, ayahNumber);
  if (!marker || !offsets) return null;

  const markerOffset = offsets.end - marker.length;
  return line.text.slice(markerOffset, offsets.end) === marker
    ? markerOffset
    : null;
}

export function getWordOffsets(value, wordIndex) {
  const safeIndex = Number(wordIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0) return null;

  const token = getRenderedWordTokens(value)
    .find((candidate) => candidate.isWord && candidate.wordIndex === safeIndex);

  return token ? { start: token.start, end: token.end } : null;
}

function getAyahEndMarker(surahNumber, ayahNumber) {
  return AYAH_END_MARKERS.get(`${Number(surahNumber)}:${Number(ayahNumber)}`) || '';
}

function findLastPrivateUseCharacter(text = '') {
  const characters = Array.from(text);

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const codePoint = characters[index].codePointAt(0);
    if (codePoint >= 0xE000 && codePoint <= 0xF8FF) {
      return characters[index];
    }
  }

  return '';
}

function getTextPosition(element, requestedOffset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, requestedOffset);
  let node = walker.nextNode();
  let lastNode = null;

  while (node) {
    lastNode = node;
    if (remaining <= node.data.length) {
      return { node, offset: remaining };
    }

    remaining -= node.data.length;
    node = walker.nextNode();
  }

  if (lastNode) {
    return { node: lastNode, offset: lastNode.data.length };
  }

  return null;
}

function pointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function distanceToRect(x, y, rect) {
  const deltaX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const deltaY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(deltaX, deltaY);
}

function lineContainsReference(line, surahNumber, ayahNumber) {
  return Boolean(
    line.type === 'ayah' &&
      line.surahNumber === Number(surahNumber) &&
      line.ayahStart <= Number(ayahNumber) &&
      line.ayahEnd >= Number(ayahNumber)
  );
}

function mergeRectsByVisualLine(rects) {
  const sorted = [...rects].sort((a, b) => (
    Math.abs(a.top - b.top) > 2 ? a.top - b.top : a.left - b.left
  ));
  const lines = [];

  sorted.forEach((rect) => {
    const centerY = rect.top + rect.height / 2;
    const visualLine = lines.find((candidate) => (
      Math.abs(candidate.centerY - centerY) <=
      Math.max(2, Math.min(candidate.height, rect.height) * .3)
    ));

    if (!visualLine) {
      lines.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        centerY,
      });
      return;
    }

    visualLine.left = Math.min(visualLine.left, rect.left);
    visualLine.right = Math.max(visualLine.right, rect.right);
    visualLine.top = Math.min(visualLine.top, rect.top);
    visualLine.bottom = Math.max(visualLine.bottom, rect.bottom);
    visualLine.height = visualLine.bottom - visualLine.top;
    visualLine.centerY = visualLine.top + visualLine.height / 2;
  });

  return lines.map((line) => ({
    left: line.left,
    right: line.right,
    top: line.top,
    bottom: line.bottom,
    width: line.right - line.left,
    height: line.bottom - line.top,
  }));
}
