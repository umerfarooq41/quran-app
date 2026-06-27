import React from 'react';
import { getSurah } from '../../../lib/quran';
import { basmallahText, getDisplayLineText } from '../../../utils/quranLabels';

export function SurahHeader({ line, inlineBasmallah }) {
  const surah = getSurah(line.surahNumber);

  return (
    <div className={`surah-banner ${inlineBasmallah ? 'surah-banner-inline' : ''}`}>
      <span className="surah-banner-ayahs">آياتها {surah?.verses}</span>
      {inlineBasmallah && <span className="surah-banner-basmallah">{basmallahText}</span>}
      <span className="surah-banner-name">{getDisplayLineText(line)}</span>
    </div>
  );
}
