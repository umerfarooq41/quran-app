import React, { useLayoutEffect, useRef } from 'react';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';
import { SurahHeader } from './SurahHeader';

export function QuranLine({ line, onSelect, marked = false, jumped = false, activeAudio = false, hasSeparateBasmallah = false }) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
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

  function startLongPress() {
    if (line.type === 'spacer') return;

    longPressed.current = false;
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;

      if (navigator.vibrate) {
        navigator.vibrate([24]);
      }

      onSelect();
    }, 430);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
  }

  return (
    <button
      ref={lineRef}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={(event) => {
        if (longPressed.current) {
          event.stopPropagation();
          longPressed.current = false;
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();

        if (line.type !== 'spacer') {
          onSelect();
        }
      }}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${jumped ? 'quran-line-jumped' : ''} ${activeAudio ? 'quran-line-audio-active' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${centered ? 'justify-center text-center' : 'justify-end text-right'}`}
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
