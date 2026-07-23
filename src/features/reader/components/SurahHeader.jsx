import React, { useLayoutEffect, useRef } from 'react';
import { getSurah } from '../../../lib/quran';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';

const MIN_TEXT_SCALE = 0.58;
const MIN_WORD_SPACING = -3.5;
const INLINE_MIN_GAP = 8;

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

        // In the inline layout the three labels form one justified group.
        // Keep two equal gaps and shrink content only when the complete group
        // cannot fit inside the ornament-safe width.
        if (banner.classList.contains('surah-banner--inline')) {
          const labels = [
            banner.querySelector('.surah-banner-ayahs'),
            banner.querySelector('.surah-banner-basmallah'),
            banner.querySelector('.surah-banner-name'),
          ].filter(Boolean);

          labels.forEach((label) => {
            label.style.setProperty('--header-word-spacing', '0px');
            label.style.setProperty('--header-text-scale', '1');
          });

          const styles = window.getComputedStyle(banner);
          const safeWidth = banner.clientWidth
            - parseFloat(styles.paddingLeft || '0')
            - parseFloat(styles.paddingRight || '0');

          const measuredWidth = () => labels.reduce((total, label) => {
            const text = label.querySelector('.surah-banner-fit-text');
            return total + (text?.getBoundingClientRect().width || 0);
          }, 0);

          let contentWidth = measuredWidth();
          const requiredWidth = () => contentWidth + (INLINE_MIN_GAP * 2);

          if (safeWidth > 0 && requiredWidth() > safeWidth) {
            // Tighten the longer side labels first so Bismillah remains stable.
            const sideLabels = [labels[2], labels[0]].filter(Boolean);
            sideLabels.forEach((label) => {
              if (requiredWidth() <= safeWidth) return;
              label.style.setProperty('--header-word-spacing', `${MIN_WORD_SPACING}px`);
              contentWidth = measuredWidth();
            });

            if (requiredWidth() > safeWidth) {
              const overflowScale = Math.max(
                MIN_TEXT_SCALE,
                (safeWidth - INLINE_MIN_GAP * 2) / Math.max(contentWidth, 1),
              );
              sideLabels.forEach((label) => {
                label.style.setProperty('--header-text-scale', overflowScale.toFixed(4));
              });
              contentWidth = measuredWidth();
            }

            // Bismillah is reduced only as the final fallback.
            if (requiredWidth() > safeWidth && labels[1]) {
              const finalScale = Math.max(
                MIN_TEXT_SCALE,
                (safeWidth - INLINE_MIN_GAP * 2) / Math.max(contentWidth, 1),
              );
              labels[1].style.setProperty('--header-text-scale', finalScale.toFixed(4));
            }
          }
        }
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
