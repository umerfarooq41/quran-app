import React from 'react';
import { BookOpen } from 'lucide-react';
import { Header, Screen } from '../components/common/AppChrome';
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
  const surah = getSurah(selectedSurah);

  return (
    <Screen className="surah-info-screen">
      <Header title="Surah Info" back={VIEWS.INDEX} />

      <article className="surah-info-card">
        <div className="surah-info-card-glow" aria-hidden="true" />
        <header className="surah-info-hero">
          <div>
            <p className="surah-info-kicker">SURAH {surah?.number}</p>
            <h1>{surah?.name}</h1>
            <p className="surah-info-meta">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
          </div>
          <span className="surah-info-icon" aria-hidden="true"><BookOpen size={24} /></span>
        </header>

        <SurahInfoBody html={surah?.text} />
      </article>
    </Screen>
  );
}
