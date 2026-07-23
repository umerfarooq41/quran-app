import React, { useLayoutEffect, useRef } from 'react';
import { getSurah } from '../../../lib/quran';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';

const MIN_TEXT_SCALE = 0.68;
const MIN_WORD_SPACING = -4;

export function SurahHeader({ line, inlineBasmallah, hasSeparateBasmallah = false }) {
  const bannerRef = useRef(null);
  const surah = getSurah(line.surahNumber);
  const layout = hasSeparateBasmallah
    ? 'double'
    : inlineBasmallah
      ? 'inline'
      : 'single';

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return undefined;

    let frame = 0;

    const fitText = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        banner.querySelectorAll('[data-surah-header-fit]').forEach((element) => {
          element.style.setProperty('--header-word-spacing', '0px');
          element.style.setProperty('--header-text-scale', '1');

          const availableWidth = element.clientWidth;
          const naturalWidth = element.scrollWidth;
          if (!availableWidth || naturalWidth <= availableWidth) return;

          element.style.setProperty('--header-word-spacing', `${MIN_WORD_SPACING}px`);
          const tightenedWidth = element.scrollWidth;
          if (tightenedWidth <= availableWidth) return;

          const scale = Math.max(MIN_TEXT_SCALE, availableWidth / tightenedWidth);
          element.style.setProperty('--header-text-scale', scale.toFixed(4));
        });
      });
    };

    fitText();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitText);
    observer?.observe(banner);
    document.fonts?.ready?.then(fitText);
    window.addEventListener('resize', fitText);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', fitText);
    };
  }, [layout, line.surahNumber]);

  return (
    <div
      ref={bannerRef}
      className={`surah-banner surah-banner--${layout}`}
    >
      <span className="surah-banner-ayahs" data-surah-header-fit>
        <span className="surah-banner-fit-text">آياتها {surah?.verses}</span>
      </span>
      {(inlineBasmallah || hasSeparateBasmallah) && (
        <span className="surah-banner-basmallah" data-surah-header-fit>
          <span className="surah-banner-fit-text">{basmallahText}</span>
        </span>
      )}
      <span className="surah-banner-name" data-surah-header-fit>
        <span className="surah-banner-fit-text">{getDisplayLineText(line)}</span>
      </span>
    </div>
  );
}
