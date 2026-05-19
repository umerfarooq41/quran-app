import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { getSurah } from '../lib/quran';
import { getUrduTranslation } from '../lib/translations';
import { useAppStore } from '../store/useAppStore';
import { Empty, Header, Screen } from '../components/common/AppChrome';

export default function TafsirScreen() {
  const { tafsirTarget, setView, goAyah } = useAppStore();
  const [translation, setTranslation] = useState('');
  const [status, setStatus] = useState('Loading translation...');

  useEffect(() => {
    let mounted = true;
    if (!tafsirTarget?.surahNumber || !tafsirTarget?.ayahNumber) {
      setTranslation('');
      setStatus('No ayah selected.');
      return () => { mounted = false; };
    }
    getUrduTranslation(tafsirTarget.surahNumber, tafsirTarget.ayahNumber)
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
  }, [tafsirTarget?.surahNumber, tafsirTarget?.ayahNumber]);

  if (!tafsirTarget) {
    return <Screen className="space-y-4"><Header title="Translation" back="reader" /><Empty text="Long-press an ayah and tap Read more to open its translation here." /></Screen>;
  }

  const surah = getSurah(tafsirTarget.surahNumber);
  const surahInfo = surah?.shortText || surah?.text || '';

  return (
    <Screen className="tafsir-screen space-y-4">
      <div className="tabs-header compact">
        <button className="tabs-back-pill" onClick={() => setView('reader')}><ArrowLeft size={24} /></button>
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
          <h3>Urdu Translation</h3>
          {status ? <p>{status}</p> : <p dir="rtl">{translation}</p>}
        </section>
        {surahInfo && (
          <section className="tafsir-section">
            <h3>Surah Context</h3>
            <div dangerouslySetInnerHTML={{ __html: surahInfo }} />
          </section>
        )}
      </article>
    </Screen>
  );
}
