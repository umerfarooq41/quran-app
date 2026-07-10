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

function syncOrientationState(activeView) {
  const root = document.documentElement;
  const landscapeQuery = window.matchMedia?.('(orientation: landscape)');
  const isLandscape = Boolean(landscapeQuery?.matches || window.innerWidth > window.innerHeight);
  const angleValue = typeof window.orientation === 'number'
    ? window.orientation
    : window.screen?.orientation?.angle;
  const angle = Number(angleValue) || 0;

  root.dataset.activeView = activeView;
  root.dataset.appOrientation = isLandscape ? 'landscape' : 'portrait';
  root.dataset.appLandscapeLock = isLandscape
    ? (angle === -90 || angle === 270 ? 'counterclockwise' : 'clockwise')
    : 'none';
}

function isStandaloneDisplayMode() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true
      || document.fullscreenElement,
  );
}

function requestOrientationMode(orientation, type) {
  if (!orientation?.lock) return;

  Promise.resolve(orientation.lock(type)).catch(() => {
    // Ordinary browser tabs and iOS may reject orientation requests. The
    // Reader still follows the device through its native viewport orientation.
  });
}

function allowNativeReaderOrientation() {
  const orientation = window.screen?.orientation;

  try {
    // Remove the portrait policy used outside Reader. With manifest
    // orientation="any", Android can then use normal sensor rotation and may
    // show its own rotate-suggestion button when system Auto-rotate is off.
    orientation?.unlock?.();
  } catch {
    // Screen Orientation is optional and browser-dependent.
  }

  // In an installed PWA/fullscreen context, "any" explicitly allows both
  // portrait and landscape without forcing either direction. This also helps
  // override a stale portrait API lock while preserving native OS behavior.
  if (isStandaloneDisplayMode()) {
    requestOrientationMode(orientation, 'any');
  }
}

function applyOrientationPolicy(activeView) {
  syncOrientationState(activeView);

  if (document.visibilityState === 'hidden') return;

  if (activeView === VIEWS.READER) {
    allowNativeReaderOrientation();
    return;
  }

  // Keep the rest of the installed app portrait-first. Avoid issuing this in
  // a normal browser tab, where it is normally rejected and can interfere
  // with the browser/OS native rotation experience.
  if (isStandaloneDisplayMode()) {
    requestOrientationMode(window.screen?.orientation, 'portrait');
  }
}

export default function App() {
  const {
    view,
    hydrateLastRead,
    settings,
    updateSettings,
    goBack,
  } = useAppStore(useShallow((state) => ({
    view: state.view,
    hydrateLastRead: state.hydrateLastRead,
    settings: state.settings,
    updateSettings: state.updateSettings,
    goBack: state.goBack,
  })));
  const activeView = normalizeView(view);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let orientationFrame = 0;
    let orientationSettleTimer = 0;

    const applyCurrentPolicy = () => applyOrientationPolicy(activeView);
    const handleOrientationChange = () => applyCurrentPolicy();
    const handleResize = () => syncOrientationState(activeView);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') applyCurrentPolicy();
    };

    applyCurrentPolicy();

    // Some installed browsers finish changing display mode after the React
    // view transition. Releasing the previous portrait policy again avoids a
    // stale lock without forcing landscape.
    if (activeView === VIEWS.READER) {
      orientationFrame = window.requestAnimationFrame(applyCurrentPolicy);
      orientationSettleTimer = window.setTimeout(applyCurrentPolicy, 180);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.screen?.orientation?.addEventListener?.('change', handleOrientationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(orientationFrame);
      window.clearTimeout(orientationSettleTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.screen?.orientation?.removeEventListener?.('change', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeView]);

  useEffect(() => () => {
    delete document.documentElement.dataset.activeView;
    delete document.documentElement.dataset.appOrientation;
    delete document.documentElement.dataset.appLandscapeLock;
    delete document.documentElement.dataset.readerLandscape;
  }, []);

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
      <ReaderAudioPanel />
   </Shell>
  );
}
