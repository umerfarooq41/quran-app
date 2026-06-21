import React, { useLayoutEffect, useRef } from 'react';
import { getDisplayLineText } from '../../../utils/quranLabels';
import {
  getAyahAtRenderedPoint,
  getRenderedWordTokens,
  getWordAtRenderedPoint,
} from '../utils/ayahDomRange';
import { SurahHeader } from './SurahHeader';

const LINE_FIT_EVENT = 'quran-line-fit';
const LINE_EDGE_GUTTER = 4;
const MAX_POSITIVE_WORD_SPACING = 6;
const OPENING_PAGE_WORD_SPACING = 4;
const MAX_NEGATIVE_WORD_SPACING = 0;
const AYAH_MARKER_CLUSTER = /([\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]*[\uF500-\uF8FF]+[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]*)/gu;
export function QuranLine({
  line,
  onSelect,
  marked = false,
  jumped = false,
  hasSeparateBasmallah = false,
  forceCentered = false,
}) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
  const pressPoint = useRef(null);
  const pressedSelection = useRef(null);
  const capturedPointer = useRef(null);
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
  const inlineBasmallah = line.type === 'surah_name' && line.surahNumber !== 1 && line.surahNumber !== 9 && !hasSeparateBasmallah;

  useLayoutEffect(() => {
    const el = textRef.current;
    const container = lineRef.current;
    let frame = 0;
    let disposed = false;
    let lastFit = '';

    if (!el || !container) return undefined;

    const fitLine = () => {
      if (disposed) return;

      el.style.wordSpacing = '0px';
      el.style.transform = 'scaleX(1)';

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
          wordSpacing = Math.min(
            MAX_POSITIVE_WORD_SPACING,
            (availableWidth - naturalWidth) / spaceCount,
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

      el.style.transform = `scaleX(${scale.toFixed(5)})`;
      container.dataset.lineScale = scale.toFixed(5);
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

    fitLine();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleFit);
    resizeObserver?.observe(container);

    document.fonts?.ready?.then(() => {
      if (!disposed) scheduleFit();
    });
    document.fonts?.addEventListener?.('loadingdone', scheduleFit);
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    window.visualViewport?.addEventListener('resize', scheduleFit);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', scheduleFit);
      window.removeEventListener('resize', scheduleFit);
      window.removeEventListener('orientationchange', scheduleFit);
      window.visualViewport?.removeEventListener('resize', scheduleFit);
    };
  }, [centered, line.line, line.type, text]);

  function startLongPress(event) {
    if (line.type !== 'ayah' || !line.ayahStart) return;

    longPressed.current = false;
    pressPoint.current = { x: event.clientX, y: event.clientY };
    pressedSelection.current = {
      ayahNumber: getAyahAtRenderedPoint(
        line,
        textRef.current,
        event.clientX,
        event.clientY,
      ),
      wordIndex: getWordAtRenderedPoint(
        textRef.current,
        event.clientX,
        event.clientY,
      ),
    };
    capturedPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;

      if (document.documentElement.dataset.haptics !== 'off' && navigator.vibrate) {
        navigator.vibrate([24]);
      }

      onSelect({
        ayahNumber: pressedSelection.current?.ayahNumber || line.ayahStart,
        wordIndex: pressedSelection.current?.wordIndex,
      });
    }, 430);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
    pressPoint.current = null;
  }

  function finishPress(event) {
    cancelLongPress();

    if (capturedPointer.current !== null && event.currentTarget.hasPointerCapture?.(capturedPointer.current)) {
      event.currentTarget.releasePointerCapture(capturedPointer.current);
    }

    capturedPointer.current = null;
    window.setTimeout(() => {
      longPressed.current = false;
    }, 0);
  }

  function handlePointerMove(event) {
    if (!pressPoint.current) return;

    const deltaX = event.clientX - pressPoint.current.x;
    const deltaY = event.clientY - pressPoint.current.y;

    if (Math.hypot(deltaX, deltaY) > 12) {
      cancelLongPress();
    }
  }

  return (
    <button
      ref={lineRef}
      data-quran-line={line.line}
      onPointerDown={startLongPress}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={finishPress}
      onSelectStart={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        if (longPressed.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressed.current = false;
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();

        if (line.type === 'ayah' && line.ayahStart) {
          onSelect({
            ayahNumber: getAyahAtRenderedPoint(
              line,
              textRef.current,
              event.clientX,
              event.clientY,
            ),
            wordIndex: getWordAtRenderedPoint(
              textRef.current,
              event.clientX,
              event.clientY,
            ),
          });
        }
      }}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${jumped ? 'quran-line-jumped' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${centered ? 'quran-line-centered' : 'quran-line-normal'}`}
      aria-label={line.type === 'spacer' ? 'Blank line' : text}
      tabIndex={line.type === 'spacer' ? -1 : 0}
    >
      {line.type === 'surah_name' ? (
        <SurahHeader line={line} inlineBasmallah={inlineBasmallah} />
      ) : (
        <span
          ref={textRef}
          className="quran-line-text"
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}
        >
          {renderedTokens.map((token, index) => (
            token.isWord ? (
              <span
                key={`${token.start}-${token.end}`}
                className="quran-word"
                data-quran-word-index={token.wordIndex}
              >
                {renderWordText(token.text)}
              </span>
            ) : (
              <React.Fragment key={`space-${token.start}-${index}`}>
                {token.text}
              </React.Fragment>
            )
          ))}
        </span>
      )}
    </button>
  );
}

function renderWordText(text = '') {
  const parts = splitAyahMarkerClusters(text);
  if (parts.length === 1 && !parts[0].isMarker) return text;

  return parts.map((part, index) => {
    if (!part.isMarker) {
      return <React.Fragment key={`word-text-${index}`}>{part.text}</React.Fragment>;
    }

    return (
      <span
        key={`ayah-marker-${index}`}
        className="quran-ayah-marker"
        aria-hidden="true"
        title={part.text}
      >
        {part.text}
      </span>
    );
  });
}

function splitAyahMarkerClusters(text = '') {
  const value = String(text);
  const parts = [];
  let lastIndex = 0;
  let match = AYAH_MARKER_CLUSTER.exec(value);

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ text: value.slice(lastIndex, match.index), isMarker: false });
    }

    parts.push({ text: match[0], isMarker: true });
    lastIndex = match.index + match[0].length;
    match = AYAH_MARKER_CLUSTER.exec(value);
  }

  if (lastIndex < value.length) {
    parts.push({ text: value.slice(lastIndex), isMarker: false });
  }

  AYAH_MARKER_CLUSTER.lastIndex = 0;
  return parts.length ? parts : [{ text: value, isMarker: false }];
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
