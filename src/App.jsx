import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { getLastRead, getSettings, upsertSetting } from './lib/db';
import { useAppStore } from './store/useAppStore';
import { Shell } from './components/common/AppChrome';
import { panel } from './components/common/ui';
import HomeScreen from './pages/HomeScreen';
import ReaderScreen from './pages/ReaderScreen';
import IndexScreen from './pages/IndexScreen';
import SearchScreen from './pages/SearchScreen';
import BookmarksScreen from './pages/BookmarksScreen';
import TafsirScreen from './pages/TafsirScreen';
import AudioScreen from './pages/AudioScreen';
import SettingsScreen from './pages/SettingsScreen';

export default function App() {
  const { view, page, goPage, settings, updateSettings } = useAppStore();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    Promise.all([getLastRead(), getSettings()]).then(([lastRead, storedSettings]) => {
      if (lastRead?.page) goPage(lastRead.page);
      if (storedSettings.app) updateSettings(storedSettings.app);
      setBooted(true);
    });
  }, []);

  useEffect(() => {
    upsertSetting('app', settings);
  }, [settings]);

  if (!booted) return <Shell><div className={`${panel} p-8 text-center`}><div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-[#d4a843]/25" /><p className="font-medium text-slate-600">Preparing your reader...</p></div></Shell>;

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {view === 'home' && <HomeScreen key="home" />}
        {view === 'reader' && <ReaderScreen key="reader" />}
        {view === 'index' && <IndexScreen key="index" />}
        {view === 'surah' && <IndexScreen key="surah" />}
        {view === 'info' && <IndexScreen key="info" />}
        {view === 'search' && <SearchScreen key="search" />}
        {view === 'bookmarks' && <BookmarksScreen key="bookmarks" />}
        {view === 'tafsir' && <TafsirScreen key="tafsir" />}
        {view === 'audio' && <AudioScreen key="audio" />}
        {view === 'settings' && <SettingsScreen key="settings" />}
      </AnimatePresence>
   </Shell>
  );
}
