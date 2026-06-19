import { create } from 'zustand';
import { VIEWS, normalizeView } from '../app/routes';
import { clampPage } from '../lib/quran';
import { DEFAULT_TRANSLATION_ID, TRANSLATION_OPTIONS } from '../lib/translations';

export const OVERLAY_TYPES = Object.freeze({
  READER: 'reader',
  INDEX: 'index',
  AYAH: 'ayah-sheet',
  SHARE: 'share-sheet',
  AUDIO: 'audio-player',
  SETTINGS: 'settings',
});

const SCREEN_OVERLAY_BY_VIEW = {
  [VIEWS.READER]: OVERLAY_TYPES.READER,
  [VIEWS.INDEX]: OVERLAY_TYPES.INDEX,
  [VIEWS.SETTINGS]: OVERLAY_TYPES.SETTINGS,
};

const LOCAL_OVERLAY_TYPES = new Set([
  OVERLAY_TYPES.AYAH,
  OVERLAY_TYPES.SHARE,
  OVERLAY_TYPES.AUDIO,
]);

export const DEFAULT_SETTINGS = Object.freeze({
  fontScale: 1,
  theme: getInitialTheme(),
  translation: DEFAULT_TRANSLATION_ID,
  reciter: null,
  playbackRate: 1,
  autoplay: false,
  haptics: true,
});

export const useAppStore = create((set, get) => ({
  view: VIEWS.HOME,
  viewHistory: [],
  navDirection: 'forward',
  overlayStack: [],
  surahInfoReturnView: VIEWS.INDEX,
  page: 1,
  previousReaderPage: null,
  selectedSurah: 1,
  controlsVisible: false,
  selectedLine: null,
  selectedAyah: null,
  shareTarget: null,
  audioTarget: null,
  tafsirTarget: null,
  pendingAyah: null,
  settings: { ...DEFAULT_SETTINGS },
  hydrateLastRead: (lastRead) => set({
    page: clampPage(lastRead?.page || 1),
  }),
  navigateTo: (view, options = {}) => set((state) => transitionToView(
    state,
    normalizeView(view),
    options,
  )),
  setView: (view, navDirection = 'forward') => get().navigateTo(view, { direction: navDirection }),
  goBack: (fallbackView = VIEWS.HOME) => set((state) => navigateBack(
    state,
    normalizeView(fallbackView),
  )),
  openHome: () => set((state) => ({
    ...clearReaderOverlays(state),
    view: VIEWS.HOME,
    viewHistory: [],
    navDirection: 'back',
    overlayStack: [],
    controlsVisible: false,
  })),
  openIndex: () => get().navigateTo(VIEWS.INDEX),
  openSearch: () => get().navigateTo(VIEWS.SEARCH),
  openBookmarks: () => get().navigateTo(VIEWS.TABS),
  openSettings: () => get().navigateTo(VIEWS.SETTINGS, { direction: 'modal' }),
  goPage: (page, pendingAyah = null) => set((state) => {
    const nextPage = clampPage(page);
    const nextState = state.view === VIEWS.READER
      ? state
      : transitionToView(state, VIEWS.READER);

    return {
      ...nextState,
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah,
      navDirection: 'forward',
      controlsVisible: false,
    };
  }),
  goPreviousReaderPage: () => set((state) => {
    if (!state.previousReaderPage || state.previousReaderPage === state.page) return state;

    return {
      page: state.previousReaderPage,
      previousReaderPage: state.page,
      pendingAyah: null,
      view: VIEWS.READER,
      navDirection: 'back',
      controlsVisible: true,
    };
  }),
  setSelectedSurah: (selectedSurah) => set((state) => ({
    ...transitionToView(state, VIEWS.SURAH),
    selectedSurah: Number(selectedSurah) || 1,
  })),
  openSurahInfo: (selectedSurah) => set((state) => ({
    ...transitionToView(state, VIEWS.SURAH_INFO),
    selectedSurah: Number(selectedSurah) || 1,
    surahInfoReturnView: state.view,
  })),
  closeSurahInfo: () => get().goBack(get().surahInfoReturnView || VIEWS.INDEX),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  setSelectedLine: (selectedLine) => set({ selectedLine }),
  setSelectedAyah: (selectedAyah) => set({ selectedAyah }),
  openAyahSheet: (selectedAyah) => set((state) => ({
    selectedAyah,
    overlayStack: pushOverlay(state.overlayStack, OVERLAY_TYPES.AYAH),
  })),
  closeAyahSheet: () => set((state) => ({
    selectedAyah: null,
    overlayStack: removeOverlay(state.overlayStack, OVERLAY_TYPES.AYAH),
  })),
  clearSelectedAyah: () => get().closeAyahSheet(),
  openShareSheet: (shareTarget) => set((state) => ({
    shareTarget,
    overlayStack: pushOverlay(state.overlayStack, OVERLAY_TYPES.SHARE),
  })),
  closeShareSheet: () => set((state) => ({
    shareTarget: null,
    overlayStack: removeOverlay(state.overlayStack, OVERLAY_TYPES.SHARE),
  })),
  openAudioPlayer: (audioTarget) => set((state) => ({
    audioTarget,
    controlsVisible: true,
    overlayStack: pushOverlay(state.overlayStack, OVERLAY_TYPES.AUDIO),
  })),
  closeAudioPlayer: () => set((state) => ({
    audioTarget: null,
    overlayStack: removeOverlay(state.overlayStack, OVERLAY_TYPES.AUDIO),
  })),
  closeTopOverlay: () => set((state) => closeTopOverlay(state)),
  setAudioTarget: (audioTarget) => set({ audioTarget }),
  setTafsirTarget: (tafsirTarget) => set((state) => ({
    ...transitionToView(state, VIEWS.TAFSIR, { direction: 'modal' }),
    tafsirTarget,
  })),
  goAyah: (surahNumber, ayahNumber, page) => set((state) => {
    const nextPage = clampPage(page);
    const nextState = state.view === VIEWS.READER
      ? state
      : transitionToView(state, VIEWS.READER);

    return {
      ...nextState,
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah: { surahNumber: Number(surahNumber), ayahNumber: Number(ayahNumber) },
      navDirection: 'forward',
      controlsVisible: false,
    };
  }),
  clearPendingAyah: () => set({ pendingAyah: null }),
  updateSettings: (patch) => set((state) => ({
    settings: sanitizeSettings({ ...state.settings, ...patch }),
  })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } }),
}));

function transitionToView(state, targetView, options = {}) {
  if (targetView === state.view) {
    return {
      ...state,
      navDirection: options.direction || state.navDirection,
    };
  }

  const leavingReader = targetView !== VIEWS.READER;
  const clearedState = leavingReader ? clearReaderOverlays(state) : state;
  const viewHistory = options.replace
    ? clearedState.viewHistory
    : [...clearedState.viewHistory, clearedState.view].slice(-24);
  const overlayType = SCREEN_OVERLAY_BY_VIEW[targetView];
  const overlayStack = overlayType
    ? pushOverlay(clearedState.overlayStack, overlayType, { kind: 'screen', view: targetView })
    : clearedState.overlayStack;

  return {
    ...clearedState,
    view: targetView,
    viewHistory,
    overlayStack,
    navDirection: options.direction || 'forward',
    controlsVisible: false,
  };
}

function navigateBack(state, fallbackView) {
  const topOverlay = state.overlayStack.at(-1);
  if (topOverlay && LOCAL_OVERLAY_TYPES.has(topOverlay.type)) {
    return closeTopOverlay(state);
  }

  const history = [...state.viewHistory];
  const previousView = history.pop();
  const targetView = normalizeView(previousView || fallbackView);
  const currentScreenOverlay = SCREEN_OVERLAY_BY_VIEW[state.view];
  const overlayStack = currentScreenOverlay
    ? removeOverlay(state.overlayStack, currentScreenOverlay)
    : state.overlayStack;
  const nextState = targetView === VIEWS.READER
    ? state
    : clearReaderOverlays(state);

  return {
    ...nextState,
    view: targetView,
    viewHistory: history,
    overlayStack,
    navDirection: 'back',
    controlsVisible: targetView === VIEWS.READER,
  };
}

function closeTopOverlay(state) {
  const topOverlay = state.overlayStack.at(-1);
  if (!topOverlay) return state;

  if (topOverlay.type === OVERLAY_TYPES.SHARE) {
    return {
      ...state,
      shareTarget: null,
      overlayStack: state.overlayStack.slice(0, -1),
    };
  }

  if (topOverlay.type === OVERLAY_TYPES.AUDIO) {
    return {
      ...state,
      audioTarget: null,
      overlayStack: state.overlayStack.slice(0, -1),
    };
  }

  if (topOverlay.type === OVERLAY_TYPES.AYAH) {
    return {
      ...state,
      selectedAyah: null,
      overlayStack: state.overlayStack.slice(0, -1),
    };
  }

  return navigateBack(state, VIEWS.HOME);
}

function clearReaderOverlays(state) {
  return {
    ...state,
    selectedAyah: null,
    shareTarget: null,
    audioTarget: null,
    overlayStack: state.overlayStack.filter((item) => !LOCAL_OVERLAY_TYPES.has(item.type)),
  };
}

function pushOverlay(stack, type, extra = {}) {
  return [
    ...removeOverlay(stack, type),
    { type, ...extra },
  ];
}

function removeOverlay(stack, type) {
  return stack.filter((item) => item.type !== type);
}

export function sanitizeSettings(value = {}) {
  const translation = TRANSLATION_OPTIONS.some((option) => option.id === value.translation)
    ? value.translation
    : DEFAULT_SETTINGS.translation;

  return {
    fontScale: 1,
    theme: value.theme === 'dark' || value.theme === 'light'
      ? value.theme
      : DEFAULT_SETTINGS.theme,
    translation,
    reciter: typeof value.reciter === 'string' && value.reciter
      ? value.reciter
      : null,
    playbackRate: clampPlaybackRate(value.playbackRate),
    autoplay: Boolean(value.autoplay),
    haptics: value.haptics !== false,
  };
}

function clampPlaybackRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 1;
  return Math.min(2, Math.max(.75, rate));
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';

  let stored = null;
  try {
    stored = window.localStorage.getItem('quran-app-theme');
  } catch {
    // Fall through to the system preference.
  }
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
