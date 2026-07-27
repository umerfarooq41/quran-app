import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { getLastRead, getSettings, upsertSetting } from './lib/db';
import { OVERLAY_TYPES, sanitizeSettings, useAppStore } from './store/useAppStore';
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

function syncPortraitFallbackState() {
  const root = document.documentElement;
  const landscapeQuery = window.matchMedia?.('(orientation: landscape)');
  const isLandscape = Boolean(landscapeQuery?.matches || window.innerWidth > window.innerHeight);
  const angleValue = typeof window.orientation === 'number'
    ? window.orientation
    : window.screen?.orientation?.angle;
  const angle = Number(angleValue) || 0;

  root.dataset.appOrientation = isLandscape ? 'landscape' : 'portrait';
  root.dataset.appLandscapeLock = isLandscape
    ? (angle === -90 || angle === 270 ? 'counterclockwise' : 'clockwise')
    : 'none';
}

function requestPortraitLock() {
  syncPortraitFallbackState();

  if (document.visibilityState === 'hidden') return;

  const orientation = window.screen?.orientation;
  if (!orientation?.lock) return;

  Promise.resolve(orientation.lock('portrait')).catch(() => {
    // Some browsers only allow locking for installed/fullscreen PWAs.
  });
}

export default function App() {
  const {
    view,
    hydrateLastRead,
    settings,
    updateSettings,
    goBack,
    openHome,
    navDirection,
    overlayStack,
  } = useAppStore(useShallow((state) => ({
    view: state.view,
    hydrateLastRead: state.hydrateLastRead,
    settings: state.settings,
    updateSettings: state.updateSettings,
    goBack: state.goBack,
    openHome: state.openHome,
    navDirection: state.navDirection,
    overlayStack: state.overlayStack,
  })));
  const activeView = normalizeView(view);
  const [booted, setBooted] = useState(false);
  const historyReadyRef = useRef(false);
  const navigationFromPopRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const previousNavigationRef = useRef({ view: activeView, overlayDepth: overlayStack.length });
  const latestNavigationRef = useRef({ activeView, overlayStack, goBack, openHome });

  latestNavigationRef.current = { activeView, overlayStack, goBack, openHome };

  useEffect(() => {
    requestPortraitLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestPortraitLock();
    };

    window.addEventListener('resize', syncPortraitFallbackState);
    window.addEventListener('orientationchange', requestPortraitLock);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', syncPortraitFallbackState);
      window.removeEventListener('orientationchange', requestPortraitLock);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      delete document.documentElement.dataset.appOrientation;
      delete document.documentElement.dataset.appLandscapeLock;
    };
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
    const createHistoryState = () => ({
      ...(window.history.state || {}),
      quranApp: true,
      view: activeView,
      overlayDepth: overlayStack.length,
    });

    if (!historyReadyRef.current) {
      window.history.replaceState(createHistoryState(), document.title);
      historyReadyRef.current = true;
      previousNavigationRef.current = {
        view: activeView,
        overlayDepth: overlayStack.length,
      };
      return;
    }

    const previous = previousNavigationRef.current;
    const overlayClosed = overlayStack.length < previous.overlayDepth;
    const movedBackward = navDirection === 'back' || overlayClosed;

    previousNavigationRef.current = {
      view: activeView,
      overlayDepth: overlayStack.length,
    };

    if (navigationFromPopRef.current) {
      navigationFromPopRef.current = false;
      window.history.replaceState(createHistoryState(), document.title);
      return;
    }

    if (movedBackward && window.history.length > 1) {
      ignoreNextPopRef.current = true;
      window.history.back();
      return;
    }

    window.history.pushState(createHistoryState(), document.title);
  }, [activeView, navDirection, overlayStack.length]);

  useEffect(() => {
    const handlePopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        window.history.replaceState(
          {
            ...(window.history.state || {}),
            quranApp: true,
            view: latestNavigationRef.current.activeView,
            overlayDepth: latestNavigationRef.current.overlayStack.length,
          },
          document.title,
        );
        return;
      }

      const {
        activeView: currentView,
        overlayStack: currentOverlays,
        goBack: navigateBack,
        openHome: navigateHome,
      } = latestNavigationRef.current;
      const topOverlay = currentOverlays.at(-1);
      const hasLocalOverlay = topOverlay && (
        topOverlay.type === OVERLAY_TYPES.AYAH
        || topOverlay.type === OVERLAY_TYPES.SHARE
      );

      if (hasLocalOverlay) {
        navigationFromPopRef.current = true;
        navigateBack();
        return;
      }

      if (currentView === VIEWS.READER) {
        navigationFromPopRef.current = true;
        navigateHome();
        return;
      }

      if (currentView !== VIEWS.HOME) {
        navigationFromPopRef.current = true;
        navigateBack();
      }
      // On Home, do not intercept again; Android/browser back may leave the PWA.
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
