import React, { useLayoutEffect, useRef } from 'react';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';
import { getAyahAtRenderedPoint } from '../utils/ayahDomRange';
import { SurahHeader } from './SurahHeader';

export function QuranLine({
  line,
  onSelect,
  marked = false,
  jumped = false,
  hasSeparateBasmallah = false,
}) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
  const pressPoint = useRef(null);
  const pressedAyah = useRef(null);
  const capturedPointer = useRef(null);
  const isBasmallah = line.type === 'basmallah' || line.type === 'bismillah';
  const centered = line.isCentered || line.type === 'surah_name' || isBasmallah;
  const text = getDisplayLineText(line);
  const inlineBasmallah = line.type === 'surah_name' && line.surahNumber !== 1 && line.surahNumber !== 9 && !hasSeparateBasmallah;

  useLayoutEffect(() => {
    const el = textRef.current;
    const container = lineRef.current;

    if (!el || !container || centered || line.type === 'spacer' || line.type === 'surah_name' || isBasmallah) {
      if (el) el.style.wordSpacing = '';
      return;
    }

    el.style.wordSpacing = '0px';

    const available = container.offsetWidth;
    const actual = el.scrollWidth;

    if (!available || !actual || actual <= available) {
      el.style.wordSpacing = '';
      return;
    }

    const spaces = Math.max(1, (text.match(/\s+/g) || []).length);
    const deficit = actual - available;
    const adjustment = -(deficit / spaces);

    el.style.wordSpacing = Math.max(-12, adjustment).toFixed(2) + 'px';
  });

  function startLongPress(event) {
    if (line.type !== 'ayah' || !line.ayahStart) return;

    longPressed.current = false;
    pressPoint.current = { x: event.clientX, y: event.clientY };
    pressedAyah.current = getAyahAtRenderedPoint(line, textRef.current, event.clientX, event.clientY);
    capturedPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;

      if (document.documentElement.dataset.haptics !== 'off' && navigator.vibrate) {
        navigator.vibrate([24]);
      }

      onSelect(pressedAyah.current || line.ayahStart);
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
          onSelect(getAyahAtRenderedPoint(line, textRef.current, event.clientX, event.clientY));
        }
      }}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${jumped ? 'quran-line-jumped' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${centered ? 'justify-center text-center' : 'justify-end text-right'}`}
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
          {text}
        </span>
      )}
    </button>
  );
}
