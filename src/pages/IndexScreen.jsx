import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Play, Search, Star, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { Header } from '../components/common/AppChrome';
import {
  findPageForReference,
  getSurahInfo,
  surahs,
} from '../lib/quran';
import { getIndoPakParaQuarterTargets } from '../data/indoPakParaQuarters';
import { getJuzLabel } from '../utils/quranLabels';
import { getJuzForReference } from '../data/quranMeta';
import { getTranslationLanguageId } from '../lib/translations';
import { getSurahNameMeta } from '../data/surahNames';

function formatJuzName(juz) {
  return getJuzLabel(juz);
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

function previewText(surahInfo) {
  const source = stripHtml(surahInfo?.shortText || surahInfo?.text || '');
  if (!source) return 'Surah information will be expanded soon.';
  return source.length > 520 ? `${source.slice(0, 520).trim()}…` : source;
}

export default function IndexScreen() {
  const { tab, setTab, goBack } = useAppStore(useShallow((state) => ({
    tab: state.indexTab || 'juz',
    setTab: state.setIndexTab,
    goBack: state.goBack,
  })));

  return (
    <main className="index-replica-shell app-page-shell bg-fluent">
      <div className="index-replica-inner">
        <div className="app-fixed-header">
          <Header title="Index" onBack={() => goBack()} backLabel="Back from index" />
        </div>

        <div className="app-scroll-content">
          <div className="index-segment" role="tablist" aria-label="Index tabs">
            <button
              id="index-tab-juz"
              className={tab === 'juz' ? 'is-active' : ''}
              onClick={() => setTab('juz')}
              type="button"
              role="tab"
              aria-selected={tab === 'juz'}
              aria-controls="index-panel-juz"
            >
              Juz
            </button>
            <button
              id="index-tab-surahs"
              className={tab === 'surahs' ? 'is-active' : ''}
              onClick={() => setTab('surahs')}
              type="button"
              role="tab"
              aria-selected={tab === 'surahs'}
              aria-controls="index-panel-surahs"
            >
              Surahs
            </button>
          </div>

          {tab === 'juz' ? <JuzIndex /> : <SurahIndex />}
        </div>
      </div>
    </main>
  );
}

function NumberBadge({ children }) {
  return <span className="index-number-badge">{children}</span>;
}

function JuzIndex() {
  const { expandedJuz, setExpandedJuz, goQuarterTarget } = useAppStore(useShallow((state) => ({
    expandedJuz: state.expandedIndexJuz,
    setExpandedJuz: state.setExpandedIndexJuz,
    goQuarterTarget: state.goQuarterTarget,
  })));

  function openJuzStart(juz) {
    const startTarget = getIndoPakParaQuarterTargets(juz).find((target) => target.id === 'start');
    goQuarterTarget(startTarget);
  }

  return (
    <section id="index-panel-juz" role="tabpanel" aria-labelledby="index-tab-juz" className="index-list index-juz-list">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
        const isOpen = expandedJuz === juz;
        const targets = getIndoPakParaQuarterTargets(juz);

        return (
          <article key={juz} className={`index-card-wrap ${isOpen ? 'is-open' : ''}`}>
            <div className="index-card index-juz-card">
              <button className="index-card-main" onClick={() => openJuzStart(juz)} type="button">
                <NumberBadge>{juz}</NumberBadge>
                <span className="index-card-title">{formatJuzName(juz)}</span>
              </button>
              <button
                className="index-expand-button"
                type="button"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${formatJuzName(juz)}`}
                onClick={() => setExpandedJuz(isOpen ? null : juz)}
              >
                <ChevronDown className="index-chevron" size={20} strokeWidth={2.35} />
              </button>
            </div>

            {isOpen && (
              <div className="index-collapse-panel index-quarter-grid">
                {targets.map((target) => (
                  <button
                    key={target.label}
                    className="index-quarter-btn"
                    onClick={() => goQuarterTarget(target)}
                    type="button"
                  >
                    <strong>{getQuarterPillLabel(target.id)}</strong>
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
  if (id === 'quarter1') return '2nd Quarter';
  if (id === 'half') return '3rd Quarter';
  if (id === 'quarter3') return '4th Quarter';
  return '1st Quarter';
}


function AyahJumpControl({ surah, ayahCount, goAyah }) {
  const [ayahInput, setAyahInput] = useState('1');
  const [committedAyah, setCommittedAyah] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setAyahInput('1');
    setCommittedAyah(1);
    setIsDragging(false);
  }, [surah.number]);

  const parsedAyah = Number.parseInt(ayahInput, 10);
  const inputIsValid = Number.isFinite(parsedAyah) && parsedAyah >= 1 && parsedAyah <= ayahCount;
  const displayAyah = inputIsValid ? parsedAyah : committedAyah;
  const pageNumber = findPageForReference(surah.number, displayAyah);
  const juzNumber = getJuzForReference(surah.number, displayAyah);
  const progress = ayahCount > 1 ? ((displayAyah - 1) / (ayahCount - 1)) * 100 : 0;
  const maxDigits = String(ayahCount).length;

  function updateTypedAyah(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, maxDigits);
    if (!digits) {
      setAyahInput('');
      return;
    }
    const normalized = String(Number.parseInt(digits, 10));
    setAyahInput(normalized === 'NaN' ? '' : normalized);
  }

  function commitAyahInput() {
    if (!inputIsValid) {
      setAyahInput(String(committedAyah));
      return committedAyah;
    }
    setCommittedAyah(parsedAyah);
    setAyahInput(String(parsedAyah));
    return parsedAyah;
  }

  function openAyah() {
    if (!inputIsValid) return;
    const ayah = commitAyahInput();
    goAyah(surah.number, ayah, findPageForReference(surah.number, ayah));
  }

  function updateFromSlider(value) {
    const nextAyah = Math.min(ayahCount, Math.max(1, Number(value)));
    setCommittedAyah(nextAyah);
    setAyahInput(String(nextAyah));
  }

  return (
    <div className="index-ayah-jump" aria-label={`Jump to an ayah in ${surah.name}`}>
      <div className="index-ayah-jump-heading">
        <span>Jump to Ayah</span>
        <small>Page {pageNumber} · {getJuzLabel(juzNumber)}</small>
      </div>

      <div className="index-ayah-jump-row">
        <label className={`index-ayah-input-wrap ${ayahInput && !inputIsValid ? 'is-invalid' : ''}`}>
          <span>Ayah</span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="go"
            autoComplete="off"
            spellCheck="false"
            pattern="[0-9]*"
            maxLength={maxDigits}
            value={ayahInput}
            placeholder={`1–${ayahCount}`}
            aria-invalid={Boolean(ayahInput && !inputIsValid)}
            aria-label={`Ayah number from 1 to ${ayahCount}`}
            onFocus={() => {
              if (ayahInput === String(committedAyah)) setAyahInput('');
            }}
            onBlur={commitAyahInput}
            onContextMenu={(event) => event.preventDefault()}
            onChange={(event) => updateTypedAyah(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && inputIsValid) openAyah();
            }}
          />
          <strong>of {ayahCount}</strong>
        </label>

        <button type="button" className="index-ayah-go" onClick={openAyah} disabled={!inputIsValid}>
          Go
        </button>
      </div>

      <div className={`index-ayah-slider-wrap ${isDragging ? 'is-dragging' : ''}`}>
        <div className="index-ayah-slider-value" aria-live="polite">Ayah {displayAyah}</div>
        <div className="index-ayah-slider-visual" style={{ '--ayah-progress': `${progress}%` }}>
          <div className="index-ayah-slider-track" aria-hidden="true">
            <span className="index-ayah-slider-progress" />
          </div>
          <input
            className="index-ayah-slider"
            type="range"
            min="1"
            max={ayahCount}
            step="1"
            value={displayAyah}
            aria-label={`Select ayah from 1 to ${ayahCount}`}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
            onBlur={() => setIsDragging(false)}
            onChange={(event) => updateFromSlider(event.target.value)}
          />
        </div>
        <div className="index-ayah-slider-labels" aria-hidden="true">
          <span>1</span>
          <span>{getJuzLabel(juzNumber)}</span>
          <span>{ayahCount}</span>
        </div>
      </div>

      {ayahInput && !inputIsValid && (
        <p className="index-ayah-limit-hint">Enter an Ayah from 1 to {ayahCount}.</p>
      )}
    </div>
  );
}

function SurahIndex() {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    expandedSurah,
    setExpandedSurah,
    goAyah,
    openSurahInfo,
    favoriteSurahs,
    toggleFavoriteSurah,
    translationId,
    storedTranslationLanguage,
  } = useAppStore(useShallow((state) => ({
    expandedSurah: state.expandedIndexSurah,
    setExpandedSurah: state.setExpandedIndexSurah,
    goAyah: state.goAyah,
    openSurahInfo: state.openSurahInfo,
    favoriteSurahs: state.favoriteSurahs,
    toggleFavoriteSurah: state.toggleFavoriteSurah,
    translationId: state.settings.translation,
    storedTranslationLanguage: state.settings.translationLanguage,
  })));

  const translationLanguage = getTranslationLanguageId(translationId)
    || storedTranslationLanguage
    || 'ur';

  const filteredSurahs = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return surahs;

    return surahs.filter((surah) => {
      const meta = getSurahNameMeta(surah.number);
      return [
        String(surah.number),
        surah.name,
        meta.arabicName,
        meta.meaning,
      ].some((value) => String(value).toLocaleLowerCase().includes(query));
    });
  }, [searchQuery]);

  const isSearching = Boolean(searchQuery.trim());
  const grouped = useMemo(() => {
    if (isSearching) return { search: filteredSurahs };
    return filteredSurahs.reduce((groups, surah) => {
      const key = surah.juz;
      groups[key] = groups[key] || [];
      groups[key].push(surah);
      return groups;
    }, {});
  }, [filteredSurahs, isSearching]);

  useEffect(() => {
    if (!expandedSurah) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-index-surah-card="${expandedSurah}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedSurah]);

  return (
    <>
      <div className="index-surah-search" role="search">
        <Search size={18} strokeWidth={2.1} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name, meaning or number"
          aria-label="Search Surahs"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear Surah search">
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      <section id="index-panel-surahs" role="tabpanel" aria-labelledby="index-tab-surahs" className="index-list index-surah-list">
      {filteredSurahs.length === 0 && (
        <div className="index-empty-state">
          <p>No Surah found.</p>
          <button type="button" onClick={() => setSearchQuery('')}>Clear search</button>
        </div>
      )}
      {Object.entries(grouped).map(([juz, list]) => (
        <div key={juz} className="index-surah-group">
          {!isSearching && <h2 className="index-section-title">{formatJuzHeading(Number(juz))}</h2>}
          <div className="index-surah-stack">
            {list.map((surah) => {
              const isOpen = expandedSurah === surah.number;
              const ayahCount = surah.verses;
              const localizedInfo = getSurahInfo(surah.number, translationLanguage);
              const nameMeta = getSurahNameMeta(surah.number);

              return (
                <article key={surah.number} data-index-surah-card={surah.number} className={`index-card-wrap ${isOpen ? 'is-open' : ''}`}>
                  <div className="index-card index-surah-card">
                    <button
                      className="index-card-main index-surah-main"
                      onClick={() => setExpandedSurah(isOpen ? null : surah.number)}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`index-surah-panel-${surah.number}`}
                    >
                      <NumberBadge>{surah.number}</NumberBadge>
                      <span className="index-surah-title-block">
                        <span className="index-card-title">{surah.name}</span>
                      </span>
                      <span className="index-surah-arabic-name" lang="ar" dir="rtl">{nameMeta.arabicName}</span>
                    </button>
                    <button
                      className="index-expand-button"
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`index-surah-panel-${surah.number}`}
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${surah.name}`}
                      onClick={() => setExpandedSurah(isOpen ? null : surah.number)}
                    >
                      <ChevronDown className="index-chevron" size={20} strokeWidth={2.35} />
                    </button>
                  </div>

                  {isOpen && (
                    <div id={`index-surah-panel-${surah.number}`} className="index-collapse-panel index-surah-collapse" aria-label={`${surah.name} details`}>
                      <div className="index-surah-info-preview">
                        <div className="index-surah-info-heading">
                          <span className="index-surah-info-label">Surah Info</span>
                          <p className="index-surah-info-meta">
                            {nameMeta.meaning} <span aria-hidden="true">•</span> {ayahCount} Ayahs <span aria-hidden="true">•</span> {surah.revelation}
                          </p>
                        </div>
                        <p
                          className={`index-surah-info-copy is-${translationLanguage}`}
                          lang={translationLanguage}
                          dir={translationLanguage === 'ur' ? 'rtl' : 'ltr'}
                        >
                          {previewText(localizedInfo)}
                        </p>
                        <button
                          type="button"
                          className="inline-read-more index-surah-read-more"
                          onClick={() => openSurahInfo(surah.number)}
                        >
                          Read Full Introduction →
                        </button>

                        <div className="index-surah-quick-actions" aria-label={`${surah.name} quick actions`}>
                          <button
                            type="button"
                            className={`index-surah-text-action ${favoriteSurahs.includes(surah.number) ? 'is-favorite' : ''}`}
                            onClick={() => toggleFavoriteSurah(surah.number)}
                            aria-pressed={favoriteSurahs.includes(surah.number)}
                          >
                            <Star size={17} fill={favoriteSurahs.includes(surah.number) ? 'currentColor' : 'none'} />
                            <span>{favoriteSurahs.includes(surah.number) ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                          </button>
                          <button
                            type="button"
                            className="index-surah-text-action"
                            onClick={() => goAyah(surah.number, 1, findPageForReference(surah.number, 1))}
                          >
                            <Play size={17} fill="currentColor" />
                            <span>Read from Start</span>
                          </button>
                        </div>
                      </div>

                      <AyahJumpControl
                        surah={surah}
                        ayahCount={ayahCount}
                        goAyah={goAyah}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
    </>
  );
}
