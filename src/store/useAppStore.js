import { create } from 'zustand';
import { VIEWS, normalizeView } from '../app/routes';
import { clampPage, getAyahMarkerPage } from '../lib/quran';
import { DEFAULT_TRANSLATION_ID, TRANSLATION_OPTIONS } from '../lib/translations';

export const OVERLAY_TYPES = Object.freeze({
  READER: 'reader',
  INDEX: 'index',
  AYAH: 'ayah-sheet',
  SHARE: 'share-sheet',
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
  audioQueue: [],
  audioQueueIndex: -1,
  audioPosition: 0,
  audioDuration: 0,
  audioPlaying: false,
  audioRepeat: false,
  audioReciter: null,
  audioPlaybackRate: 1,
  audioPlayerActive: false,
  audioPlayerVisible: false,
  tafsirTarget: null,
  pendingAyah: null,
  pendingQuarterFlash: null,
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
      pendingQuarterFlash: null,
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
      pendingQuarterFlash: null,
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
  openAudioPlayer: (audioTarget) => set((state) => {
    const target = normalizeAudioTarget(audioTarget);
    if (!target) return state;

    const sameTarget = sameAudioTarget(state.audioTarget, target);

    return {
      audioTarget: target,
      audioQueue: [target],
      audioQueueIndex: 0,
      audioPosition: sameTarget ? state.audioPosition : 0,
      audioDuration: sameTarget ? state.audioDuration : 0,
      audioPlaying: true,
      audioReciter: state.settings.reciter,
      audioPlaybackRate: state.settings.playbackRate,
      audioPlayerActive: true,
      audioPlayerVisible: true,
      controlsVisible: true,
    };
  }),
  closeAudioPlayer: () => set({
    audioTarget: null,
    audioQueue: [],
    audioQueueIndex: -1,
    audioPosition: 0,
    audioDuration: 0,
    audioPlaying: false,
    audioRepeat: false,
    audioPlayerActive: false,
    audioPlayerVisible: false,
  }),
  closeTopOverlay: () => set((state) => closeTopOverlay(state)),
  setAudioTarget: (audioTarget) => set((state) => {
    const target = normalizeAudioTarget(audioTarget);
    const existingIndex = state.audioQueue.findIndex((item) => sameAudioTarget(item, target));

    return {
      audioTarget: target,
      audioQueue: target
        ? (existingIndex >= 0 ? state.audioQueue : [target])
        : state.audioQueue,
      audioQueueIndex: target
        ? (existingIndex >= 0 ? existingIndex : 0)
        : state.audioQueueIndex,
      audioPosition: sameAudioTarget(state.audioTarget, target) ? state.audioPosition : 0,
      audioDuration: sameAudioTarget(state.audioTarget, target) ? state.audioDuration : 0,
    };
  }),
  setAudioQueue: (audioQueue, audioQueueIndex = 0) => set((state) => {
    const nextQueue = Array.isArray(audioQueue)
      ? audioQueue.map(normalizeAudioTarget).filter(Boolean)
      : [];
    const nextIndex = Number.isInteger(audioQueueIndex) ? audioQueueIndex : 0;
    const queueUnchanged = (
      state.audioQueueIndex === nextIndex &&
      state.audioQueue.length === nextQueue.length &&
      state.audioQueue.every((item, index) => sameAudioTarget(item, nextQueue[index]))
    );

    return queueUnchanged
      ? state
      : { audioQueue: nextQueue, audioQueueIndex: nextIndex };
  }),
  setAudioProgress: (audioPosition, audioDuration) => set((state) => ({
    audioPosition: Math.max(0, Number(audioPosition) || 0),
    audioDuration: Number.isFinite(Number(audioDuration))
      ? Math.max(0, Number(audioDuration))
      : state.audioDuration,
  })),
  setAudioPlaying: (audioPlaying) => set({ audioPlaying: Boolean(audioPlaying) }),
  setAudioRepeat: (audioRepeat) => set({ audioRepeat: Boolean(audioRepeat) }),
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
      pendingQuarterFlash: null,
      navDirection: 'forward',
      controlsVisible: false,
    };
  }),
  goQuarterTarget: (target) => set((state) => {
    const markerId = target?.id || 'start';
    const sourcePage = clampPage(target?.page);
    const nextPage = markerId === 'start'
      ? sourcePage
      : clampPage(
          getAyahMarkerPage(target?.surah, target?.ayah) || sourcePage,
        );
    const nextState = state.view === VIEWS.READER
      ? state
      : transitionToView(state, VIEWS.READER);

    return {
      ...nextState,
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah: null,
      pendingQuarterFlash: {
        targetPage: nextPage,
        targetSurah: Number(target?.surah),
        targetAyah: Number(target?.ayah),
        markerId,
        flashMode: markerId === 'start' ? 'first-rendered-line' : 'ayah-marker',
      },
      navDirection: 'forward',
      controlsVisible: false,
    };
  }),
  clearPendingAyah: () => set({ pendingAyah: null }),
  clearPendingQuarterFlash: () => set({ pendingQuarterFlash: null }),
  updateSettings: (patch) => set((state) => {
    const settings = sanitizeSettings({ ...state.settings, ...patch });
    return {
      settings,
      audioReciter: settings.reciter,
      audioPlaybackRate: settings.playbackRate,
    };
  }),
  resetSettings: () => set({
    settings: { ...DEFAULT_SETTINGS, theme: 'light' },
    audioReciter: DEFAULT_SETTINGS.reciter,
    audioPlaybackRate: DEFAULT_SETTINGS.playbackRate,
  }),
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
    pendingQuarterFlash: null,
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

function normalizeAudioTarget(target) {
  if (!target?.surahNumber || !target?.ayahNumber) return null;

  return {
    ...target,
    page: Number(target.page) || null,
    surahNumber: Number(target.surahNumber),
    ayahNumber: Number(target.ayahNumber),
  };
}

function sameAudioTarget(first, second) {
  return Boolean(
    first &&
    second &&
    Number(first.surahNumber) === Number(second.surahNumber) &&
    Number(first.ayahNumber) === Number(second.ayahNumber)
  );
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
