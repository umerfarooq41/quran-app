import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createAyahDomRange,
  createTextDomRange,
  createWordDomRange,
  getAyahEndMarkerOffset,
  getAyahHighlightRects,
  getRangeHighlightRects,
} from '../utils/ayahDomRange';
import { QuranLine } from './QuranLine';
import indoPakParaQuarters from '../../../data/indoPakParaQuarters';

const SAVED_HIGHLIGHTS = ['amber', 'emerald', 'rose', 'sky', 'violet'];
const BOOKMARK_TONES = ['reading', 'memorize', 'tadabbur', 'notes'];
const MANAGED_HIGHLIGHTS = [
  ...SAVED_HIGHLIGHTS.map((color) => `reader-highlight-${color}`),
  ...BOOKMARK_TONES.map((tone) => `reader-bookmark-${tone}`),
];
const LINE_FIT_EVENT = 'quran-line-fit';
const MUSHAF_FONT_FAMILY = 'IndopakNastaleeq';
const MUSHAF_FONT_SAMPLE = 'اللَّهُ';
const MEASURE_DELAYS = [60, 180, 420];
const INDO_PAK_JUZ_START_PAGES = new Set(
  Object.values(indoPakParaQuarters)
    .map((targets) => targets.find((target) => target.id === 'start')?.page)
    .filter((page) => Number.isFinite(Number(page)))
    .map(Number),
);

export function MushafPage({
  pageData,
  settings,
  savedHighlights,
  bookmarkMarkers,
  pendingAyah,
  quarterFlashTarget,
  selectedAyah,
  playingVerseKey,
  playingWordPosition,
  playingWordOccurrenceIndex,
  interactionsBlocked = false,
  enableTextHighlights = true,
  onBlockedInteraction,
  onSelectAyah,
  onTapAyah,
}) {
  const pageRef = useRef(null);
  const [highlightRects, setHighlightRects] = useState({
    saved: [],
    savedWords: [],
    selection: [],
    recitation: [],
  });
  const [quarterMarkerFlashRect, setQuarterMarkerFlashRect] = useState(null);
  const supportsTextHighlights = enableTextHighlights && typeof CSS !== 'undefined' && Boolean(CSS.highlights) && typeof Highlight !== 'undefined';
  const juzStartLines = useMemo(() => getJuzStartLineNumbers(pageData), [pageData]);

  useLayoutEffect(() => {
    const pageElement = pageRef.current;
    if (!pageElement) {
      setHighlightRects({ saved: [], savedWords: [], selection: [], recitation: [] });
      return undefined;
    }

    let disposed = false;
    let frame = 0;
    const timers = new Set();

    const measure = () => {
      if (disposed) return;
      setHighlightRects({
        saved: getSavedHighlightRects(pageElement, pageData, savedHighlights),
        savedWords: getSavedWordHighlightRects(pageElement, pageData, savedHighlights),
        selection: selectedAyah
          ? getAyahHighlightRects(
              pageElement,
              pageData,
              selectedAyah.surahNumber,
              selectedAyah.ayahNumber,
            )
          : [],
        recitation: getRecitationHighlightRects(pageElement, pageData, playingVerseKey),
      });
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const clearMeasureTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };

    const scheduleMeasureBurst = () => {
      clearMeasureTimers();
      scheduleMeasure();

      MEASURE_DELAYS.forEach((delay) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          scheduleMeasure();
        }, delay);
        timers.add(timer);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleMeasureBurst();
    };

    scheduleMeasureBurst();
    pageElement.addEventListener(LINE_FIT_EVENT, scheduleMeasure);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(pageElement);
    pageElement.querySelectorAll('.quran-line-text').forEach((element) => {
      resizeObserver?.observe(element);
    });

    loadMushafFont().then(() => {
      if (!disposed) scheduleMeasureBurst();
    });
    document.fonts?.addEventListener?.('loadingdone', scheduleMeasureBurst);
    document.fonts?.addEventListener?.('loadingerror', scheduleMeasureBurst);
    window.addEventListener('load', scheduleMeasureBurst);
    window.addEventListener('pageshow', scheduleMeasureBurst);
    window.addEventListener('focus', scheduleMeasureBurst);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);

    return () => {
      disposed = true;
      clearMeasureTimers();
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      pageElement.removeEventListener(LINE_FIT_EVENT, scheduleMeasure);
      document.fonts?.removeEventListener?.('loadingdone', scheduleMeasureBurst);
      document.fonts?.removeEventListener?.('loadingerror', scheduleMeasureBurst);
      window.removeEventListener('load', scheduleMeasureBurst);
      window.removeEventListener('pageshow', scheduleMeasureBurst);
      window.removeEventListener('focus', scheduleMeasureBurst);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
    };
  }, [
    pageData,
    savedHighlights,
    selectedAyah?.surahNumber,
    selectedAyah?.ayahNumber,
    playingVerseKey,
    settings.fontScale,
  ]);

  useEffect(() => {
    if (!supportsTextHighlights) return undefined;

    MANAGED_HIGHLIGHTS.forEach((name) => CSS.highlights.delete(name));
    if (!pageRef.current) return undefined;

    const groupedRanges = new Map();

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

  const isOpeningMushafPage = pageData.page === 1 || pageData.page === 2;

  const renderedLines = useMemo(() => {
    const lines = pageData.lines.map((line, sourceIndex) => ({ ...line, sourceIndex }));
    const trailingSpacerIndex = lines.map((line) => line.type).lastIndexOf('spacer');

    if (trailingSpacerIndex < 0) return lines;

    const inlineHeaderIndexes = lines.reduce((indexes, line, index) => {
      if (line.type !== 'surah_name') return indexes;

      const nextType = lines[index + 1]?.type;
      const hasSeparateBasmallah = nextType === 'basmallah' || nextType === 'bismillah';
      const mayUseBasmallah = line.surahNumber !== 1 && line.surahNumber !== 9;

      if (mayUseBasmallah && !hasSeparateBasmallah) indexes.push(index);
      return indexes;
    }, []);

    // Only expand a one-row header when the page has one unambiguous header
    // and one spare grid row. Pages containing several compact Surah headers
    // must keep their original one-row arrangement to preserve all 16 lines.
    if (inlineHeaderIndexes.length !== 1) return lines;

    const inlineHeaderIndex = inlineHeaderIndexes[0];
    const header = lines[inlineHeaderIndex];
    const withoutSpacer = lines.filter((_, index) => index !== trailingSpacerIndex);

    withoutSpacer.splice(inlineHeaderIndex + 1, 0, {
      line: `synthetic-basmallah-${pageData.page}-${header.line}`,
      text: '',
      surahNumber: header.surahNumber,
      ayahStart: null,
      ayahEnd: null,
      type: 'basmallah',
      isCentered: true,
      firstWordId: null,
      lastWordId: null,
      sourceIndex: null,
      syntheticHeaderLine: true,
    });

    return withoutSpacer;
  }, [pageData.page, pageData.lines]);

  const startsWithDoubleHeader = (
    renderedLines[0]?.type === 'surah_name' &&
    isCombinedHeaderBasmallahLine(renderedLines[1], renderedLines[0])
  );

  return (
    <div
      ref={pageRef}
      className={`reader-page grid flex-1 grid-rows-16 overflow-hidden px-4 ${isOpeningMushafPage ? 'reader-page-opening' : ''} ${startsWithDoubleHeader ? 'reader-page--starts-with-double-header' : ''}`}
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
        {highlightRects.saved.map((item, index) => (
          <span
            key={`saved-${item.color}-${item.rect.top}-${item.rect.left}-${index}`}
            className={`reader-ayah-highlight-block reader-ayah-highlight-saved reader-ayah-highlight-${item.color}`}
            style={{
              left: `${item.rect.left}px`,
              top: `${item.rect.top}px`,
              width: `${item.rect.width}px`,
              height: `${item.rect.height}px`,
            }}
          />
        ))}
        {highlightRects.savedWords.map((item, index) => (
          <span
            key={`saved-word-${item.color}-${item.rect.top}-${item.rect.left}-${index}`}
            className={`reader-ayah-highlight-block reader-word-highlight-block reader-word-highlight-${item.color}`}
            style={{
              left: `${item.rect.left}px`,
              top: `${item.rect.top}px`,
              width: `${item.rect.width}px`,
              height: `${item.rect.height}px`,
            }}
          />
        ))}
        {highlightRects.recitation.length > 0 && (
          <svg className="reader-ayah-highlight-shape" width="100%" height="100%" preserveAspectRatio="none">
            <path
              className="reader-ayah-highlight-audio"
              d={buildContinuousHighlightPath(highlightRects.recitation)}
            />
          </svg>
        )}
        {highlightRects.selection.length > 0 && (
          <svg className="reader-ayah-highlight-shape" width="100%" height="100%" preserveAspectRatio="none">
            <path
              className="reader-ayah-highlight-selection"
              d={buildContinuousHighlightPath(highlightRects.selection)}
            />
          </svg>
        )}
      </div>

      {renderedLines.map((line, index) => {
        const previousLine = renderedLines[index - 1];
        const nextLine = renderedLines[index + 1];
        const hasSeparateBasmallah = isCombinedHeaderBasmallahLine(nextLine, line);
        const coveredByCombinedHeader = (
          previousLine?.type === 'surah_name' &&
          isCombinedHeaderBasmallahLine(line, previousLine)
        );

        return (
          <QuranLine
            key={`${pageData.page}:${line.line}`}
            line={line}
            hasSeparateBasmallah={hasSeparateBasmallah}
            coveredByCombinedHeader={coveredByCombinedHeader}
            forceCentered={isOpeningMushafPage && line.type === 'ayah'}
            interactionsBlocked={interactionsBlocked}
            isJuzStartLine={juzStartLines.has(line.line)}
            onBlockedInteraction={onBlockedInteraction}
            onSelect={(selection) => onSelectAyah(line, line.sourceIndex ?? index, selection)}
            onTap={(selection) => onTapAyah?.(line, line.sourceIndex ?? index, selection)}
            marked={!supportsTextHighlights && lineHasSavedHighlight(line, savedHighlights)}
            playingVerseKey={playingVerseKey}
            playingWordPosition={playingWordPosition}
            playingWordOccurrenceIndex={playingWordOccurrenceIndex}
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



function buildContinuousHighlightPath(rects) {
  if (!rects?.length) return '';

  const sorted = [...rects].sort((a, b) => a.top - b.top);
  const radius = 3;

  if (sorted.length === 1) {
    const rect = sorted[0];
    const x1 = rect.left;
    const x2 = rect.left + rect.width;
    const y1 = rect.top;
    const y2 = rect.top + rect.height;
    return `M ${x1 + radius} ${y1} H ${x2 - radius} Q ${x2} ${y1} ${x2} ${y1 + radius} V ${y2 - radius} Q ${x2} ${y2} ${x2 - radius} ${y2} H ${x1 + radius} Q ${x1} ${y2} ${x1} ${y2 - radius} V ${y1 + radius} Q ${x1} ${y1} ${x1 + radius} ${y1} Z`;
  }

  // Build one connected RTL polygon, not one closed rectangle per row.
  // The path walks around the outside boundary so internal row edges never
  // exist and cannot create seams or doubled-opacity bands.
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const points = [];

  // Start at the true ayah start (top-right), round only this outer endpoint.
  points.push(`M ${first.left} ${first.top}`);
  points.push(`H ${first.left + first.width - radius}`);
  points.push(`Q ${first.left + first.width} ${first.top} ${first.left + first.width} ${first.top + radius}`);
  points.push(`V ${first.top + first.height}`);

  // Descend the right outside boundary through continuation rows.
  for (let i = 1; i < sorted.length; i += 1) {
    const rect = sorted[i];
    const right = rect.left + rect.width;
    points.push(`H ${right}`);
    points.push(`V ${rect.top + rect.height}`);
  }

  // Round only the true ayah end (bottom-left).
  points.push(`H ${last.left + radius}`);
  points.push(`Q ${last.left} ${last.top + last.height} ${last.left} ${last.top + last.height - radius}`);
  points.push(`V ${last.top}`);

  // Ascend the left outside boundary back through the continuation rows.
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    const rect = sorted[i];
    points.push(`H ${rect.left}`);
    points.push(`V ${rect.top}`);
  }

  points.push('Z');
  return points.join(' ');
}

function isCombinedHeaderBasmallahLine(line, headerLine) {
  if (!line || !headerLine || headerLine.type !== 'surah_name') return false;

  if (line.type === 'basmallah' || line.type === 'bismillah') return true;

  // Al-Fatihah is unique in the Mushaf data: its Bismillah is ayah 1:1
  // rather than a separate `basmallah` row. Render that ayah in the same
  // second-row Surah-header compartment used by the rest of the Mushaf,
  // while leaving the source Quran data and ayah numbering untouched.
  return Boolean(
    Number(headerLine.surahNumber) === 1 &&
    line.type === 'ayah' &&
    Number(line.surahNumber) === 1 &&
    Number(line.ayahStart) === 1 &&
    Number(line.ayahEnd) === 1
  );
}

function getJuzStartLineNumbers(pageData) {
  const lineNumbers = new Set();
  if (!pageData?.lines?.length) return lineNumbers;
  if (!INDO_PAK_JUZ_START_PAGES.has(Number(pageData.page))) return lineNumbers;

  const startLine = pageData.lines.find((line) => isReadableAyahLine(line));
  if (startLine) lineNumbers.add(startLine.line);

  return lineNumbers;
}

function isReadableAyahLine(line) {
  return Boolean(
    line &&
      line.type === 'ayah' &&
      line.surahNumber &&
      line.ayahStart &&
      !isBismillahOnlyAyahLine(line)
  );
}

function isBismillahOnlyAyahLine(line) {
  return Boolean(
    line &&
      line.type === 'ayah' &&
      Number(line.surahNumber) === 1 &&
      Number(line.ayahStart) === 1 &&
      Number(line.ayahEnd) === 1
  );
}

function getRecitationHighlightRects(pageElement, pageData, playingVerseKey) {
  const [surahNumber, ayahNumber] = String(playingVerseKey || '')
    .split(':')
    .map(Number);

  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) return [];

  return getAyahHighlightRects(pageElement, pageData, surahNumber, ayahNumber)
    .map((rect) => ({
      ...rect,
      // Recitation is one continuous visual state. Slightly expand each
      // measured visual-line band vertically so adjacent lines read as a
      // coherent ayah highlight instead of isolated text boxes.
      top: Math.max(0, rect.top - 2),
      height: rect.height + 4,
    }));
}

function getSavedHighlightRects(pageElement, pageData, savedHighlights) {
  const rects = [];

  savedHighlights.forEach((highlight, reference) => {
    const color = typeof highlight === 'string' ? highlight : highlight?.color;
    if (!SAVED_HIGHLIGHTS.includes(color)) return;

    const { surahNumber, ayahNumber } = parseReference(reference);
    getAyahHighlightRects(pageElement, pageData, surahNumber, ayahNumber).forEach((rect) => {
      rects.push({ color, rect });
    });
  });

  return rects;
}
function getSavedWordHighlightRects(pageElement, pageData, savedHighlights) {
  const rects = [];

  savedHighlights.forEach((highlight, reference) => {
    const color = typeof highlight === 'string' ? highlight : highlight?.color;
    if (!SAVED_HIGHLIGHTS.includes(color)) return;

    const { surahNumber, ayahNumber } = parseReference(reference);
    const wordRange = getSavedWordRange(
      pageElement,
      pageData,
      highlight,
      surahNumber,
      ayahNumber,
    );

    getRangeHighlightRects(pageElement, wordRange, {
      horizontalPadding: 2,
      verticalInsetRatio: 0.22,
      minVerticalInset: 3,
      maxVerticalInset: 6,
    }).forEach((rect) => {
      rects.push({ color, rect });
    });
  });

  return rects;
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

  const candidates = getSavedWordCandidates(highlight);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const line = Number.isInteger(candidate.lineNumber)
      ? pageData.lines.find((item) => item.line === candidate.lineNumber)
      : pageData.lines[candidate.lineIndex];

    if (!lineContainsReference(line, surahNumber, ayahNumber)) continue;

    const textElement = getLineTextElement(pageElement, line.line);
    const range = createWordDomRange(textElement, line.text, candidate.wordIndex);
    if (range) return range;
  }

  return null;
}

function getSavedWordCandidates(highlight) {
  const candidates = [];
  const selectedWordId = parseSelectedWordId(highlight.selectedWordId);

  if (selectedWordId) candidates.push(selectedWordId);

  if (
    Number.isInteger(highlight.lineIndex) &&
    Number.isInteger(highlight.wordIndex)
  ) {
    candidates.push({
      lineIndex: highlight.lineIndex,
      wordIndex: highlight.wordIndex,
    });
  }

  return candidates;
}

function parseSelectedWordId(value) {
  const match = String(value || '').match(/^line:(\d+):word:(\d+)$/);
  if (!match) return null;

  return {
    lineNumber: Number(match[1]),
    wordIndex: Number(match[2]),
  };
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

function loadMushafFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return Promise.resolve();
  }

  const fontSet = document.fonts;
  return fontSet
    .load(`1em ${MUSHAF_FONT_FAMILY}`, MUSHAF_FONT_SAMPLE)
    .catch(() => undefined)
    .then(() => fontSet.ready)
    .catch(() => undefined);
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
