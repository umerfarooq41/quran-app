import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { findPageForReference, getSurah } from '../lib/quran';
import { getTranslation, getTranslationOption } from '../lib/translations';
import { parseQuranInternalHref, sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { useAppStore } from '../store/useAppStore';
import { BackButton, Empty, Header, Screen } from '../components/common/AppChrome';

export default function TafsirScreen() {
  const { tafsirTarget, goBack, goAyah, openSurahInfo, settings } = useAppStore(useShallow((state) => ({
    tafsirTarget: state.tafsirTarget,
    goBack: state.goBack,
    goAyah: state.goAyah,
    openSurahInfo: state.openSurahInfo,
    settings: state.settings,
  })));
  const [translation, setTranslation] = useState('');
  const [status, setStatus] = useState('Loading translation...');
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
      setTranslation('');
      setStatus('No ayah selected.');
      return () => { mounted = false; };
    }
    getTranslation(settings.translation, tafsirTarget.surahNumber, tafsirTarget.ayahNumber)
      .then((text) => {
        if (!mounted) return;
        setTranslation(text || 'Translation is not available for this ayah.');
        setStatus('');
      })
      .catch(() => {
        if (!mounted) return;
        setTranslation('Translation is not available for this ayah.');
        setStatus('');
      });
    return () => { mounted = false; };
  }, [tafsirTarget?.surahNumber, tafsirTarget?.ayahNumber, settings.translation]);

  if (!tafsirTarget) {
    return <Screen className="space-y-4"><Header title="Translation" back="reader" /><Empty text="Select an ayah before opening the full Translation mode." /></Screen>;
  }

  return (
    <Screen className="tafsir-screen space-y-4">
      <div className="tabs-header compact">
        <BackButton className="tabs-back-pill" onClick={() => goBack('reader')} />
        <h1>Translation</h1>
      </div>
      <article className="tafsir-card">
        <div className="tafsir-card-head">
          <div>
            <p>{surah?.name}</p>
            <h2>{tafsirTarget.reference || `${tafsirTarget.surahNumber}:${tafsirTarget.ayahNumber}`}</h2>
          </div>
          <button onClick={() => goAyah(tafsirTarget.surahNumber, tafsirTarget.ayahNumber, tafsirTarget.page)}><BookOpen size={18} /> Open</button>
        </div>
        <p dir="rtl" className="tafsir-arabic">{tafsirTarget.arabic}</p>
        <section className="tafsir-section">
          <h3>{translationOption.label}</h3>
          {status ? <p>{status}</p> : <p dir={translationOption.direction}>{translation}</p>}
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
    </Screen>
  );
}
