import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Screen } from '../components/common/AppChrome';
import { useAppStore } from '../store/useAppStore';
import { getSurah } from '../lib/quran';
import { VIEWS } from '../app/routes';

function SurahInfoBody({ html }) {
  if (!html) {
    return <p>Surah information will be expanded in the next design pass.</p>;
  }

  return <div className="surah-info-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function SurahInfoScreen() {
  const selectedSurah = useAppStore((state) => state.selectedSurah);
  const setView = useAppStore((state) => state.setView);
  const surah = getSurah(selectedSurah);

  return (
    <Screen className="surah-info-screen">
      <header className="surah-info-topbar">
        <button type="button" onClick={() => setView(VIEWS.INDEX, 'back')} aria-label="Back to index">
          <ArrowLeft size={25} strokeWidth={2.4} />
        </button>
        <h1>Surah Info</h1>
      </header>

      <article className="surah-info-content">
        <header className="surah-info-hero">
          <div>
            <p className="surah-info-kicker">SURAH {surah?.number}</p>
            <h2>{surah?.name}</h2>
            <p className="surah-info-meta">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
          </div>
          <span className="surah-info-icon" aria-hidden="true"><BookOpen size={22} /></span>
        </header>

        <SurahInfoBody html={surah?.text} />
      </article>
    </Screen>
  );
}
