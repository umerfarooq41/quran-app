import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  findPageForReference,
  getJuzQuarterTargets,
  getMushafPageNumber,
  surahs,
} from '../lib/quran';
import { Header, Screen, Segment } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';

export default function IndexScreen() {
  const [tab, setTab] = useState('surahs');
  return (
    <Screen className="space-y-4">
      <Header title="Index" />
      <Segment value={tab} setValue={setTab} options={[["surahs", 'Surahs'], ['juz', 'Juz']]} />
      {tab === 'surahs' ? <SurahIndex /> : <JuzIndex />}
    </Screen>
  );
}

function SurahIndex() {
  const { setSelectedSurah, goAyah } = useAppStore();
  const grouped = useMemo(() => surahs.reduce((groups, surah) => {
    const key = surah.juz;
    groups[key] = groups[key] || [];
    groups[key].push(surah);
    return groups;
  }, {}), []);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([juz, list]) => (
        <div key={juz} className={`${panel} p-4`}>
          <h3 className="mb-3 font-semibold text-[#2d2b28]">Juz {juz}</h3>
          <div className="grid gap-2">
            {list.map((surah) => {
              const page = findPageForReference(surah.number, 1);
              return (
                <div key={surah.number} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-white/65 p-2">
                  <button onClick={() => goAyah(surah.number, 1, page)} className="min-w-0 rounded-xl px-2 py-2 text-left">
                    <b>{surah.number}. {surah.name}</b>
                    <small className="block text-slate-500">{surah.verses} verses · {surah.revelation} · p. {getMushafPageNumber(page)}</small>
                  </button>
                  <button onClick={() => setSelectedSurah(surah.number)} className="grid h-12 w-12 place-items-center rounded-xl bg-[#f6ead3] text-[#8f6423]" aria-label={`${surah.name} details`}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function JuzIndex() {
  const { goAyah } = useAppStore();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
        <div key={juz} className={`${panel} p-4`}>
          <h3 className="font-semibold text-[#2d2b28]">Juz {juz}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {getJuzQuarterTargets(juz).map((target) => (
              <button
                key={target.label}
                onClick={() => goAyah(target.surahNumber, target.ayahNumber, target.page)}
                className="rounded-2xl bg-white/70 p-3 text-sm font-medium text-left transition active:scale-[0.98]"
              >
                {target.label}
                <small className="block text-slate-500">{target.surahNumber}:{target.ayahNumber} · p. {getMushafPageNumber(target.page)}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
