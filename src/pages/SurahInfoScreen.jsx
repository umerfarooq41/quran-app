import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getSurah } from '../lib/quran';
import { VIEWS } from '../app/routes';

export default function SurahInfoScreen() {
  const selectedSurah = useAppStore((state) => state.selectedSurah);
  const setView = useAppStore((state) => state.setView);
  const surah = getSurah(selectedSurah);

  return (
    <main className="surah-info-screen">
      <header className="surah-info-topbar">
        <button type="button" onClick={() => setView(VIEWS.INDEX, 'back')} aria-label="Back to index">
          <ArrowLeft size={25} strokeWidth={2.35} />
        </button>
        <h1>Surah Info</h1>
      </header>

      <section className="surah-info-content">
        <div className="surah-info-title-row">
          <div>
            <p className="surah-info-kicker">Surah {surah?.number}</p>
            <h2>{surah?.name}</h2>
            <p className="surah-info-meta">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
          </div>
          <span className="surah-info-icon" aria-hidden="true"><BookOpen size={24} /></span>
        </div>

        {surah?.text ? (
          <div className="surah-info-html" dangerouslySetInnerHTML={{ __html: surah.text }} />
        ) : (
          <p className="surah-info-empty">Surah information will be expanded in the next design pass.</p>
        )}
      </section>
    </main>
  );
}
