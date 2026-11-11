import React, { useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { getDisplayLineText } from '../../../utils/quranLabels';
import {
  getAyahRangeRects,
  getAyahAtRenderedPoint,
  getRenderedWordTokens,
  getWordAtRenderedPoint,
} from '../utils/ayahDomRange';
import { SurahHeader } from './SurahHeader';
import { getAyahEndCluster, isAyahMarkerToken } from '../../../lib/mushafText';
import { triggerHaptic } from '../../../lib/haptics';
import { mapRenderedTokensToQuranWords } from '../../../lib/quranWordMap';

const LINE_FIT_EVENT = 'quran-line-fit';
const LINE_EDGE_GUTTER = 4;
const MAX_POSITIVE_WORD_SPACING = 9;
const CENTER_FALLBACK_WORD_SPACING = 10;
const OPENING_PAGE_WORD_SPACING = 4;
const MAX_NEGATIVE_WORD_SPACING = 0;
const MUSHAF_FONT_FAMILY = 'IndopakNastaleeq';
const MUSHAF_FONT_SAMPLE = 'اللَّهُ';
const LINE_REFIT_DELAYS = [60, 180, 420];

export const QuranLine = React.memo(function QuranLine({
  line,
  onSelect,
  onTap,
  interactionsBlocked = false,
  onBlockedInteraction,
  marked = false,
  jumped = false,
  isJuzStartLine = false,
  hasSeparateBasmallah = false,
  coveredByCombinedHeader = false,
  forceCentered = false,
  playingVerseKey = null,
  playingWordPosition = null,
  playingWordOccurrenceIndex = null,
  quarterMarkers = null,
  bookmarkMarkers = null,
  markerFlashTarget = null,
}) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const press = useRef({ phase: 'idle' });
  useEffect(() => () => window.clearTimeout(press.current.timer), []);
  const isBasmallah = line.type === 'basmallah' || line.type === 'bismillah';
  const centered = (
    forceCentered ||
    line.isCentered ||
    line.type === 'surah_name' ||
    line.type === 'spacer' ||
    isBasmallah
  );
  const text = getDisplayLineText(line);
  const renderedTokens = getRenderedWordTokens(text);
  const markerTokens = useMemo(() => new Set(
    renderedTokens
      .filter((token) => token.isWord && isAyahMarkerToken(token.text, line))
      .map((token) => token.text),
  ), [line, renderedTokens]);
  const wordMetadataByTokenIndex = useMemo(
    () => mapRenderedTokensToQuranWords(line, renderedTokens),
    [line, renderedTokens],
  );
  const inlineBasmallah = line.type === 'surah_name' && line.surahNumber !== 1 && line.surahNumber !== 9 && !hasSeparateBasmallah;

  useLayoutEffect(() => {
    const el = textRef.current;
    const container = lineRef.current;
    let frame = 0;
    let disposed = false;
    let lastFit = '';
    const timers = new Set();

    if (!el || !container) return undefined;

    const fitLine = () => {
      if (disposed) return;

      el.style.wordSpacing = '0px';
      el.style.transform = 'scaleX(1)';
      container.classList.remove('quran-line-soft-centered');

      const availableWidth = Math.max(
        0,
        container.getBoundingClientRect().width - LINE_EDGE_GUTTER,
      );
      const naturalWidth = measureTextWidth(el);
      const spaceCount = countWordGaps(text);
      let wordSpacing = 0;
      let scale = 1;

      if (availableWidth > 0 && naturalWidth > 0) {
        if (centered) {
          if (forceCentered && line.type === 'ayah' && spaceCount > 0 && naturalWidth < availableWidth) {
            wordSpacing = Math.min(
              OPENING_PAGE_WORD_SPACING,
              Math.max(0, (availableWidth - naturalWidth) / spaceCount),
            );
            el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;

            const spacedWidth = measureTextWidth(el);
            if (spacedWidth > availableWidth) {
              wordSpacing = Math.max(
                0,
                wordSpacing - ((spacedWidth - availableWidth) / spaceCount),
              );
              el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;
            }
          }

          const centeredWidth = measureTextWidth(el);
          if (centeredWidth > availableWidth) {
            scale = Math.min(1, availableWidth / centeredWidth);
          }
        } else if (naturalWidth > availableWidth) {
          if (spaceCount > 0) {
            wordSpacing = Math.max(
              MAX_NEGATIVE_WORD_SPACING,
              (availableWidth - naturalWidth) / spaceCount,
            );
            el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;
          }

          const compressedWidth = measureTextWidth(el);
          if (compressedWidth > availableWidth) {
            scale = Math.min(1, availableWidth / compressedWidth);
          }
        } else if (line.type === 'ayah' && spaceCount > 0) {
          const requiredWordSpacing = (availableWidth - naturalWidth) / spaceCount;

          if (requiredWordSpacing > CENTER_FALLBACK_WORD_SPACING) {
            container.classList.add('quran-line-soft-centered');

            wordSpacing = MAX_POSITIVE_WORD_SPACING;
            el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;

            const spacedWidth = measureTextWidth(el);
            if (spacedWidth > availableWidth) {
              wordSpacing = Math.max(
                0,
                wordSpacing - ((spacedWidth - availableWidth) / spaceCount),
              );
              el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;
            }
          } else {
            wordSpacing = Math.min(
              MAX_POSITIVE_WORD_SPACING,
              requiredWordSpacing,
            );
            wordSpacing = Math.max(0, wordSpacing);
            el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;

            const expandedWidth = measureTextWidth(el);
            if (expandedWidth > availableWidth) {
              wordSpacing = Math.max(
                0,
                wordSpacing - ((expandedWidth - availableWidth) / spaceCount),
              );
              el.style.wordSpacing = `${wordSpacing.toFixed(2)}px`;

              const correctedWidth = measureTextWidth(el);
              if (correctedWidth > availableWidth) {
                scale = Math.min(1, availableWidth / correctedWidth);
              }
            }
          }
        }
      }

      const scaleValue = scale.toFixed(5);
      const inverseScaleValue = scale > 0 ? (1 / scale).toFixed(5) : '1.00000';

      el.style.transform = `scaleX(${scaleValue})`;
      container.style.setProperty('--quran-line-scale', scaleValue);
      container.style.setProperty('--quran-marker-scale-x', inverseScaleValue);
      container.dataset.lineScale = scaleValue;
      container.dataset.wordSpacing = wordSpacing.toFixed(2);

      const fitSignature = [
        Math.round(availableWidth * 100) / 100,
        wordSpacing.toFixed(2),
        scale.toFixed(5),
      ].join(':');

      if (fitSignature !== lastFit) {
        lastFit = fitSignature;
        container.dispatchEvent(new CustomEvent(LINE_FIT_EVENT, { bubbles: true }));
      }
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fitLine);
    };

    const clearFitTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };

    const scheduleFitBurst = () => {
      clearFitTimers();
      scheduleFit();

      LINE_REFIT_DELAYS.forEach((delay) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          scheduleFit();
        }, delay);
        timers.add(timer);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleFitBurst();
    };

    fitLine();
    scheduleFitBurst();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleFit);
    resizeObserver?.observe(container);

    loadMushafFont().then(() => {
      if (!disposed) scheduleFitBurst();
    });
    document.fonts?.addEventListener?.('loadingdone', scheduleFitBurst);
    document.fonts?.addEventListener?.('loadingerror', scheduleFitBurst);
    window.addEventListener('load', scheduleFitBurst);
    window.addEventListener('pageshow', scheduleFitBurst);
    window.addEventListener('focus', scheduleFitBurst);
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.visualViewport?.addEventListener('resize', scheduleFit);

    return () => {
      disposed = true;
      clearFitTimers();
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', scheduleFitBurst);
      document.fonts?.removeEventListener?.('loadingerror', scheduleFitBurst);
      window.removeEventListener('load', scheduleFitBurst);
      window.removeEventListener('pageshow', scheduleFitBurst);
      window.removeEventListener('focus', scheduleFitBurst);
      window.removeEventListener('resize', scheduleFit);
      window.removeEventListener('orientationchange', scheduleFit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.visualViewport?.removeEventListener('resize', scheduleFit);
    };
  }, [centered, line.line, line.type, text]);

  // Pointer Events own the entire press. Native pan-y cancellation terminates
  // pending selection; releasing an activated press never dismisses its overlay.
  function startLongPress(event) {
    if (event.button !== 0 || !event.isPrimary || line.type !== 'ayah') return;
    window.clearTimeout(press.current.timer);
    if (interactionsBlocked) {
      press.current = { phase: 'cancelled' };
      onBlockedInteraction?.();
      return;
    }
    const selection = getSelectionFromEvent(event);
    if (!Number.isInteger(selection?.wordIndex)) return;
    const state = { phase: 'pending', id: event.pointerId, x: event.clientX, y: event.clientY, selection };
    press.current = state;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    state.timer = window.setTimeout(() => {
      if (press.current !== state || state.phase !== 'pending') return;
      state.phase = 'activated';
      triggerHaptic('longPress');
      onSelect(state.selection);
    }, 430);
  }

  function handlePointerMove(event) {
    const state = press.current;
    if (state.id !== event.pointerId || state.phase !== 'pending') return;
    if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > 12) {
      window.clearTimeout(state.timer);
      state.phase = 'scrolling';
    }
  }

  function finishPress(event) {
    const state = press.current;
    if (state.id !== event.pointerId) return;
    window.clearTimeout(state.timer);
    state.phase = state.phase === 'pending' && event.type !== 'pointercancel'
      ? 'completed' : 'cancelled';
  }

  function getSelectionFromEvent(event) {
    const wordIndex = getWordAtRenderedPoint(
      textRef.current,
      event.clientX,
      event.clientY,
    );
    const wordElement = Number.isInteger(wordIndex)
      ? textRef.current?.querySelector(`[data-quran-word-index="${wordIndex}"]`)
      : null;
    // Use the authoritative Quran word object that was already aligned for
    // rendering. Reading the verse back from a DOM data attribute was fragile
    // on split-page RTL ayahs such as 54:48, where a continuation line also
    // contains the following ayah.
    const wordMetadata = Number.isInteger(wordIndex)
      ? wordMetadataByTokenIndex.get(wordIndex) || null
      : null;
    const metadataVerseKey = String(wordMetadata?.verseKey || '');
    const [metadataSurahNumber, metadataAyahNumber] = metadataVerseKey
      .split(':')
      .map(Number);
    const ayahNumber = Number.isInteger(metadataAyahNumber) && metadataAyahNumber > 0
      ? metadataAyahNumber
      : getAyahAtRenderedPoint(
        line,
        textRef.current,
        event.clientX,
        event.clientY,
      );
    const surahNumber = Number.isInteger(metadataSurahNumber) && metadataSurahNumber > 0
      ? metadataSurahNumber
      : Number(line.surahNumber);
    const wordToken = renderedTokens.find((token) => (
      token.isWord && token.wordIndex === wordIndex
    ));
    const ayahRect = chooseAnchorRect(
      getAyahRangeRects(line, textRef.current, ayahNumber),
      event.clientX,
      event.clientY,
    );

    return {
      surahNumber,
      ayahNumber,
      verseKey: metadataVerseKey || `${surahNumber}:${ayahNumber}`,
      wordIndex,
      selectedWord: wordToken?.text || '',
      selectedWordId: Number.isInteger(wordMetadata?.id)
        ? `quran-word:${wordMetadata.id}`
        : Number.isInteger(wordIndex)
          ? `line:${line.line}:word:${wordIndex}`
          : '',
      selectedWordRect: normalizeRect(wordElement?.getBoundingClientRect()),
      ayahRect: normalizeRect(ayahRect),
      pointer: {
        x: event.clientX,
        y: event.clientY,
      },
    };
  }

  return (
    <button
      ref={lineRef}
      data-quran-line={line.line}
      onPointerDown={startLongPress}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPress}
      onPointerCancel={finishPress}
      onSelectStart={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        // Consume the opening gesture before consulting newly rendered overlay
        // state: that state now blocks presses and must not dismiss itself.
        if (['activated', 'cancelled', 'scrolling'].includes(press.current.phase)) {
          event.preventDefault();
          event.stopPropagation();
          press.current = { phase: 'idle' };
          return;
        }
        if (interactionsBlocked) {
          event.preventDefault();
          event.stopPropagation();
          onBlockedInteraction?.();
          return;
        }
        if (line.type === 'ayah') {
          const selection = getSelectionFromEvent(event);
          if (!Number.isInteger(selection?.wordIndex)) return;

          event.preventDefault();
          event.stopPropagation();
          onTap?.(selection);
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${jumped ? 'quran-line-jumped' : ''} ${isJuzStartLine ? 'quran-line--juz-start' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${coveredByCombinedHeader ? 'quran-line--combined-header-covered' : ''} ${centered ? 'quran-line-centered' : 'quran-line-normal'}`}
      aria-label={line.type === 'spacer' ? 'Blank line' : undefined}
      aria-hidden={coveredByCombinedHeader ? true : undefined}
      tabIndex={line.type === 'spacer' || coveredByCombinedHeader ? -1 : 0}
    >
      {coveredByCombinedHeader ? null : line.type === 'surah_name' ? (
        <SurahHeader
          line={line}
          inlineBasmallah={inlineBasmallah}
          hasSeparateBasmallah={hasSeparateBasmallah}
        />
      ) : (
        <span
          ref={textRef}
          className="quran-line-text"
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}
        >
          {renderedTokens.map((token, index) => {
            if (!token.isWord) {
              return (
                <React.Fragment key={`space-${token.start}-${index}`}>
                  {token.text}
                </React.Fragment>
              );
            }

            const isMarker = markerTokens.has(token.text);
            const markerAyahNumber = isMarker ? getMarkerAyahNumber(line, token.text) : null;
            const markerReference = markerAyahNumber ? `${line.surahNumber}:${markerAyahNumber}` : '';
            const bookmarkTone = markerReference
              ? getBookmarkTone(bookmarkMarkers?.get(markerReference))
              : '';
            const quarterMarkerId = isMarker
              ? getQuarterMarkerId(line, token.text, quarterMarkers)
              : null;
            const markerFlashTone = (
              markerAyahNumber
              && markerFlashTarget?.flashMode === 'ayah-marker'
              && Number(markerFlashTarget.surahNumber) === Number(line.surahNumber)
              && Number(markerFlashTarget.ayahNumber) === Number(markerAyahNumber)
            ) ? (markerFlashTarget.tone || 'quarter') : '';
            const wordMeta = wordMetadataByTokenIndex.get(token.wordIndex) || null;



            const isRecitedAyah = Boolean(
              !isMarker
              && wordMeta?.verseKey
              && wordMeta.verseKey === playingVerseKey
            );
            const isRecitedWord = Boolean(
              isRecitedAyah
              && Number(wordMeta.position) === Number(playingWordPosition)
            );
            const className = [
              'quran-word',
              isRecitedAyah ? 'is-recited-ayah' : '',
              isRecitedWord ? 'is-recited-word' : '',
            ].filter(Boolean).join(' ');

            return (
              <span
                key={`${token.start}-${token.end}`}
                className={className}
                data-quran-word-index={token.wordIndex}
                data-verse-key={!isMarker ? wordMeta?.verseKey : undefined}
                data-word-position={!isMarker ? wordMeta?.position : undefined}
                data-word-occurrence-index={isRecitedWord ? playingWordOccurrenceIndex : undefined}
              >
                {renderWordText(token.text, isMarker, quarterMarkerId, bookmarkTone, markerFlashTone)}
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
});

function renderWordText(text = '', isMarkerToken = false, quarterMarkerId = null, bookmarkTone = '', markerFlashTone = '') {
  if (!isMarkerToken) return text;

  const markerClasses = [
    'quran-ayah-marker',
    quarterMarkerId ? 'quran-ayah-marker--quarter' : '',
    bookmarkTone ? 'quran-ayah-marker--bookmark' : '',
    bookmarkTone ? `quran-ayah-marker--bookmark-${bookmarkTone}` : '',
    markerFlashTone ? 'quran-ayah-marker--flash' : '',
    markerFlashTone ? `quran-ayah-marker--flash-${markerFlashTone}` : '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={markerClasses}
      data-quarter-marker={quarterMarkerId || undefined}
      data-bookmark-tone={bookmarkTone || undefined}
      aria-hidden="true"
      title={text}
    >
      <span className="quran-ayah-marker-glyph">{text}</span>
    </span>
  );
}

function getMarkerAyahNumber(line, markerText) {
  if (!line?.surahNumber || !markerText) return null;
  for (let ayah = Number(line.ayahStart); ayah <= Number(line.ayahEnd); ayah += 1) {
    if (getAyahEndCluster(line.surahNumber, ayah) === markerText) return ayah;
  }
  return null;
}

function getBookmarkTone(category) {
  if (category === 'Reading' || category === 'Recitation') return 'reading';
  if (category === 'Memorize') return 'memorize';
  if (category === 'Reflect' || category === 'Tadabbur') return 'tadabbur';
  if (category === 'Notes') return 'notes';
  return '';
}

function getQuarterMarkerId(line, markerText, quarterMarkers) {
  if (!quarterMarkers?.length || !line?.surahNumber || !markerText) return null;

  // IndoPak ayah numbers are encoded as private-use font glyphs, so their
  // rendered marker token does not contain ASCII digits. Match the marker's
  // actual Quran end cluster to the quarter target instead.
  const target = quarterMarkers.find((item) => (
    Number(item.surah) === Number(line.surahNumber)
    && Number(item.ayah) >= Number(line.ayahStart)
    && Number(item.ayah) <= Number(line.ayahEnd)
    && getAyahEndCluster(item.surah, item.ayah) === markerText
  ));
  return target?.id || null;
}

function countWordGaps(value = '') {
  return Math.max(0, value.trim().split(/\s+/).filter(Boolean).length - 1);
}

function measureTextWidth(element) {
  if (!element || typeof document === 'undefined') return 0;

  const range = document.createRange();
  range.selectNodeContents(element);
  const width = range.getBoundingClientRect().width;
  range.detach?.();
  return width;
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

function chooseAnchorRect(rects, clientX, clientY) {
  if (!rects?.length) return null;

  let closestRect = rects[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  rects.forEach((rect) => {
    if (!rect?.width || !rect?.height) return;

    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      closestRect = rect;
      closestDistance = -1;
      return;
    }

    if (closestDistance < 0) return;

    const deltaX = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const deltaY = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestRect = rect;
    }
  });

  return closestRect;
}

function normalizeRect(rect) {
  if (!rect?.width || !rect?.height) return null;

  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}
