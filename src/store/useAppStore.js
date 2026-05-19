import { create } from 'zustand';

const clampPage = (page) => Math.min(548, Math.max(1, Number(page) || 1));

export const useAppStore = create((set) => ({
  view: 'home',
  navDirection: 'forward',
  page: 1,
  selectedSurah: 1,
  controlsVisible: false,
  selectedLine: null,
  audioTarget: null,
  tafsirTarget: null,
  pendingAyah: null,
  settings: {
    fontScale: 1,
    theme: 'light',
    reciter: null,
    playbackRate: 1,
    autoplay: false,
  },
  setView: (view, navDirection = 'forward') => set({ view, navDirection, controlsVisible: false }),
  goPage: (page, pendingAyah = null) => set({
    page: clampPage(page),
    pendingAyah,
    view: 'reader',
    navDirection: 'forward',
    controlsVisible: false,
  }),
  setSelectedSurah: (selectedSurah) => set({ selectedSurah, view: 'surah', navDirection: 'forward', controlsVisible: false }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  setSelectedLine: (selectedLine) => set({ selectedLine }),
  setAudioTarget: (audioTarget) => set({ audioTarget }),
  setTafsirTarget: (tafsirTarget) => set({ tafsirTarget, view: 'tafsir', navDirection: 'modal', controlsVisible: false }),
  goAyah: (surahNumber, ayahNumber, page) => set({
    page: clampPage(page),
    pendingAyah: { surahNumber: Number(surahNumber), ayahNumber: Number(ayahNumber) },
    view: 'reader',
    navDirection: 'forward',
    controlsVisible: false,
  }),
  clearPendingAyah: () => set({ pendingAyah: null }),
  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
}));
