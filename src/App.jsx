import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { getLastRead, getSettings, upsertSetting } from './lib/db';
import { getContentSyncResourcesForTranslation } from './lib/translations';
import { syncContentResources } from './services/quranFoundation/contentSync';
import { OVERLAY_TYPES, sanitizeSettings, useAppStore } from './store/useAppStore';
import { Shell } from './components/common/AppChrome';
import { panel } from './components/common/ui';
import { VIEWS, normalizeView } from './app/routes';

const NAVIGATION_SNAPSHOT_KEY = 'quran-app-navigation-snapshot-v1';
import HomeScreen from './pages/HomeScreen';
import ReflectScreen from './pages/ReflectScreen';
import ReaderScreen from './pages/ReaderScreen';
import IndexScreen from './pages/IndexScreen';
import SearchScreen from './pages/SearchScreen';
import BookmarksScreen from './pages/BookmarksScreen';
import TafsirScreen from './pages/TafsirScreen';
import SettingsScreen from './pages/SettingsScreen';
import HelpScreen from './pages/HelpScreen';
import AboutScreen from './pages/AboutScreen';
import SurahScreen from './pages/SurahScreen';
import SurahInfoScreen from './pages/SurahInfoScreen';
import { ShareQuranScreen } from './features/reader/components/ShareAyahSheet';
import { ReaderAudioPanel } from './features/reader/components/ReaderAudioPanel';

const pageMotion = {
  enter: ({ direction, view }) => ({
    x: view === VIEWS.READER || direction === 'back' ? '0%' : '100%',
    zIndex: direction === 'back' ? 0 : 2,
  }),
  center: ({ direction }) => ({ x: '0%', zIndex: direction === 'back' ? 0 : 2 }),
  exit: ({ direction, view }) => ({
    x: view === VIEWS.READER || direction !== 'back' ? '0%' : '100%',
    zIndex: direction === 'back' ? 2 : 0,
    pointerEvents: 'none',
  }),
};

function allowsLandscapeOrientation() {
  const width = window.screen?.width || window.innerWidth;
  const height = window.screen?.height || window.innerHeight;
  return Math.min(width, height) >= 600;
}

function syncPortraitFallbackState() {
  const root = document.documentElement;
  const landscapeQuery = window.matchMedia?.('(orientation: landscape)');
  const isLandscape = Boolean(landscapeQuery?.matches || window.innerWidth > window.innerHeight);
  const angleValue = typeof window.orientation === 'number'
    ? window.orientation
    : window.screen?.orientation?.angle;
  const angle = Number(angleValue) || 0;

  root.dataset.appOrientation = isLandscape ? 'landscape' : 'portrait';
  root.dataset.appLandscapeLock = isLandscape && !allowsLandscapeOrientation()
    ? (angle === -90 || angle === 270 ? 'counterclockwise' : 'clockwise')
    : 'none';
}

function requestPortraitLock() {
  syncPortraitFallbackState();

  if (document.visibilityState === 'hidden') return;

  const orientation = window.screen?.orientation;
  if (allowsLandscapeOrientation()) {
    orientation?.unlock?.();
    return;
  }
  if (!orientation?.lock) return;

  Promise.resolve(orientation.lock('portrait')).catch(() => {
    // Some browsers only allow locking for installed/fullscreen PWAs.
  });
}

function isPageReload() {
  try {
    const navigationEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
    if (navigationEntry?.type) return navigationEntry.type === 'reload';

    // Legacy fallback for older Android WebViews.
    return window.performance?.navigation?.type === 1;
  } catch {
    return false;
  }
}

function readNavigationSnapshot() {
  try {
    const raw = window.sessionStorage.getItem(NAVIGATION_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const {
    view,
    hydrateLastRead,
    restoreNavigation,
    settings,
    updateSettings,
    goBack,
    openHome,
    navDirection,
    overlayStack,
    audioPlayerVisible,
    hideAudioPlayer,
    shareTarget,
    closeSharePage,
    selectedSurah,
    surahInfoReturnView,
    indexTab,
    expandedIndexSurah,
    expandedIndexJuz,
    page,
    lastReadTarget,
    tafsirTarget,
  } = useAppStore(useShallow((state) => ({
    view: state.view,
    hydrateLastRead: state.hydrateLastRead,
    restoreNavigation: state.restoreNavigation,
    settings: state.settings,
    updateSettings: state.updateSettings,
    goBack: state.goBack,
    openHome: state.openHome,
    navDirection: state.navDirection,
    overlayStack: state.overlayStack,
    audioPlayerVisible: state.audioPlayerVisible,
    hideAudioPlayer: state.hideAudioPlayer,
    shareTarget: state.shareTarget,
    closeSharePage: state.closeSharePage,
    selectedSurah: state.selectedSurah,
    surahInfoReturnView: state.surahInfoReturnView,
    indexTab: state.indexTab,
    expandedIndexSurah: state.expandedIndexSurah,
    expandedIndexJuz: state.expandedIndexJuz,
    page: state.page,
    lastReadTarget: state.lastReadTarget,
    tafsirTarget: state.tafsirTarget,
  })));
  const activeView = normalizeView(view);
  const reducePageMotion = useReducedMotion();
  // Keep focused fields visible as the mobile visual viewport contracts.
  // Scroll the nearest scrollable container, not the entire page or sheet.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    let frame = 0;
    const revealFocusedField = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const field = document.activeElement;
        if (!field?.matches?.('input, textarea, [contenteditable="true"]')) return;
        const rect = field.getBoundingClientRect();
        const visibleBottom = viewport.offsetTop + viewport.height - 16;
        const visibleTop = viewport.offsetTop + 12;
        if (rect.bottom > visibleBottom || rect.top < visibleTop) {
          field.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            block: 'nearest',
          });
        }
      });
    };
    viewport.addEventListener('resize', revealFocusedField);
    viewport.addEventListener('scroll', revealFocusedField);
    document.addEventListener('focusin', revealFocusedField);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', revealFocusedField);
      viewport.removeEventListener('scroll', revealFocusedField);
      document.removeEventListener('focusin', revealFocusedField);
    };
  }, []);

  const [booted, setBooted] = useState(false);
  const historyReadyRef = useRef(false);
  const navigationFromPopRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const previousNavigationRef = useRef({ view: activeView, overlayDepth: overlayStack.length });
  const latestNavigationRef = useRef({
    activeView,
    overlayStack,
    goBack,
    openHome,
    audioPlayerVisible,
    hideAudioPlayer,
  });

  latestNavigationRef.current = {
    activeView,
    overlayStack,
    goBack,
    openHome,
    audioPlayerVisible,
    hideAudioPlayer,
  };

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
    const reload = isPageReload();
    const navigationSnapshot = reload ? readNavigationSnapshot() : null;

    // A brand-new app launch always starts at Home. A snapshot is used only
    // for an actual page refresh, never as the app's default entry screen.
    if (!reload) {
      try {
        window.sessionStorage.removeItem(NAVIGATION_SNAPSHOT_KEY);
      } catch {
        // Ignore storage restrictions; Home is already the store default.
      }
    }

    Promise.all([getLastRead(), getSettings()])
      .then(([lastRead, storedSettings]) => {
        if (!mounted) return;

        // Restore reading progress independently from navigation.
        if (lastRead?.page) hydrateLastRead(lastRead);
        if (storedSettings.app) updateSettings(sanitizeSettings(storedSettings.app));

        // Refresh returns to the exact screen that was open.
        if (navigationSnapshot) restoreNavigation(navigationSnapshot);
      })
      .catch(() => {
        // Start with safe defaults if local persistence is unavailable.
        if (mounted && navigationSnapshot) restoreNavigation(navigationSnapshot);
      })
      .finally(() => {
        if (mounted) setBooted(true);
      });

    return () => {
      mounted = false;
    };
  }, [hydrateLastRead, restoreNavigation, updateSettings]);



  useEffect(() => {
    if (!booted) return undefined;

    let active = true;
    const syncSelectedContent = async () => {
      if (navigator.onLine === false) return;
      try {
        const resources = await getContentSyncResourcesForTranslation(settings.translation);
        if (!active || !Object.keys(resources).length) return;
        await syncContentResources(resources);
      } catch (error) {
        // Content Sync is best-effort: existing reader behavior and local data
        // remain available if the network or Quran Foundation is unavailable.
        console.warn('Quran Foundation Content Sync was deferred:', error);
      }
    };

    syncSelectedContent();
    window.addEventListener('online', syncSelectedContent);
    const refreshInterval = window.setInterval(syncSelectedContent, 24 * 60 * 60 * 1000);

    return () => {
      active = false;
      window.removeEventListener('online', syncSelectedContent);
      window.clearInterval(refreshInterval);
    };
  }, [booted, settings.translation]);

  useEffect(() => {
    if (!booted) return undefined;

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
  }, [activeView, booted, navDirection, overlayStack.length]);

  useEffect(() => {
    if (!booted) return;

    const snapshot = {
      view: activeView,
      viewHistory: useAppStore.getState().viewHistory,
      page,
      lastReadTarget,
      selectedSurah,
      surahInfoReturnView,
      indexTab,
      expandedIndexSurah,
      expandedIndexJuz,
      shareTarget,
      tafsirTarget,
    };

    try {
      window.sessionStorage.setItem(NAVIGATION_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // Route restoration is best-effort when session storage is restricted.
    }
  }, [
    activeView,
    booted,
    expandedIndexJuz,
    expandedIndexSurah,
    indexTab,
    lastReadTarget,
    page,
    selectedSurah,
    shareTarget,
    surahInfoReturnView,
    tafsirTarget,
  ]);

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
        audioPlayerVisible: isAudioPlayerExpanded,
        hideAudioPlayer: collapseAudioPlayer,
      } = latestNavigationRef.current;
      // Android/PWA back should first collapse the expanded player. Re-add
      // the current history entry because popstate has already moved backward.
      if (isAudioPlayerExpanded) {
        collapseAudioPlayer();
        window.history.pushState(
          {
            ...(window.history.state || {}),
            quranApp: true,
            view: currentView,
            overlayDepth: currentOverlays.length,
          },
          document.title,
        );
        return;
      }

      const topOverlay = currentOverlays.at(-1);
      const hasLocalOverlay = topOverlay && (
        topOverlay.type === OVERLAY_TYPES.AYAH
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
      // Pickers and dialogs own Escape before app-level back navigation.
      if (event.key === 'Escape' && !event.defaultPrevented) goBack();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack]);

  useEffect(() => {
    const theme = settings.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.haptics = 'on';
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
      <div className="app-navigation-stack">
      <AnimatePresence initial={false} custom={{ direction: navDirection, view: activeView }} mode="sync">
        <motion.div
          key={activeView}
          className="app-navigation-page"
          custom={{ direction: navDirection, view: activeView }}
          variants={pageMotion}
          initial={reducePageMotion ? false : 'enter'}
          animate="center"
          exit={reducePageMotion || activeView === VIEWS.READER ? { x: '0%', pointerEvents: 'none' } : 'exit'}
          transition={{ duration: reducePageMotion || activeView === VIEWS.READER ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
        {activeView === VIEWS.HOME && <HomeScreen key="home" />}
        {activeView === VIEWS.REFLECT && <ReflectScreen key="reflect" />}
        {activeView === VIEWS.READER && <ReaderScreen key="reader" />}
        {activeView === VIEWS.INDEX && <IndexScreen key="index" />}
        {activeView === VIEWS.SURAH && <SurahScreen key="surah" />}
        {activeView === VIEWS.SURAH_INFO && <SurahInfoScreen key="surahInfo" />}
        {activeView === VIEWS.SEARCH && <SearchScreen key="search" />}
        {activeView === VIEWS.TABS && <BookmarksScreen key="tabs" />}
        {activeView === VIEWS.TAFSIR && <TafsirScreen key="tafsir" />}
        {activeView === VIEWS.SETTINGS && <SettingsScreen key="settings" />}
        {activeView === VIEWS.HELP && <HelpScreen key="help" />}
        {activeView === VIEWS.ABOUT && <AboutScreen key="about" />}
        {activeView === VIEWS.SHARE_QURAN && shareTarget && (
          <ShareQuranScreen key="shareQuran" ayah={shareTarget} onClose={closeSharePage} />
        )}
        </motion.div>
      </AnimatePresence>
      </div>
      <ReaderAudioPanel />
   </Shell>
  );
}
