import React, { useLayoutEffect, useRef } from 'react';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';
import { SurahHeader } from './SurahHeader';

export function QuranLine({
  line,
  onSelect,
  marked = false,
  selected = false,
  jumped = false,
  activeAudio = false,
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
    pressedAyah.current = getAyahAtPoint(line, textRef.current, event.clientX, event.clientY);
    capturedPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;

      if (navigator.vibrate) {
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
          onSelect(getAyahAtPoint(line, textRef.current, event.clientX, event.clientY));
        }
      }}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${selected ? 'quran-line-selected-fallback' : ''} ${jumped ? 'quran-line-jumped' : ''} ${activeAudio ? 'quran-line-audio-active' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${centered ? 'justify-center text-center' : 'justify-end text-right'}`}
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

function getAyahAtPoint(line, textElement, clientX, clientY) {
  const offset = getTextOffsetAtPoint(textElement, clientX, clientY);
  if (offset === null) return line.ayahStart;

  const completedAyahsBeforePoint = [...line.text.slice(0, offset)]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint >= 0xE000 && codePoint <= 0xF8FF;
    })
    .length;

  return Math.min(line.ayahEnd, line.ayahStart + completedAyahsBeforePoint);
}

function getTextOffsetAtPoint(textElement, clientX, clientY) {
  if (!textElement) return null;

  const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition?.offsetNode && textElement.contains(caretPosition.offsetNode)) {
    return caretPosition.offset;
  }

  const caretRange = document.caretRangeFromPoint?.(clientX, clientY);
  if (caretRange?.startContainer && textElement.contains(caretRange.startContainer)) {
    return caretRange.startOffset;
  }

  return null;
}
