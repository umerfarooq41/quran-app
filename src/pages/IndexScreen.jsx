import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { BackButton } from '../components/common/AppChrome';
import {
  findPageForReference,
  getSurahAyahs,
  surahs,
} from '../lib/quran';
import { getIndoPakParaQuarterTargets } from '../data/indoPakParaQuarters';
import { getJuzLabel } from '../utils/quranLabels';

function formatJuzName(juz) {
  return `${getJuzLabel(juz)}'`;
}

function formatJuzHeading(juz) {
  return formatJuzName(juz).toUpperCase();
}

function stripHtml(value = '') {
  return String(value)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<h\d[^>]*>/gi, ' ')
    .replace(/<\/h\d>/gi, '. ')
    .replace(/<p[^>]*>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function previewText(surah) {
  const source = stripHtml(surah?.shortText || surah?.text || '');
  if (!source) return 'Surah information will be expanded soon.';
  return source.length > 210 ? `${source.slice(0, 210).trim()}…` : source;
}

export default function IndexScreen() {
  const [tab, setTab] = useState('juz');
  const goBack = useAppStore((state) => state.goBack);

  return (
    <main className="index-replica-shell">
      <div className="index-replica-inner">
        <header className="index-replica-header">
          <BackButton onClick={() => goBack()} label="Back from index" />
          <h1>Index</h1>
          <span className="index-header-spacer" aria-hidden="true" />
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
  const goAyah = useAppStore((state) => state.goAyah);

  return (
    <section className="index-list index-juz-list">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
        const isOpen = expandedJuz === juz;
        const targets = getIndoPakParaQuarterTargets(juz);

        return (
          <article key={juz} className={`index-card-wrap ${isOpen ? 'is-open' : ''}`}>
            <button className="index-card index-juz-card" onClick={() => setExpandedJuz(isOpen ? null : juz)} type="button">
              <NumberBadge>{juz}</NumberBadge>
              <span className="index-card-title">{formatJuzName(juz)}</span>
              <ChevronDown className="index-chevron" size={20} strokeWidth={2.35} />
            </button>

            {isOpen && (
              <div className="index-collapse-panel index-quarter-grid">
                {targets.map((target) => (
                  <button
                    key={target.label}
                    className="index-quarter-btn"
                    onClick={() => goAyah(target.surah, target.ayah, target.page)}
                    type="button"
                  >
                    <strong>{getQuarterPillLabel(target.id)}</strong>
                    <span>{target.surah}:{target.ayah} · {target.page}</span>
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

function getQuarterPillLabel(id) {
  if (id === 'quarter1') return "◔ Ar-Ruba' (¼)";
  if (id === 'half') return '◑ An-Nisf (½)';
  if (id === 'quarter3') return '◕ Ath-Thalatha (¾)';
  return '○ Start (0/4)';
}

function SurahIndex() {
  const [expandedSurah, setExpandedSurah] = useState(null);
  const { goAyah, openSurahInfo } = useAppStore(useShallow((state) => ({
    goAyah: state.goAyah,
    openSurahInfo: state.openSurahInfo,
  })));

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
                    <span className="index-card-title">{surah.name}</span>
                    <ChevronDown className="index-chevron" size={20} strokeWidth={2.35} />
                  </button>

                  {isOpen && (
                    <div className="index-collapse-panel index-surah-collapse" aria-label={`${surah.name} details`}>
                      <div className="index-surah-info-preview">
                        <p>
                          <span className="index-surah-info-label">Surah Info</span>
                          {previewText(surah)}{' '}
                          <button
                            type="button"
                            className="inline-read-more"
                            onClick={() => openSurahInfo(surah.number)}
                          >
                            Read more
                          </button>
                        </p>
                      </div>

                      <div className="index-ayah-grid" aria-label={`${surah.name} ayahs`}>
                        {ayahs.map((ayah) => (
                          <button
                            key={ayah.ayahNumber}
                            onClick={() => goAyah(surah.number, ayah.ayahNumber, findPageForReference(surah.number, ayah.ayahNumber))}
                            type="button"
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
