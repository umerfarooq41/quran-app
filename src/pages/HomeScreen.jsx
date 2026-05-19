import React from 'react';
import { Bookmark, BookOpen, Headphones, Search, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getPageMeta } from '../lib/quran';
import { getJuzPartByPage } from '../data/quranMeta';
import { Screen } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';

export default function HomeScreen() {
  const { page, goPage, setView } = useAppStore();
  const meta = getPageMeta(page);
  const actions = [
    ['Read', BookOpen, () => goPage(page)],
    ['Search', Search, () => setView('search')],
    ['Bookmarks', Bookmark, () => setView('bookmarks')],
    ['Audio', Headphones, () => setView('audio')],
    ['Settings', SlidersHorizontal, () => setView('settings')],
  ];
  return (
    <Screen className="space-y-5">
      <div className="pt-4">
        <p className="text-sm font-medium text-slate-500">Local-first 16-line mushaf</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-normal text-slate-950">Qur'an Reader</h1>
      </div>
      <button onClick={() => goPage(page)} className={`${panel} w-full p-6 text-left`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Continue reading</p>
            <h2 className="mt-2 text-2xl font-semibold">{meta.surah.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Page {page} · Juz {meta.juz} · {getJuzPartByPage(page)}</p>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-sky-600 text-white"><BookOpen /></div>
        </div>
      </button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {actions.map(([label, Icon, onClick]) => (
          <button key={label} onClick={onClick} className={`${panel} flex min-h-28 flex-col items-start justify-between p-4 text-left`}>
            <Icon size={24} className="text-sky-700" />
            <span className="font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

