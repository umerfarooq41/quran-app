import React, { useMemo, useState } from 'react';
import { ChevronDown, Info, X } from 'lucide-react';
import { VIEWS } from '../app/routes';
import { useAppStore } from '../store/useAppStore';
import {
  findPageForReference,
  getJuzQuarterTargets,
  getMushafPageNumber,
  getSurahAyahs,
  surahs,
} from '../lib/quran';
import { getJuzLabel } from '../utils/quranLabels';

function formatJuzName(juz) {
  return `${getJuzLabel(juz)}'`;
}

function formatJuzHeading(juz) {
  return formatJuzName(juz).toUpperCase();
}

export default function IndexScreen() {
  const [tab, setTab] = useState('juz');
  const setView = useAppStore((state) => state.setView);

  return (
    <main className="index-replica-shell">
      <div className="index-replica-inner">
        <header className="index-replica-header">
          <h1>Index</h1>
          <button className="index-close-pill" onClick={() => setView(VIEWS.READER, 'back')} aria-label="Close index" type="button">
            <X size={22} strokeWidth={2.35} />
          </button>
        </header>

        <div className="index-segment" role="tablist" aria-label="Index tabs">
          <button
            className={tab === 'juz' ? 'is-active' : ''}
            onClick={() => setTab('juz')}
            type="button"
          >
            Juz's
          </button>
          <button
            className={tab === 'surahs' ? 'is-active' : ''}
            onClick={() => setTab('surahs')}
            type="button"
          >
            Surahs
          </button>
        </div>

        {tab === 'juz' ? <JuzIndex /> : <SurahIndex />}
      </div>
    </main>
  );
}

function NumberBadge({ children }) {
  return <span className="index-number-badge">{children}</span>;
}

function JuzIndex() {
  const [expandedJuz, setExpandedJuz] = useState(null);
  const { goAyah } = useAppStore();

  return (
    <section className="index-list index-juz-list">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
        const isOpen = expandedJuz === juz;
        const targets = getJuzQuarterTargets(juz);

        return (
          <article key={juz} className={`index-card-wrap ${isOpen ? 'is-open' : ''}`}>
            <button className="index-card index-juz-card" onClick={() => setExpandedJuz(isOpen ? null : juz)} type="button">
              <NumberBadge>{juz}</NumberBadge>
              <span className="index-card-title">{formatJuzName(juz)}</span>
              <ChevronDown className="index-chevron" size={19} strokeWidth={2.3} />
            </button>

            {isOpen && (
              <div className="index-collapse-panel index-quarter-grid">
                {targets.map((target) => (
                  <button
                    key={target.label}
                    className="index-quarter-btn"
                    onClick={() => goAyah(target.surahNumber, target.ayahNumber, target.page)}
                    type="button"
                  >
                    <strong>{target.label}</strong>
                    <span>{target.surahNumber}:{target.ayahNumber} · Page {getMushafPageNumber(target.page)}</span>
                  </button>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function SurahIndex() {
  const [expandedSurah, setExpandedSurah] = useState(null);
  const { goAyah, openSurahInfo } = useAppStore();

  const grouped = useMemo(() => surahs.reduce((groups, surah) => {
    const key = surah.juz;
    groups[key] = groups[key] || [];
    groups[key].push(surah);
    return groups;
  }, {}), []);

  return (
    <section className="index-list index-surah-list">
      {Object.entries(grouped).map(([juz, list]) => (
        <div key={juz} className="index-surah-group">
          <h2 className="index-section-title">{formatJuzHeading(Number(juz))}</h2>
          <div className="index-surah-stack">
            {list.map((surah) => {
              const page = findPageForReference(surah.number, 1);
              const isOpen = expandedSurah === surah.number;
              const ayahs = isOpen ? getSurahAyahs(surah.number) : [];

              return (
                <article key={surah.number} className={`index-card-wrap ${isOpen ? 'is-open' : ''}`}>
                  <button
                    className="index-card index-surah-card"
                    onClick={() => setExpandedSurah(isOpen ? null : surah.number)}
                    type="button"
                    aria-expanded={isOpen}
                  >
                    <NumberBadge>{surah.number}</NumberBadge>
                    <span className="index-surah-text">
                      <strong>{surah.name}</strong>
                      <small>Page {getMushafPageNumber(page)} . {surah.verses} verses . {surah.revelation}</small>
                    </span>
                    <ChevronDown className="index-chevron" size={19} strokeWidth={2.3} />
                  </button>

                  {isOpen && (
                    <div className="index-collapse-panel index-surah-collapse" aria-label={`${surah.name} ayahs`}>
                      <div className="index-surah-info-card">
                        <div>
                          <span>Surah info</span>
                          <p>{surah.shortText || `${surah.name} has ${surah.verses} ayahs and begins in ${formatJuzName(surah.juz)}.`}</p>
                        </div>
                        <button type="button" onClick={() => openSurahInfo(surah.number)}>
                          <Info size={15} strokeWidth={2.2} />
                          Read
                        </button>
                      </div>

                      <div className="index-ayah-grid">
                        {ayahs.map((ayah) => (
                          <button
                            key={ayah.ayahNumber}
                            onClick={() => goAyah(surah.number, ayah.ayahNumber, findPageForReference(surah.number, ayah.ayahNumber))}
                            type="button"
                            aria-label={`Open ayah ${ayah.ayahNumber}`}
                          >
                            {ayah.ayahNumber}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
