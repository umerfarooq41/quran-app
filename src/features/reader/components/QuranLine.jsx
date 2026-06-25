import React, { useMemo, useLayoutEffect, useRef } from 'react';
import { getDisplayLineText } from '../../../utils/quranLabels';
import {
  getAyahRangeRects,
  getAyahAtRenderedPoint,
  getRenderedWordTokens,
  getWordAtRenderedPoint,
} from '../utils/ayahDomRange';
import { SurahHeader } from './SurahHeader';
import { isAyahMarkerToken } from '../../../lib/mushafText';

const LINE_FIT_EVENT = 'quran-line-fit';
const LINE_EDGE_GUTTER = 4;
const MAX_POSITIVE_WORD_SPACING = 9;
const CENTER_FALLBACK_WORD_SPACING = 10;
const OPENING_PAGE_WORD_SPACING = 4;
const MAX_NEGATIVE_WORD_SPACING = 0;

export function QuranLine({
  line,
  onSelect,
  onTap,
  interactionsBlocked = false,
  onBlockedInteraction,
  marked = false,
  jumped = false,
  hasSeparateBasmallah = false,
  forceCentered = false,
}) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
  const ignoreNextClick = useRef(false);
  const pressMoved = useRef(false);
  const pressPoint = useRef(null);
  const pressedSelection = useRef(null);
  const capturedPointer = useRef(null);
  const blockedPress = useRef(false);
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

    if (interactionsBlocked) {
      blockedPress.current = true;
      ignoreNextClick.current = true;
      onBlockedInteraction?.();
      return;
    }

    longPressed.current = false;
    ignoreNextClick.current = false;
    pressMoved.current = false;
    pressPoint.current = { x: event.clientX, y: event.clientY };
    pressedSelection.current = getSelectionFromEvent(event);
    capturedPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      ignoreNextClick.current = true;

      if (document.documentElement.dataset.haptics !== 'off' && navigator.vibrate) {
        navigator.vibrate([24]);
      }

      onSelect({
        ayahNumber: pressedSelection.current?.ayahNumber || line.ayahStart,
        wordIndex: pressedSelection.current?.wordIndex,
        selectedWord: pressedSelection.current?.selectedWord || '',
        selectedWordId: pressedSelection.current?.selectedWordId || '',
        selectedWordRect: pressedSelection.current?.selectedWordRect || null,
        ayahRect: pressedSelection.current?.ayahRect || null,
        pointer: pressedSelection.current?.pointer || null,
      });
    }, 430);
  }

  function cancelLongPress(clearBlockedPress = true) {
    window.clearTimeout(longPressTimer.current);
    pressPoint.current = null;
    if (clearBlockedPress && blockedPress.current) {
      blockedPress.current = false;
      ignoreNextClick.current = false;
    }
  }

  function finishPress(event) {
    const hadLongPress = longPressed.current;
    cancelLongPress(false);

    if (capturedPointer.current !== null && event.currentTarget.hasPointerCapture?.(capturedPointer.current)) {
      event.currentTarget.releasePointerCapture(capturedPointer.current);
    }

    capturedPointer.current = null;
    if (hadLongPress) ignoreNextClick.current = true;
    if (blockedPress.current) {
      window.setTimeout(() => {
        blockedPress.current = false;
        ignoreNextClick.current = false;
      }, 80);
    }
    window.setTimeout(() => {
      longPressed.current = false;
    }, 0);
  }

  function handlePointerMove(event) {
    if (!pressPoint.current) return;

    const deltaX = event.clientX - pressPoint.current.x;
    const deltaY = event.clientY - pressPoint.current.y;

    if (Math.hypot(deltaX, deltaY) > 12) {
      pressMoved.current = true;
      cancelLongPress();
    }
  }

  function getSelectionFromEvent(event) {
    const ayahNumber = getAyahAtRenderedPoint(
      line,
      textRef.current,
      event.clientX,
      event.clientY,
    );
    const wordIndex = getWordAtRenderedPoint(
      textRef.current,
      event.clientX,
      event.clientY,
    );
    const wordElement = Number.isInteger(wordIndex)
      ? textRef.current?.querySelector(`[data-quran-word-index="${wordIndex}"]`)
      : null;
    const wordToken = renderedTokens.find((token) => (
      token.isWord && token.wordIndex === wordIndex
    ));
    const ayahRect = chooseAnchorRect(
      getAyahRangeRects(line, textRef.current, ayahNumber),
      event.clientX,
      event.clientY,
    );

    return {
      ayahNumber,
      wordIndex,
      selectedWord: wordToken?.text || '',
      selectedWordId: Number.isInteger(wordIndex)
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
      onPointerLeave={cancelLongPress}
      onPointerCancel={finishPress}
      onSelectStart={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        if (interactionsBlocked) {
          event.preventDefault();
          event.stopPropagation();
          blockedPress.current = false;
          ignoreNextClick.current = false;
          pressMoved.current = false;
          onBlockedInteraction?.();
          return;
        }

        if (longPressed.current || ignoreNextClick.current || pressMoved.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressed.current = false;
          blockedPress.current = false;
          ignoreNextClick.current = false;
          pressMoved.current = false;
          return;
        }

        if (line.type === 'ayah' && line.ayahStart) {
          event.preventDefault();
          event.stopPropagation();
          onTap?.(getSelectionFromEvent(event));
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        ignoreNextClick.current = true;

        if (interactionsBlocked) {
          onBlockedInteraction?.();
          return;
        }

        if (line.type === 'ayah' && line.ayahStart) {
          onSelect(getSelectionFromEvent(event));
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
                {renderWordText(token.text, markerTokens.has(token.text))}
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

function renderWordText(text = '', isMarkerToken = false) {
  if (!isMarkerToken) return text;

  return (
    <span
      className="quran-ayah-marker"
      aria-hidden="true"
      title={text}
    >
      <span className="quran-ayah-marker-glyph">{text}</span>
    </span>
  );
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
