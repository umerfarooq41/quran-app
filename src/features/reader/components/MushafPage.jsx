import React, { useEffect, useRef } from 'react';
import { QuranLine } from './QuranLine';

const SELECTION_HIGHLIGHT = 'reader-ayah-selection';
const AUDIO_HIGHLIGHT = 'reader-audio-active';
const SAVED_HIGHLIGHTS = ['amber', 'emerald', 'rose', 'sky', 'violet'];
const BOOKMARK_TONES = ['reading', 'memorize', 'tadabbur', 'notes'];
const MANAGED_HIGHLIGHTS = [
  ...SAVED_HIGHLIGHTS.map((color) => `reader-highlight-${color}`),
  ...BOOKMARK_TONES.map((tone) => `reader-bookmark-${tone}`),
  AUDIO_HIGHLIGHT,
  SELECTION_HIGHLIGHT,
];

export function MushafPage({
  pageData,
  settings,
  savedHighlights,
  bookmarkMarkers,
  pendingAyah,
  selectedAyah,
  activeAudioAyah,
  onSelectAyah,
}) {
  const pageRef = useRef(null);
  const supportsTextHighlights = typeof CSS !== 'undefined' && Boolean(CSS.highlights) && typeof Highlight !== 'undefined';

  useEffect(() => {
    if (!supportsTextHighlights) return undefined;

    MANAGED_HIGHLIGHTS.forEach((name) => CSS.highlights.delete(name));
    if (!pageRef.current) return undefined;

    const groupedRanges = new Map();
    savedHighlights.forEach((color, reference) => {
      if (!SAVED_HIGHLIGHTS.includes(color)) return;
      const { surahNumber, ayahNumber } = parseReference(reference);
      const ranges = getAyahRanges(pageRef.current, pageData, surahNumber, ayahNumber);
      addRanges(groupedRanges, `reader-highlight-${color}`, ranges);
    });

    bookmarkMarkers.forEach((category, reference) => {
      const tone = getBookmarkTone(category);
      if (!tone) return;
      const { surahNumber, ayahNumber } = parseReference(reference);
      const markerRange = getAyahMarkerRange(pageRef.current, pageData, surahNumber, ayahNumber);
      addRanges(groupedRanges, `reader-bookmark-${tone}`, markerRange ? [markerRange] : []);
    });

    groupedRanges.forEach((ranges, name) => {
      if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges));
    });

    if (activeAudioAyah) {
      const audioRanges = getAyahRanges(
        pageRef.current,
        pageData,
        activeAudioAyah.surahNumber,
        activeAudioAyah.ayahNumber,
      );
      if (audioRanges.length) {
        CSS.highlights.set(AUDIO_HIGHLIGHT, new Highlight(...audioRanges));
      }
    }

    if (selectedAyah) {
      const selectedRanges = getAyahRanges(
        pageRef.current,
        pageData,
        selectedAyah.surahNumber,
        selectedAyah.ayahNumber,
      );
      if (selectedRanges.length) {
        CSS.highlights.set(SELECTION_HIGHLIGHT, new Highlight(...selectedRanges));
      }
    }

    return () => {
      MANAGED_HIGHLIGHTS.forEach((name) => CSS.highlights.delete(name));
    };
  }, [pageData, savedHighlights, bookmarkMarkers, selectedAyah, activeAudioAyah, supportsTextHighlights]);

  return (
    <div
      ref={pageRef}
      className="reader-page grid flex-1 grid-rows-16 overflow-hidden px-4"
      style={{ '--font-scale': settings.fontScale }}
    >
      {pageData.lines.map((line, index) => {
        const nextLine = pageData.lines[index + 1];
        const hasSeparateBasmallah = nextLine?.type === 'basmallah' || nextLine?.type === 'bismillah';

        return (
          <QuranLine
            key={line.line}
            line={line}
            hasSeparateBasmallah={hasSeparateBasmallah}
            onSelect={(ayahNumber) => onSelectAyah(line, ayahNumber)}
            marked={!supportsTextHighlights && lineHasSavedHighlight(line, savedHighlights)}
            selected={!supportsTextHighlights && lineContainsAyah(line, selectedAyah)}
            jumped={Boolean(
              pendingAyah &&
                line.surahNumber === pendingAyah.surahNumber &&
                line.ayahStart <= pendingAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
            )}
            activeAudio={!supportsTextHighlights && Boolean(
              activeAudioAyah &&
                line.surahNumber === activeAudioAyah.surahNumber &&
                line.ayahStart <= activeAudioAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= activeAudioAyah.ayahNumber)
            )}
          />
        );
      })}
    </div>
  );
}

function getAyahRanges(pageElement, pageData, surahNumber, ayahNumber) {
  return pageData.lines.flatMap((line) => {
    if (!lineContainsReference(line, surahNumber, ayahNumber)) return [];

    const textNode = getLineTextNode(pageElement, line.line);
    const offsets = getAyahOffsets(line, ayahNumber);
    if (!textNode || !offsets) return [];

    const range = new Range();
    range.setStart(textNode, offsets.start);
    range.setEnd(textNode, offsets.end);
    return [range];
  });
}

function getAyahMarkerRange(pageElement, pageData, surahNumber, ayahNumber) {
  for (const line of pageData.lines) {
    if (!lineContainsReference(line, surahNumber, ayahNumber)) continue;

    const textNode = getLineTextNode(pageElement, line.line);
    const markerOffset = getAyahMarkerOffset(line, ayahNumber);
    if (!textNode || markerOffset === null) continue;

    const range = new Range();
    range.setStart(textNode, markerOffset);
    range.setEnd(textNode, markerOffset + 1);
    return range;
  }

  return null;
}

function getLineTextNode(pageElement, lineNumber) {
  const textElement = pageElement.querySelector(`[data-quran-line="${lineNumber}"] .quran-line-text`);
  return textElement?.firstChild || null;
}

function lineContainsAyah(line, selectedAyah) {
  return Boolean(
    selectedAyah &&
      lineContainsReference(line, selectedAyah.surahNumber, selectedAyah.ayahNumber)
  );
}

function lineContainsReference(line, surahNumber, ayahNumber) {
  return Boolean(
    line.type === 'ayah' &&
      line.surahNumber === Number(surahNumber) &&
      line.ayahStart <= Number(ayahNumber) &&
      line.ayahEnd >= Number(ayahNumber)
  );
}

function lineHasSavedHighlight(line, savedHighlights) {
  if (line.type !== 'ayah' || !line.surahNumber || !line.ayahStart) return false;

  for (let ayahNumber = line.ayahStart; ayahNumber <= line.ayahEnd; ayahNumber += 1) {
    if (savedHighlights.has(`${line.surahNumber}:${ayahNumber}`)) return true;
  }
  return false;
}

function getAyahOffsets(line, ayahNumber) {
  const relativeAyah = Number(ayahNumber) - Number(line.ayahStart);
  if (relativeAyah < 0) return null;

  const markerOffsets = [];
  const markerPattern = /[\uE000-\uF8FF]/g;
  let match = markerPattern.exec(line.text);

  while (match) {
    markerOffsets.push(match.index);
    match = markerPattern.exec(line.text);
  }

  let start = relativeAyah === 0
    ? 0
    : (markerOffsets[relativeAyah - 1] ?? -1) + 1;
  const endMarker = markerOffsets[relativeAyah];
  const end = endMarker === undefined ? line.text.length : endMarker + 1;

  while (start < end && /\s/.test(line.text[start])) start += 1;

  return start < end ? { start, end } : null;
}

function getAyahMarkerOffset(line, ayahNumber) {
  const relativeAyah = Number(ayahNumber) - Number(line.ayahStart);
  const markerOffsets = getMarkerOffsets(line.text);
  return markerOffsets[relativeAyah] ?? null;
}

function getMarkerOffsets(text) {
  const offsets = [];
  const markerPattern = /[\uE000-\uF8FF]/g;
  let match = markerPattern.exec(text);

  while (match) {
    offsets.push(match.index);
    match = markerPattern.exec(text);
  }

  return offsets;
}

function addRanges(groups, name, ranges) {
  if (!ranges.length) return;
  groups.set(name, [...(groups.get(name) || []), ...ranges]);
}

function parseReference(reference) {
  const [surahNumber, ayahNumber] = String(reference).split(':').map(Number);
  return { surahNumber, ayahNumber };
}

function getBookmarkTone(category) {
  if (category === 'Reading' || category === 'Recitation') return 'reading';
  if (category === 'Memorize') return 'memorize';
  if (category === 'Tadabbur') return 'tadabbur';
  if (category === 'Notes') return 'notes';
  return '';
}
