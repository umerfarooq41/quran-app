import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getSurah, getSurahAyahs, surahs, totalPages } from '../lib/quran';
import { Header, Screen, Segment } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';

export default function IndexScreen() {
  const { view } = useAppStore();
  const [tab, setTab] = useState('surahs');
  if (view === 'surah') return <SurahDetail />;
  if (view === 'info') return <SurahInfo />;
  return (
    <Screen className="space-y-4">
      <Header title="Index" />
      <Segment value={tab} setValue={setTab} options={[['surahs', 'Surahs'], ['juz', 'Juz']]} />
      {tab === 'surahs' ? <SurahIndex /> : <JuzIndex />}
    </Screen>
  );
}

function SurahIndex() {
  const { setSelectedSurah } = useAppStore();
  const grouped = useMemo(() => surahs.reduce((groups, surah) => {
    const key = surah.juz;
    groups[key] = groups[key] || [];
    groups[key].push(surah);
    return groups;
  }, {}), []);
  return <div className="space-y-4">{Object.entries(grouped).map(([juz, list]) => <div key={juz} className={`${panel} p-4`}><h3 className="mb-3 font-semibold">Juz {juz}</h3><div className="grid gap-2">{list.map((surah) => <button key={surah.number} onClick={() => setSelectedSurah(surah.number)} className="flex items-center justify-between rounded-2xl bg-white/65 p-3 text-left"><span><b>{surah.number}. {surah.name}</b><small className="block text-slate-500">{surah.verses} verses · {surah.revelation}</small></span><ChevronRight size={18} /></button>)}</div></div>)}</div>;
}

function JuzIndex() {
  const { goPage } = useAppStore();
  const parts = ['Start', "Ar-Ruba'", 'An-Nisf', 'Ath-Thalatha'];
  return <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => <div key={juz} className={`${panel} p-4`}><h3 className="font-semibold">Juz {juz}</h3><div className="mt-3 grid grid-cols-2 gap-2">{parts.map((part, index) => { const page = Math.max(1, Math.round(((juz - 1 + index / 4) / 30) * totalPages)); return <button key={part} onClick={() => goPage(page)} className="rounded-2xl bg-white/70 p-3 text-sm font-medium">{part}<small className="block text-slate-500">p. {page}</small></button>; })}</div></div>)}</div>;
}

function SurahDetail() {
  const { selectedSurah, goPage, setView } = useAppStore();
  const surah = getSurah(selectedSurah);
  const ayahs = getSurahAyahs(selectedSurah);
  return <Screen className="space-y-4"><Header title={surah.name} back="index" /><div className={`${panel} p-5`}><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{surah.revelation} · {surah.verses} verses</p><h2 className="text-2xl font-semibold">Surah {surah.number}</h2></div><button className="rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white" onClick={() => setView('info')}>Surah Info</button></div></div><div className={`${panel} max-h-[62dvh] overflow-auto p-3`}>{ayahs.map((ayah) => <button key={ayah.key} onClick={() => goPage(findPageForReference(ayah.surahNumber, ayah.ayahNumber))} className="mb-2 w-full rounded-2xl bg-white/70 p-3 text-left"><span className="font-semibold">{ayah.surahNumber}:{ayah.ayahNumber}</span><span dir="rtl" className="block font-quran text-2xl leading-loose">{ayah.text}</span></button>)}</div></Screen>;
}

function SurahInfo() {
  const { selectedSurah } = useAppStore();
  const surah = getSurah(selectedSurah);
  return <Screen className="space-y-4"><Header title={`${surah.name} Info`} back="surah" /><article className={`${panel} prose max-w-none p-5 prose-headings:text-slate-900 prose-p:text-slate-700`} dangerouslySetInnerHTML={{ __html: surah.text }} /></Screen>;
}
