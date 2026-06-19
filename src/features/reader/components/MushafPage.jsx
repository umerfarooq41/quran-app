import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createAyahDomRange,
  createTextDomRange,
  getAyahEndMarkerOffset,
  getAyahHighlightRects,
} from '../utils/ayahDomRange';
import { QuranLine } from './QuranLine';

const SAVED_HIGHLIGHTS = ['amber', 'emerald', 'rose', 'sky', 'violet'];
const BOOKMARK_TONES = ['reading', 'memorize', 'tadabbur', 'notes'];
const MANAGED_HIGHLIGHTS = [
  ...SAVED_HIGHLIGHTS.map((color) => `reader-highlight-${color}`),
  ...BOOKMARK_TONES.map((tone) => `reader-bookmark-${tone}`),
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
  const [highlightRects, setHighlightRects] = useState({
    selection: [],
    audio: [],
  });
  const supportsTextHighlights = typeof CSS !== 'undefined' && Boolean(CSS.highlights) && typeof Highlight !== 'undefined';

  useLayoutEffect(() => {
    const pageElement = pageRef.current;
    if (!pageElement) {
      setHighlightRects({ selection: [], audio: [] });
      return undefined;
    }

    let disposed = false;
    let frame = 0;

    const measure = () => {
      if (disposed) return;
      setHighlightRects({
        selection: selectedAyah
          ? getAyahHighlightRects(
              pageElement,
              pageData,
              selectedAyah.surahNumber,
              selectedAyah.ayahNumber,
            )
          : [],
        audio: activeAudioAyah
          ? getAyahHighlightRects(
              pageElement,
              pageData,
              activeAudioAyah.surahNumber,
              activeAudioAyah.ayahNumber,
            )
          : [],
      });
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(pageElement);
    pageElement.querySelectorAll('.quran-line-text').forEach((element) => {
      resizeObserver?.observe(element);
    });

    document.fonts?.ready?.then(() => {
      if (!disposed) scheduleMeasure();
    });
    window.addEventListener('load', scheduleMeasure);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('load', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
    };
  }, [
    pageData,
    selectedAyah?.surahNumber,
    selectedAyah?.ayahNumber,
    activeAudioAyah?.surahNumber,
    activeAudioAyah?.ayahNumber,
    settings.fontScale,
  ]);

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

    return () => {
      MANAGED_HIGHLIGHTS.forEach((name) => CSS.highlights.delete(name));
    };
  }, [pageData, savedHighlights, bookmarkMarkers, supportsTextHighlights]);

  return (
    <div
      ref={pageRef}
      className="reader-page grid flex-1 grid-rows-16 overflow-hidden px-4"
      style={{ '--font-scale': settings.fontScale }}
    >
      <div className="reader-ayah-highlight-layer" aria-hidden="true">
        {highlightRects.audio.map((rect, index) => (
          <span
            key={`audio-${rect.top}-${rect.left}-${index}`}
            className="reader-ayah-highlight-block reader-ayah-highlight-audio"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          />
        ))}
        {highlightRects.selection.map((rect, index) => (
          <span
            key={`selection-${rect.top}-${rect.left}-${index}`}
            className="reader-ayah-highlight-block reader-ayah-highlight-selection"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          />
        ))}
      </div>

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
            jumped={Boolean(
              pendingAyah &&
                line.surahNumber === pendingAyah.surahNumber &&
                line.ayahStart <= pendingAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
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

    const textElement = getLineTextElement(pageElement, line.line);
    const range = createAyahDomRange(line, textElement, ayahNumber);
    return range ? [range] : [];
  });
}

function getAyahMarkerRange(pageElement, pageData, surahNumber, ayahNumber) {
  for (const line of pageData.lines) {
    if (!lineContainsReference(line, surahNumber, ayahNumber)) continue;

    const textElement = getLineTextElement(pageElement, line.line);
    const markerOffset = getAyahEndMarkerOffset(line, ayahNumber);
    if (!textElement || markerOffset === null) continue;

    return createTextDomRange(textElement, markerOffset, markerOffset + 1);
  }

  return null;
}

function getLineTextElement(pageElement, lineNumber) {
  return pageElement.querySelector(`[data-quran-line="${lineNumber}"] .quran-line-text`);
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
