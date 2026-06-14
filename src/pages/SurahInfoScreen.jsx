import React from 'react';
import { Screen, Header } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';
import { useAppStore } from '../store/useAppStore';
import { getSurah } from '../lib/quran';
import { VIEWS } from '../app/routes';

export default function SurahInfoScreen() {
  const selectedSurah = useAppStore((state) => state.selectedSurah);
  const surah = getSurah(selectedSurah);

  return (
    <Screen className="space-y-5">
      <Header title="Surah Info" back={VIEWS.SURAH} />
      <section className={`${panel} p-6`}>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Surah {surah?.number}</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">{surah?.name}</h2>
        <p className="mt-2 text-slate-500">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
        <div className="mt-6 space-y-4 leading-8 text-slate-650">
          <p>{surah?.text || surah?.shortText || 'Surah information will be expanded in the next design pass.'}</p>
        </div>
      </section>
    </Screen>
  );
}
