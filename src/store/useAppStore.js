import { create } from 'zustand';
import { VIEWS, normalizeView } from '../app/routes';
import { clampPage, findPageForReference, getAyahMarkerPage } from '../lib/quran';
import { DEFAULT_TRANSLATION_ID, TRANSLATION_OPTIONS } from '../lib/translations';

export const OVERLAY_TYPES = Object.freeze({
  READER: 'reader',
  INDEX: 'index',
  AYAH: 'ayah-sheet',
  SETTINGS: 'settings',
});

const SCREEN_OVERLAY_BY_VIEW = {
  [VIEWS.READER]: OVERLAY_TYPES.READER,
  [VIEWS.INDEX]: OVERLAY_TYPES.INDEX,
  [VIEWS.SETTINGS]: OVERLAY_TYPES.SETTINGS,
};

const LOCAL_OVERLAY_TYPES = new Set([
  OVERLAY_TYPES.AYAH,
]);


const FAVORITE_SURAHS_STORAGE_KEY = 'quran-app-favorite-surahs';

function getInitialFavoriteSurahs() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(FAVORITE_SURAHS_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];

    return [...new Set(stored.map(Number).filter((number) => number >= 1 && number <= 114))];
  } catch {
    return [];
  }
}

function persistFavoriteSurahs(favoriteSurahs) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(FAVORITE_SURAHS_STORAGE_KEY, JSON.stringify(favoriteSurahs));
  } catch {
    // Keep favorites available for this session when storage is unavailable.
  }
}

export const DEFAULT_SETTINGS = Object.freeze({
  fontScale: 1,
  theme: getInitialTheme(),
  translation: DEFAULT_TRANSLATION_ID,
  translationLanguage: 'ur',
  reciter: null,
  playbackRate: 1,
  autoplay: false,
  haptics: true,
  wordByWordTranslation: false,
  wordByWordLanguage: 'en',
  followRecitation: true,
});

export const useAppStore = create((set, get) => ({
  view: VIEWS.HOME,
  viewHistory: [],
  navDirection: 'forward',
  overlayStack: [],
  surahInfoReturnView: VIEWS.INDEX,
  indexTab: 'juz',
  expandedIndexSurah: null,
  expandedIndexJuz: null,
  favoriteSurahs: getInitialFavoriteSurahs(),
  page: 1,
  lastReadTarget: { page: 1, surahNumber: 1, ayahNumber: 1 },
  previousReaderPage: null,
  selectedSurah: 1,
  controlsVisible: false,
  selectedLine: null,
  selectedAyah: null,
  shareTarget: null,
  audioTarget: null,
  audioMode: null,
  audioSurahNumber: null,
  playingVerseKey: null,
  playingWordPosition: null,
  playingWordOccurrenceIndex: null,
  surahTimeline: [],
  followRecitation: true,
  audioQueue: [],
  audioQueueIndex: -1,
  audioPosition: 0,
  audioDuration: 0,
  audioPlaying: false,
  audioRepeat: 'off',
  audioReciter: null,
  audioPlaybackRate: 1,
  audioPlayerActive: false,
  audioPlayerVisible: false,
  tafsirTarget: null,
  pendingAyah: null,
  pendingQuarterFlash: null,
  settings: { ...DEFAULT_SETTINGS },
  hydrateLastRead: (lastRead) => set((state) => {
    const nextPage = clampPage(lastRead?.page || state.page || 1);
    
    return {
      // Last-read hydration must never decide which screen opens.
      // A fresh app launch stays on Home; Reader is opened only by navigation.
      page: nextPage,
      lastReadTarget: {
        page: nextPage,
        surahNumber: Number(lastRead?.surahNumber) || state.lastReadTarget?.surahNumber || 1,
        ayahNumber: Number(lastRead?.ayahNumber) || state.lastReadTarget?.ayahNumber || 1,
      },
      controlsVisible: false,
    };
  }),
  navigateTo: (view, options = {}) => set((state) => transitionToView(
    state,
    normalizeView(view),
    options,
  )),
  setView: (view, navDirection = 'forward') => get().navigateTo(view, { direction: navDirection }),
  restoreNavigation: (snapshot) => set((state) => {
    if (!snapshot || typeof snapshot !== 'object') return state;

    const restoredView = normalizeView(snapshot.view);
    const restoredHistory = Array.isArray(snapshot.viewHistory)
      ? snapshot.viewHistory.map(normalizeView).filter(Boolean).slice(-24)
      : [];

    const nextPage = snapshot.page ? clampPage(snapshot.page) : state.page;
    

    return {
      ...state,
      view: restoredView,
      viewHistory: restoredHistory,
      navDirection: 'forward',
      overlayStack: [],
      page: nextPage,
      lastReadTarget: snapshot.lastReadTarget?.surahNumber && snapshot.lastReadTarget?.ayahNumber
        ? {
            page: clampPage(snapshot.lastReadTarget.page || snapshot.page || state.page),
            surahNumber: Number(snapshot.lastReadTarget.surahNumber),
            ayahNumber: Number(snapshot.lastReadTarget.ayahNumber),
          }
        : state.lastReadTarget,
      selectedSurah: Number(snapshot.selectedSurah) || state.selectedSurah,
      surahInfoReturnView: normalizeView(snapshot.surahInfoReturnView || state.surahInfoReturnView),
      indexTab: snapshot.indexTab === 'surahs' ? 'surahs' : 'juz',
      expandedIndexSurah: Number(snapshot.expandedIndexSurah) || null,
      expandedIndexJuz: Number(snapshot.expandedIndexJuz) || null,
      shareTarget: restoredView === VIEWS.SHARE_QURAN
        ? (snapshot.shareTarget || state.shareTarget)
        : null,
      tafsirTarget: restoredView === VIEWS.TAFSIR
        ? (snapshot.tafsirTarget || state.tafsirTarget)
        : state.tafsirTarget,
      selectedAyah: null,
      controlsVisible: false,
    };
  }),
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
  openHelp: () => get().navigateTo(VIEWS.HELP),
  openAbout: () => get().navigateTo(VIEWS.ABOUT),
  openSharePage: (shareTarget) => set((state) => ({
    ...transitionToView(state, VIEWS.SHARE_QURAN),
    shareTarget,
  })),
  closeSharePage: () => set((state) => ({
    ...navigateBack(state, VIEWS.READER),
    shareTarget: null,
  })),
  goPage: (page, pendingAyah = null, options = {}) => set((state) => {
    const nextPage = clampPage(page);
    const nextState = state.view === VIEWS.READER
      ? state
      : transitionToView(state, VIEWS.READER);
    

    return {
      ...nextState,
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah,
      lastReadTarget: pendingAyah?.surahNumber && pendingAyah?.ayahNumber
        ? { page: nextPage, surahNumber: Number(pendingAyah.surahNumber), ayahNumber: Number(pendingAyah.ayahNumber) }
        : state.lastReadTarget,
      pendingQuarterFlash: null,
      navDirection: 'forward',
      controlsVisible: options.keepControlsVisible ? true : false,
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
  closeSurahInfo: () => get().navigateTo(get().surahInfoReturnView || VIEWS.INDEX, { direction: 'back', replace: true }),
  setIndexTab: (indexTab) => set({ indexTab: indexTab === 'surahs' ? 'surahs' : 'juz' }),
  setExpandedIndexSurah: (expandedIndexSurah) => set({
    expandedIndexSurah: Number(expandedIndexSurah) || null,
  }),
  setExpandedIndexJuz: (expandedIndexJuz) => set({
    expandedIndexJuz: Number(expandedIndexJuz) || null,
  }),
  toggleFavoriteSurah: (surahNumber) => set((state) => {
    const number = Number(surahNumber);
    if (number < 1 || number > 114) return state;

    const isFavorite = state.favoriteSurahs.includes(number);
    const favoriteSurahs = isFavorite
      ? state.favoriteSurahs.filter((item) => item !== number)
      : [...state.favoriteSurahs, number];

    persistFavoriteSurahs(favoriteSurahs);
    return { favoriteSurahs };
  }),
  setLastReadTarget: (target) => set((state) => {
    if (!target?.surahNumber || !target?.ayahNumber) return state;
    return {
      lastReadTarget: {
        page: clampPage(target.page || state.page),
        surahNumber: Number(target.surahNumber),
        ayahNumber: Number(target.ayahNumber),
      },
    };
  }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  setSelectedLine: (selectedLine) => set({ selectedLine }),
  setSelectedAyah: (selectedAyah) => set((state) => ({
    selectedAyah,
    lastReadTarget: selectedAyah?.surahNumber && selectedAyah?.ayahNumber
      ? { page: clampPage(selectedAyah.page || state.page), surahNumber: Number(selectedAyah.surahNumber), ayahNumber: Number(selectedAyah.ayahNumber) }
      : state.lastReadTarget,
  })),
  openAyahSheet: (selectedAyah) => set((state) => ({
    selectedAyah,
    lastReadTarget: selectedAyah?.surahNumber && selectedAyah?.ayahNumber
      ? { page: clampPage(selectedAyah.page || state.page), surahNumber: Number(selectedAyah.surahNumber), ayahNumber: Number(selectedAyah.ayahNumber) }
      : state.lastReadTarget,
    overlayStack: pushOverlay(state.overlayStack, OVERLAY_TYPES.AYAH),
  })),
  closeAyahSheet: () => set((state) => ({
    selectedAyah: null,
    overlayStack: removeOverlay(state.overlayStack, OVERLAY_TYPES.AYAH),
  })),
  clearSelectedAyah: () => get().closeAyahSheet(),
  openAudioPlayer: (audioTarget) => set((state) => {
    const target = normalizeAudioTarget(audioTarget);
    if (!target) return state;

    const sameTarget = sameAudioTarget(state.audioTarget, target);

    return {
      audioTarget: target,
      lastReadTarget: target?.surahNumber && target?.ayahNumber
        ? { page: clampPage(target.page || state.page), surahNumber: Number(target.surahNumber), ayahNumber: Number(target.ayahNumber) }
        : state.lastReadTarget,
      audioQueue: [target],
      audioQueueIndex: 0,
      audioPosition: sameTarget ? state.audioPosition : 0,
      audioDuration: sameTarget ? state.audioDuration : 0,
      audioPlaying: true,
      // A fresh user playback request must immediately revoke timing authority
      // from the previous recitation. Until the new source/seek produces a real
      // timed word, Reader follow has no verse/word state that can pull the
      // page back to the previous playback target.
      playingVerseKey: null,
      playingWordPosition: null,
      playingWordOccurrenceIndex: null,
      audioReciter: state.settings.reciter,
      audioPlaybackRate: state.settings.playbackRate,
      audioPlayerActive: true,
      audioPlayerVisible: true,
      controlsVisible: false,
    };
  }),
  closeAudioPlayer: () => set({
    audioTarget: null,
    audioQueue: [],
    audioQueueIndex: -1,
    audioPosition: 0,
    audioDuration: 0,
    audioPlaying: false,
    audioRepeat: 'off',
    playingVerseKey: null,
    playingWordPosition: null,
    playingWordOccurrenceIndex: null,
    audioPlayerActive: false,
    audioPlayerVisible: false,
  }),
  showAudioPlayer: () => set((state) => (
    state.audioPlayerActive ? { audioPlayerVisible: true, controlsVisible: false } : state
  )),
  hideAudioPlayer: () => set((state) => (
    state.audioPlayerActive ? { audioPlayerVisible: false } : state
  )),
  closeTopOverlay: () => set((state) => closeTopOverlay(state)),
  setAudioTarget: (audioTarget) => set((state) => {
    const target = normalizeAudioTarget(audioTarget);
    const existingIndex = state.audioQueue.findIndex((item) => sameAudioTarget(item, target));
    const preserveProgress = Boolean(
      target?.preserveAudioProgress
      || sameAudioTarget(state.audioTarget, target)
    );

    return {
      audioTarget: target,
      lastReadTarget: target?.surahNumber && target?.ayahNumber
        ? { page: clampPage(target.page || state.page), surahNumber: Number(target.surahNumber), ayahNumber: Number(target.ayahNumber) }
        : state.lastReadTarget,
      audioQueue: target
        ? (existingIndex >= 0 ? state.audioQueue : [target])
        : state.audioQueue,
      audioQueueIndex: target
        ? (existingIndex >= 0 ? existingIndex : 0)
        : state.audioQueueIndex,
      // Timed ayah/page changes inside one full-Surah media source must not
      // reset the seek UI. Real source changes still start with fresh progress.
      audioPosition: preserveProgress ? state.audioPosition : 0,
      audioDuration: preserveProgress ? state.audioDuration : 0,
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
  setAudioMode: (audioMode) => set((state) => {
    const nextMode = audioMode === 'surah' || audioMode === 'ayah' ? audioMode : null;
    return state.audioMode === nextMode ? state : { audioMode: nextMode };
  }),
  setAudioSurahNumber: (audioSurahNumber) => set((state) => {
    const nextSurahNumber = Number(audioSurahNumber) || null;
    return state.audioSurahNumber === nextSurahNumber ? state : { audioSurahNumber: nextSurahNumber };
  }),
  setPlayingVerseKey: (playingVerseKey) => set((state) => {
    const nextVerseKey = typeof playingVerseKey === 'string' && playingVerseKey ? playingVerseKey : null;
    if (state.playingVerseKey === nextVerseKey) return state;
    return {
      playingVerseKey: nextVerseKey,
      playingWordPosition: null,
      playingWordOccurrenceIndex: null,
    };
  }),
  setPlayingWord: (playingWordPosition, playingWordOccurrenceIndex = null) => set((state) => {
    const position = Number(playingWordPosition);
    const occurrenceIndex = Number(playingWordOccurrenceIndex);
    const nextPosition = Number.isInteger(position) && position > 0 ? position : null;
    const nextOccurrenceIndex = (
      nextPosition !== null
      && Number.isInteger(occurrenceIndex)
      && occurrenceIndex >= 0
    )
      ? occurrenceIndex
      : null;

    if (
      state.playingWordPosition === nextPosition
      && state.playingWordOccurrenceIndex === nextOccurrenceIndex
    ) {
      return state;
    }

    return {
      playingWordPosition: nextPosition,
      playingWordOccurrenceIndex: nextOccurrenceIndex,
    };
  }),
  setSurahTimeline: (surahTimeline) => set((state) => {
    const nextTimeline = Array.isArray(surahTimeline) ? surahTimeline : [];
    return state.surahTimeline === nextTimeline ? state : { surahTimeline: nextTimeline };
  }),
  setFollowRecitation: () => set((state) => {
    if (state.followRecitation === true && state.settings.followRecitation === true) return state;
    return {
      followRecitation: true,
      settings: { ...state.settings, followRecitation: true },
    };
  }),
  setAudioPlaying: (audioPlaying) => set((state) => {
    const nextPlaying = Boolean(audioPlaying);
    return state.audioPlaying === nextPlaying ? state : { audioPlaying: nextPlaying };
  }),
  setAudioRepeat: (audioRepeat) => set((state) => {
    const nextMode = audioRepeat === 'ayah' || audioRepeat === 'surah'
      ? audioRepeat
      : 'off';
    return state.audioRepeat === nextMode ? state : { audioRepeat: nextMode };
  }),
  setTafsirTarget: (tafsirTarget) => set((state) => ({
    ...transitionToView(state, VIEWS.TAFSIR, { direction: 'modal' }),
    tafsirTarget,
  })),
  goAyah: (surahNumber, ayahNumber, page) => set((state) => {
    const safeSurahNumber = Number(surahNumber);
    const safeAyahNumber = Number(ayahNumber);
    const canonicalPage = findPageForReference(safeSurahNumber, safeAyahNumber);
    const nextPage = clampPage(canonicalPage || page);
    const nextState = state.view === VIEWS.READER
      ? state
      : transitionToView(state, VIEWS.READER);
    

    return {
      ...nextState,
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah: { surahNumber: safeSurahNumber, ayahNumber: safeAyahNumber },
      lastReadTarget: { page: nextPage, surahNumber: safeSurahNumber, ayahNumber: safeAyahNumber },
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
      pendingQuarterFlash: markerId === 'start'
        ? null
        : {
            targetPage: nextPage,
            targetSurah: Number(target?.surah) || null,
            targetAyah: Number(target?.ayah) || null,
            markerId,
            flashMode: 'ayah-marker',
          },
      navDirection: 'forward',
      controlsVisible: false,
    };
  }),
  clearPendingAyah: () => set({ pendingAyah: null }),
  clearPendingQuarterFlash: () => set({ pendingQuarterFlash: null }),
  updateSettings: (patch) => set((state) => {
    const merged = { ...state.settings, ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'translation')) {
      const selected = TRANSLATION_OPTIONS.find((option) => option.id === patch.translation);
      if (selected) merged.translationLanguage = String(selected.language || 'Ur').toLowerCase();
    }
    const settings = sanitizeSettings(merged);
    return {
      settings,
      followRecitation: settings.followRecitation,
      audioReciter: settings.reciter,
      audioPlaybackRate: settings.playbackRate,
    };
  }),
  resetSettings: () => set({
    settings: { ...DEFAULT_SETTINGS, theme: 'light' },
    followRecitation: DEFAULT_SETTINGS.followRecitation,
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
    shareTarget: state.view === VIEWS.SHARE_QURAN ? null : nextState.shareTarget,
  };
}

function closeTopOverlay(state) {
  const topOverlay = state.overlayStack.at(-1);
  if (!topOverlay) return state;

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

  const surahNumber = Number(target.surahNumber);
  const ayahNumber = Number(target.ayahNumber);

  const suppliedPage = Number(target.page);
  const hasSuppliedPage = Number.isInteger(suppliedPage) && suppliedPage > 0;
  const pageIsAuthoritative = Boolean(target.pageIsAuthoritative && hasSuppliedPage);

  return {
    ...target,
    // Preserve the page the reader is already showing/requesting even before
    // word timing confirms it. A missing page stays missing; never manufacture
    // a canonical ayah-start page here because that can flash the reader away
    // from its current page during audio startup.
    page: hasSuppliedPage ? clampPage(suppliedPage) : null,
    pageIsAuthoritative,
    surahNumber,
    ayahNumber,
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
  const selectedTranslation = TRANSLATION_OPTIONS.find((option) => option.id === translation);
  const selectedLanguage = String(selectedTranslation?.language || '').toLowerCase();
  const storedLanguage = String(value.translationLanguage || '').toLowerCase();
  const translationLanguage = selectedLanguage === 'en' || selectedLanguage === 'ur'
    ? selectedLanguage
    : (storedLanguage === 'en' ? 'en' : 'ur');

  return {
    fontScale: 1,
    theme: value.theme === 'dark' || value.theme === 'light'
      ? value.theme
      : DEFAULT_SETTINGS.theme,
    translation,
    translationLanguage,
    reciter: typeof value.reciter === 'string' && value.reciter
      ? value.reciter
      : null,
    playbackRate: clampPlaybackRate(value.playbackRate),
    autoplay: Boolean(value.autoplay),
    haptics: true,
    wordByWordTranslation: Boolean(value.wordByWordTranslation),
    wordByWordLanguage: value.wordByWordLanguage === 'ur' ? 'ur' : 'en',
    followRecitation: true,
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
