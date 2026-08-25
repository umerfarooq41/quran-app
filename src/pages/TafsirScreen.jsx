import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { findPageForReference, getSurah } from '../lib/quran';
import { getTranslationOption, loadTranslationEntry } from '../lib/translations';
import { parseQuranInternalHref, sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { useAppStore } from '../store/useAppStore';
import { Empty, Header, Screen } from '../components/common/AppChrome';

export default function TafsirScreen() {
  const { tafsirTarget, goBack, goAyah, openSurahInfo, settings } = useAppStore(useShallow((state) => ({
    tafsirTarget: state.tafsirTarget,
    goBack: state.goBack,
    goAyah: state.goAyah,
    openSurahInfo: state.openSurahInfo,
    settings: state.settings,
  })));
  const [translation, setTranslation] = useState({ plainText: '', footnotes: [] });
  const [status, setStatus] = useState('Loading translation...');
  const [footnotesOpen, setFootnotesOpen] = useState(false);
  const surah = getSurah(tafsirTarget?.surahNumber);
  const surahInfo = surah?.shortText || surah?.text || '';
  const cleanSurahInfo = useMemo(() => sanitizeSurahHtml(surahInfo), [surahInfo]);
  const translationOption = getTranslationOption(settings.translation);

  function handleContextClick(event) {
    const link = event.target.closest('a[data-quran-link]');
    if (!link) return;

    const reference = parseQuranInternalHref(link.getAttribute('href'));
    if (!reference) return;

    event.preventDefault();
    goAyah(
      reference.surahNumber,
      reference.ayahNumber,
      findPageForReference(reference.surahNumber, reference.ayahNumber),
    );
  }

  useEffect(() => {
    let mounted = true;
    if (!tafsirTarget?.surahNumber || !tafsirTarget?.ayahNumber) {
      setTranslation({ plainText: '', footnotes: [] });
      setFootnotesOpen(false);
      setStatus('No ayah selected.');
      return () => { mounted = false; };
    }
    setFootnotesOpen(false);
    loadTranslationEntry(settings.translation, tafsirTarget.surahNumber, tafsirTarget.ayahNumber)
      .then((entry) => {
        if (!mounted) return;
        setTranslation(entry?.plainText ? entry : { plainText: 'Translation is not available for this ayah.', footnotes: [] });
        setStatus('');
      })
      .catch(() => {
        if (!mounted) return;
        setTranslation({ plainText: 'Translation is not available for this ayah.', footnotes: [] });
        setStatus('');
      });
    return () => { mounted = false; };
  }, [tafsirTarget?.surahNumber, tafsirTarget?.ayahNumber, settings.translation]);

  if (!tafsirTarget) {
    return (
      <Screen className="tafsir-screen app-page-shell bg-fluent">
        <div className="app-fixed-header">
          <Header title="Translation" back="reader" />
        </div>
        <div className="app-scroll-content">
          <Empty text="Select an ayah before opening the full Translation mode." />
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="tafsir-screen app-page-shell bg-fluent">
      <div className="app-fixed-header">
        <Header title="Translation" onBack={() => goBack('reader')} backLabel="Back to reader" />
      </div>
      <div className="app-scroll-content">
      <article className="tafsir-card">
        <div className="tafsir-card-head">
          <div>
            <p>{surah?.name}</p>
            <h2>{tafsirTarget.reference || `${tafsirTarget.surahNumber}:${tafsirTarget.ayahNumber}`}</h2>
          </div>
          <button onClick={() => goAyah(tafsirTarget.surahNumber, tafsirTarget.ayahNumber, tafsirTarget.page)}><BookOpen size={18} /> Open</button>
        </div>
        <p dir="rtl" className="tafsir-arabic">{tafsirTarget.arabic}</p>
        <section className="tafsir-section" data-translation-language={translationOption.language || 'En'}>
          <h3>{translationOption.label}</h3>
          {status ? <p>{status}</p> : (
            <>
              <p className="tafsir-translation-text" dir={translationOption.direction}>{translation.plainText}</p>
              {(translation.provider === 'quran-foundation' || translation.tafsirProvider === 'quran-foundation') && (
                <p className="qf-attribution">{translationOption.shortName || translationOption.label} · Quran data provided by Quran Foundation.</p>
              )}
              {translation.footnotes?.length > 0 && (
                <div className="tafsir-footnote-wrap" dir={translationOption.direction}>
                  <button
                    type="button"
                    className="tafsir-footnote-toggle"
                    aria-expanded={footnotesOpen}
                    onClick={() => setFootnotesOpen((open) => !open)}
                  >
                    <span>{footnotesOpen ? 'Hide footnotes' : `Show footnotes (${translation.footnotes.length})`}</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>

                  {footnotesOpen && (
                    <div className="tafsir-footnotes">
                      {translation.footnotes.map((footnote) => (
                        <p key={footnote.id}>
                          <span>{footnote.number}</span>
                          {footnote.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        {cleanSurahInfo && (
          <section className="tafsir-section">
            <h3>Surah Context</h3>
            <div className="tafsir-surah-context">
              <div
                className="tafsir-surah-preview"
                onClick={handleContextClick}
                dangerouslySetInnerHTML={{ __html: cleanSurahInfo }}
              />
              <button
                type="button"
                className="inline-read-more"
                onClick={() => openSurahInfo(tafsirTarget.surahNumber)}
              >
                Read more
              </button>
            </div>
          </section>
        )}
      </article>
      </div>
    </Screen>
  );
}
