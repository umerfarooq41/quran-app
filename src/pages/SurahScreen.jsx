import React from 'react';
import { BookOpen, Info } from 'lucide-react';
import { Screen, Header } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getSurah, getSurahAyahs } from '../lib/quran';
import { VIEWS } from '../app/routes';

export default function SurahScreen() {
  const { selectedSurah, goPage, openSurahInfo } = useAppStore();
  const surah = getSurah(selectedSurah);
  const ayahs = getSurahAyahs(selectedSurah);
  const firstPage = findPageForReference(selectedSurah, 1);

  return (
    <Screen className="space-y-5">
      <Header title={surah?.name || 'Surah'} back={VIEWS.INDEX} />

      <section className={`${panel} overflow-hidden p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Surah {surah?.number}</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">{surah?.name}</h2>
            <p className="mt-2 text-slate-500">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[#2d6e5e]/10 text-[#2d6e5e]">
            <BookOpen size={24} />
          </div>
        </div>

        {surah?.shortText && <p className="mt-5 leading-7 text-slate-600">{surah.shortText}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="rounded-2xl bg-[#2d6e5e] px-4 py-3 font-semibold text-white" onClick={() => goPage(firstPage, { surahNumber: selectedSurah, ayahNumber: 1 })}>
            Open Surah
          </button>
          <button className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700" onClick={() => openSurahInfo(selectedSurah)}>
            <span className="inline-flex items-center gap-2"><Info size={18} /> Surah Info</span>
          </button>
        </div>
      </section>

      <section className={`${panel} p-4`}>
        <h3 className="px-2 pb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Ayahs</h3>
        <div className="grid gap-2">
          {ayahs.slice(0, 12).map((ayah) => (
            <button
              key={`${ayah.surahNumber}:${ayah.ayahNumber}`}
              className="rounded-2xl bg-white/70 p-4 text-left transition active:scale-[0.99]"
              onClick={() => goPage(findPageForReference(ayah.surahNumber, ayah.ayahNumber), { surahNumber: ayah.surahNumber, ayahNumber: ayah.ayahNumber })}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700">Ayah {ayah.ayahNumber}</span>
                <span className="text-xs text-slate-400">Open</span>
              </div>
              <p className="mt-2 line-clamp-2 text-right font-arabic text-2xl leading-loose text-slate-900">{ayah.text}</p>
            </button>
          ))}
        </div>
      </section>
    </Screen>
  );
}
