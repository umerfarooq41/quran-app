import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { getLastRead, getSettings, upsertSetting } from './lib/db';
import { useAppStore } from './store/useAppStore';
import { Shell } from './components/common/AppChrome';
import { panel } from './components/common/ui';
import { VIEWS, normalizeView } from './app/routes';
import HomeScreen from './pages/HomeScreen';
import ReaderScreen from './pages/ReaderScreen';
import IndexScreen from './pages/IndexScreen';
import SearchScreen from './pages/SearchScreen';
import BookmarksScreen from './pages/BookmarksScreen';
import TafsirScreen from './pages/TafsirScreen';
import AudioScreen from './pages/AudioScreen';
import SettingsScreen from './pages/SettingsScreen';
import SurahScreen from './pages/SurahScreen';
import SurahInfoScreen from './pages/SurahInfoScreen';

export default function App() {
  const { view, goPage, settings, updateSettings } = useAppStore();
  const activeView = normalizeView(view);
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
        {activeView === VIEWS.HOME && <HomeScreen key="home" />}
        {activeView === VIEWS.READER && <ReaderScreen key="reader" />}
        {activeView === VIEWS.INDEX && <IndexScreen key="index" />}
        {activeView === VIEWS.SURAH && <SurahScreen key="surah" />}
        {activeView === VIEWS.SURAH_INFO && <SurahInfoScreen key="surahInfo" />}
        {activeView === VIEWS.SEARCH && <SearchScreen key="search" />}
        {activeView === VIEWS.TABS && <BookmarksScreen key="tabs" />}
        {activeView === VIEWS.TAFSIR && <TafsirScreen key="tafsir" />}
        {activeView === VIEWS.AUDIO && <AudioScreen key="audio" />}
        {activeView === VIEWS.SETTINGS && <SettingsScreen key="settings" />}
      </AnimatePresence>
   </Shell>
  );
}
