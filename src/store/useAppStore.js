import { create } from 'zustand';
import { VIEWS, normalizeView } from '../app/routes';
import { clampPage } from '../lib/quran';
import { DEFAULT_TRANSLATION_ID, TRANSLATION_OPTIONS } from '../lib/translations';

export const DEFAULT_SETTINGS = Object.freeze({
  fontScale: 1,
  theme: getInitialTheme(),
  translation: DEFAULT_TRANSLATION_ID,
  reciter: null,
  playbackRate: 1,
  autoplay: false,
  haptics: true,
});

export const useAppStore = create((set) => ({
  view: VIEWS.HOME,
  navDirection: 'forward',
  surahInfoReturnView: VIEWS.INDEX,
  page: 1,
  previousReaderPage: null,
  selectedSurah: 1,
  controlsVisible: false,
  selectedLine: null,
  selectedAyah: null,
  audioTarget: null,
  tafsirTarget: null,
  pendingAyah: null,
  settings: { ...DEFAULT_SETTINGS },
  setView: (view, navDirection = 'forward') => set({ view: normalizeView(view), navDirection, controlsVisible: false }),
  goPage: (page, pendingAyah = null) => set((state) => {
    const nextPage = clampPage(page);
    return {
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah,
      view: VIEWS.READER,
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
  setSelectedSurah: (selectedSurah) => set({ selectedSurah: Number(selectedSurah) || 1, view: VIEWS.SURAH, navDirection: 'forward', controlsVisible: false }),
  openSurahInfo: (selectedSurah) => set((state) => ({
    selectedSurah: Number(selectedSurah) || 1,
    surahInfoReturnView: state.view === VIEWS.SURAH_INFO
      ? state.surahInfoReturnView
      : state.view,
    view: VIEWS.SURAH_INFO,
    navDirection: 'forward',
    controlsVisible: false,
  })),
  closeSurahInfo: () => set((state) => ({
    view: normalizeView(state.surahInfoReturnView || VIEWS.INDEX),
    navDirection: 'back',
    controlsVisible: false,
  })),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  setSelectedLine: (selectedLine) => set({ selectedLine }),
  setSelectedAyah: (selectedAyah) => set({ selectedAyah }),
  clearSelectedAyah: () => set({ selectedAyah: null }),
  setAudioTarget: (audioTarget) => set({ audioTarget }),
  setTafsirTarget: (tafsirTarget) => set({ tafsirTarget, view: VIEWS.TAFSIR, navDirection: 'modal', controlsVisible: false }),
  goAyah: (surahNumber, ayahNumber, page) => set((state) => {
    const nextPage = clampPage(page);
    return {
      page: nextPage,
      previousReaderPage: nextPage === state.page ? state.previousReaderPage : state.page,
      pendingAyah: { surahNumber: Number(surahNumber), ayahNumber: Number(ayahNumber) },
      view: VIEWS.READER,
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
