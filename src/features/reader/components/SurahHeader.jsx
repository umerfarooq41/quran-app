import React from 'react';
import { getSurah } from '../../../lib/quran';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';

function SurahHeaderOrnament({ side = 'left', compact = false }) {
  return (
    <svg
      className={`surah-header-ornament ${side} ${compact ? 'compact' : ''}`}
      viewBox="0 0 90 54"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={side === 'right' ? 'translate(90 0) scale(-1 1)' : undefined}>
        <path
          d="M88 27H42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M42 27 C36 12 18 9 9 19 C1 28 5 43 18 45 C31 47 39 38 42 27Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M33 27 C28 19 18 18 14 25 C10 33 18 39 26 35 C30 33 32 30 33 27Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity=".76"
        />
        <path
          d="M20 17 C25 20 26 24 23 28 C21 31 18 31 16 29"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity=".78"
        />
        <path
          d="M20 37 C25 34 26 30 23 26 C21 23 18 23 16 25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity=".78"
        />
        <circle cx="18" cy="27" r="2.2" fill="currentColor" opacity=".66" />
        <circle cx="31" cy="17" r="1.5" fill="currentColor" opacity=".58" />
        <circle cx="31" cy="37" r="1.5" fill="currentColor" opacity=".58" />
      </g>
    </svg>
  );
}

export function SurahHeader({ line, inlineBasmallah }) {
  const surah = getSurah(line.surahNumber);
  const surahName = getDisplayLineText(line);
  const ayahCount = surah?.verses ?? '';

  if (inlineBasmallah) {
    return (
      <div className="surah-banner surah-banner-inline surah-banner-ornate">
        <SurahHeaderOrnament side="left" />
        <span className="surah-banner-ayahs">آياتها {ayahCount}</span>
        <span className="surah-banner-basmallah">{basmallahText}</span>
        <span className="surah-banner-name">{surahName}</span>
        <SurahHeaderOrnament side="right" />
      </div>
    );
  }

  return (
    <div className="surah-banner surah-banner-separate surah-banner-ornate">
      <SurahHeaderOrnament side="left" />
      <span className="surah-banner-ayahs">آياتها {ayahCount}</span>
      <span className="surah-banner-name">{surahName}</span>
      <SurahHeaderOrnament side="right" />
    </div>
  );
}

export function BismillahHeader() {
  return (
    <div className="bismillah-banner bismillah-banner-ornate">
      <SurahHeaderOrnament side="left" compact />
      <span className="bismillah-banner-text">{basmallahText}</span>
      <SurahHeaderOrnament side="right" compact />
    </div>
  );
}
