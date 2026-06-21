import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createAyahDomRange,
  createTextDomRange,
  createWordDomRange,
  getAyahEndMarkerOffset,
  getAyahHighlightRects,
} from '../utils/ayahDomRange';
import { QuranLine } from './QuranLine';

const SAVED_HIGHLIGHTS = ['amber', 'emerald', 'rose', 'sky', 'violet'];
const BOOKMARK_TONES = ['reading', 'memorize', 'tadabbur', 'notes'];
const MANAGED_HIGHLIGHTS = [
  ...SAVED_HIGHLIGHTS.map((color) => `reader-highlight-${color}`),
  ...SAVED_HIGHLIGHTS.map((color) => `reader-word-highlight-${color}`),
  ...BOOKMARK_TONES.map((tone) => `reader-bookmark-${tone}`),
];
const LINE_FIT_EVENT = 'quran-line-fit';

export function MushafPage({
  pageData,
  settings,
  savedHighlights,
  bookmarkMarkers,
  pendingAyah,
  quarterFlashTarget,
  selectedAyah,
  activeAudioAyah,
  onSelectAyah,
}) {
  const pageRef = useRef(null);
  const [highlightRects, setHighlightRects] = useState({
    selection: [],
    audio: [],
  });
  const [quarterMarkerFlashRect, setQuarterMarkerFlashRect] = useState(null);
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
    pageElement.addEventListener(LINE_FIT_EVENT, scheduleMeasure);

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
      pageElement.removeEventListener(LINE_FIT_EVENT, scheduleMeasure);
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
    savedHighlights.forEach((highlight, reference) => {
      const color = typeof highlight === 'string' ? highlight : highlight?.color;
      if (!SAVED_HIGHLIGHTS.includes(color)) return;
      const { surahNumber, ayahNumber } = parseReference(reference);
      const ranges = getAyahRanges(pageRef.current, pageData, surahNumber, ayahNumber);
      addRanges(groupedRanges, `reader-highlight-${color}`, ranges);

      const wordRange = getSavedWordRange(
        pageRef.current,
        pageData,
        highlight,
        surahNumber,
        ayahNumber,
      );
      addRanges(
        groupedRanges,
        `reader-word-highlight-${color}`,
        wordRange ? [wordRange] : [],
      );
    });

    bookmarkMarkers.forEach((category, reference) => {
      const tone = getBookmarkTone(category);
      if (!tone) return;
      const { surahNumber, ayahNumber } = parseReference(reference);
      const markerRange = getAyahMarkerRange(pageRef.current, pageData, surahNumber, ayahNumber);
      addRanges(groupedRanges, `reader-bookmark-${tone}`, markerRange ? [markerRange] : []);
    });

    groupedRanges.forEach((ranges, name) => {
      if (!ranges.length) return;
      const highlight = new Highlight(...ranges);
      if (name.startsWith('reader-word-highlight-')) highlight.priority = 1;
      CSS.highlights.set(name, highlight);
    });

    return () => {
      MANAGED_HIGHLIGHTS.forEach((name) => CSS.highlights.delete(name));
    };
  }, [pageData, savedHighlights, bookmarkMarkers, supportsTextHighlights]);

  useLayoutEffect(() => {
    const pageElement = pageRef.current;
    if (
      !pageElement ||
      quarterFlashTarget?.flashMode !== 'ayah-marker' ||
      quarterFlashTarget.page !== pageData.page
    ) {
      setQuarterMarkerFlashRect(null);
      return undefined;
    }

    let frame = 0;
    let disposed = false;

    const measureMarker = () => {
      if (disposed) return;

      const markerRange = getAyahMarkerRange(
        pageElement,
        pageData,
        quarterFlashTarget.surahNumber,
        quarterFlashTarget.ayahNumber,
      );
      const markerRect = markerRange?.getBoundingClientRect();
      if (!markerRect?.width || !markerRect?.height) {
        setQuarterMarkerFlashRect(null);
        return;
      }

      const pageRect = pageElement.getBoundingClientRect();
      const padding = 3;
      setQuarterMarkerFlashRect({
        left: markerRect.left - pageRect.left - padding,
        top: markerRect.top - pageRect.top - padding,
        width: markerRect.width + padding * 2,
        height: markerRect.height + padding * 2,
      });
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureMarker);
    };

    scheduleMeasure();
    pageElement.addEventListener(LINE_FIT_EVENT, scheduleMeasure);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      pageElement.removeEventListener(LINE_FIT_EVENT, scheduleMeasure);
    };
  }, [
    pageData,
    quarterFlashTarget?.page,
    quarterFlashTarget?.surahNumber,
    quarterFlashTarget?.ayahNumber,
    quarterFlashTarget?.flashMode,
  ]);

  return (
    <div
      ref={pageRef}
      className="reader-page grid flex-1 grid-rows-16 overflow-hidden px-4"
      style={{ '--font-scale': settings.fontScale }}
    >
      <div className="reader-ayah-highlight-layer" aria-hidden="true">
        {quarterMarkerFlashRect && (
          <span
            className="reader-quarter-marker-flash"
            style={{
              left: `${quarterMarkerFlashRect.left}px`,
              top: `${quarterMarkerFlashRect.top}px`,
              width: `${quarterMarkerFlashRect.width}px`,
              height: `${quarterMarkerFlashRect.height}px`,
            }}
          />
        )}
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
            key={`${pageData.page}:${line.line}`}
            line={line}
            hasSeparateBasmallah={hasSeparateBasmallah}
            onSelect={(selection) => onSelectAyah(line, index, selection)}
            marked={!supportsTextHighlights && lineHasSavedHighlight(line, savedHighlights)}
            jumped={Boolean(
              (
                quarterFlashTarget?.flashMode === 'first-rendered-line' &&
                quarterFlashTarget?.page === pageData.page &&
                quarterFlashTarget?.line === line.line
              ) ||
              (
                pendingAyah &&
                  line.surahNumber === pendingAyah.surahNumber &&
                  line.ayahStart <= pendingAyah.ayahNumber &&
                  (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
              )
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

function getSavedWordRange(
  pageElement,
  pageData,
  highlight,
  surahNumber,
  ayahNumber,
) {
  if (!highlight || typeof highlight === 'string') return null;

  if (
    !Number.isInteger(highlight.lineIndex) ||
    !Number.isInteger(highlight.wordIndex)
  ) {
    return null;
  }

  const lineIndex = highlight.lineIndex;
  const wordIndex = highlight.wordIndex;

  const line = pageData.lines[lineIndex];
  if (!lineContainsReference(line, surahNumber, ayahNumber)) return null;

  const textElement = getLineTextElement(pageElement, line.line);
  return createWordDomRange(textElement, line.text, wordIndex);
}

function getLineTextElement(pageElement, lineNumber) {
  return pageElement.querySelector(`[data-quran-line="${lineNumber}"] .quran-line-text`);
}

function lineContainsReference(line, surahNumber, ayahNumber) {
  return Boolean(
    line &&
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
