import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { getLastRead, getSettings, upsertSetting } from './lib/db';
import { sanitizeSettings, useAppStore } from './store/useAppStore';
import { Shell } from './components/common/AppChrome';
import { panel } from './components/common/ui';
import { VIEWS, normalizeView } from './app/routes';
import HomeScreen from './pages/HomeScreen';
import ReaderScreen from './pages/ReaderScreen';
import IndexScreen from './pages/IndexScreen';
import SearchScreen from './pages/SearchScreen';
import BookmarksScreen from './pages/BookmarksScreen';
import TafsirScreen from './pages/TafsirScreen';
import SettingsScreen from './pages/SettingsScreen';
import SurahScreen from './pages/SurahScreen';
import SurahInfoScreen from './pages/SurahInfoScreen';
import { ReaderAudioPanel } from './features/reader/components/ReaderAudioPanel';

export default function App() {
  const {
    view,
    hydrateLastRead,
    settings,
    updateSettings,
    goBack,
    audioPlayerActive,
  } = useAppStore(useShallow((state) => ({
    view: state.view,
    hydrateLastRead: state.hydrateLastRead,
    settings: state.settings,
    updateSettings: state.updateSettings,
    goBack: state.goBack,
    audioPlayerActive: state.audioPlayerActive,
  })));
  const activeView = normalizeView(view);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([getLastRead(), getSettings()])
      .then(([lastRead, storedSettings]) => {
        if (!mounted) return;
        if (lastRead?.page) hydrateLastRead(lastRead);
        if (storedSettings.app) updateSettings(sanitizeSettings(storedSettings.app));
      })
      .catch(() => {
        // Start with safe defaults if local persistence is unavailable.
      })
      .finally(() => {
        if (mounted) setBooted(true);
      });

    return () => {
      mounted = false;
    };
  }, [hydrateLastRead, updateSettings]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') goBack();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack]);

  useEffect(() => {
    const theme = settings.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.haptics = settings.haptics ? 'on' : 'off';
    document.documentElement.style.colorScheme = theme;
    document.getElementById('app-theme-color')?.setAttribute(
      'content',
      theme === 'dark' ? '#111412' : '#2d6e5e',
    );
    try {
      window.localStorage.setItem('quran-app-theme', theme);
    } catch {
      // IndexedDB remains the persistence fallback when localStorage is unavailable.
    }

    if (booted) upsertSetting('app', sanitizeSettings(settings));
  }, [settings, booted]);

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
        {activeView === VIEWS.SETTINGS && <SettingsScreen key="settings" />}
      </AnimatePresence>
      {audioPlayerActive && <ReaderAudioPanel />}
   </Shell>
  );
}
