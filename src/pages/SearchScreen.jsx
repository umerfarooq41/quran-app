import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { db } from '../lib/db';
import { searchQuran } from '../lib/quran';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';

export default function SearchScreen() {
  const { goAyah, goPage } = useAppStore();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchQuran(query), [query]);
  useEffect(() => { if (query.trim().length > 1) db.recentSearches.add({ query, createdAt: Date.now() }); }, [query]);

  function openResult(result) {
    if (result.surahNumber && result.ayahNumber) goAyah(result.surahNumber, result.ayahNumber, result.page);
    else goPage(result.page);
  }

  return (
    <Screen className="space-y-4">
      <Header title="Search" />
      <div className={`${panel} flex items-center gap-3 p-3`}>
        <Search className="text-slate-500" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Page 12, 2:255, juz 30, Al-Fatihah, Arabic text"
          className="w-full bg-transparent p-2 outline-none"
        />
      </div>
      <div className="grid gap-2">
        {results.map((result, index) => (
          <button key={`${result.title}-${index}`} onClick={() => openResult(result)} className={`${panel} p-4 text-left`}>
            <b>{result.title}</b>
            <span className="line-clamp-2 block text-sm text-slate-500">{result.subtitle}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
