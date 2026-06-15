import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  findPageForJuz,
  findPageForReference,
  getMushafPageNumber,
  surahs,
} from '../lib/quran';
import { getIndexJuzHeading, getIndexJuzLabel } from '../utils/quranLabels';

export default function IndexScreen() {
  const [tab, setTab] = useState('juz');
  const setView = useAppStore((state) => state.setView);

  return (
    <section className="index-screen">
      <header className="index-header">
        <h1>Index</h1>
        <button className="index-close-pill" onClick={() => setView('reader', 'back')} aria-label="Close index">
          <X size={28} strokeWidth={2.4} />
        </button>
      </header>

      <div className="index-segment" role="tablist" aria-label="Index type">
        <button
          type="button"
          className={tab === 'juz' ? 'active' : ''}
          onClick={() => setTab('juz')}
          role="tab"
          aria-selected={tab === 'juz'}
        >
          Juz&apos;s
        </button>
        <button
          type="button"
          className={tab === 'surahs' ? 'active' : ''}
          onClick={() => setTab('surahs')}
          role="tab"
          aria-selected={tab === 'surahs'}
        >
          Surahs
        </button>
      </div>

      {tab === 'juz' ? <JuzIndex /> : <SurahIndex />}
    </section>
  );
}

function JuzIndex() {
  const { goAyah } = useAppStore();

  return (
    <div className="index-list index-juz-list">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
        const page = findPageForJuz(juz);
        return (
          <button
            key={juz}
            type="button"
            className="index-card index-juz-card"
            onClick={() => goAyah(surahs.find((surah) => surah.juz === juz)?.number || 1, 1, page)}
          >
            <span className="index-number-badge">{juz}</span>
            <span className="index-card-title">{getIndexJuzLabel(juz)}</span>
            <ChevronDown className="index-card-icon" size={26} strokeWidth={2.4} />
          </button>
        );
      })}
    </div>
  );
}

function SurahIndex() {
  const { goAyah } = useAppStore();
  const grouped = useMemo(() => surahs.reduce((groups, surah) => {
    const key = surah.juz;
    groups[key] = groups[key] || [];
    groups[key].push(surah);
    return groups;
  }, {}), []);

  return (
    <div className="index-list index-surah-list">
      {Object.entries(grouped).map(([juz, list]) => (
        <section key={juz} className="index-surah-section">
          <h2 className="index-section-title">{getIndexJuzHeading(juz)}</h2>
          <div className="index-section-cards">
            {list.map((surah) => {
              const page = findPageForReference(surah.number, 1);
              return (
                <button
                  key={surah.number}
                  type="button"
                  className="index-card index-surah-card"
                  onClick={() => goAyah(surah.number, 1, page)}
                >
                  <span className="index-number-badge">{surah.number}</span>
                  <span className="index-surah-text">
                    <strong>{surah.name}</strong>
                    <small>Page {getMushafPageNumber(page)} . {surah.verses} verses . {surah.revelation}</small>
                  </span>
                  <ArrowRight className="index-card-icon" size={27} strokeWidth={2.2} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
