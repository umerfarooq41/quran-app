import { create } from 'zustand';
import { VIEWS, normalizeView } from '../app/routes';
import { clampPage } from '../lib/quran';

export const useAppStore = create((set) => ({
  view: VIEWS.HOME,
  navDirection: 'forward',
  page: 1,
  selectedSurah: 1,
  controlsVisible: false,
  selectedLine: null,
  selectedAyah: null,
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
  setView: (view, navDirection = 'forward') => set({ view: normalizeView(view), navDirection, controlsVisible: false }),
  goPage: (page, pendingAyah = null) => set({
    page: clampPage(page),
    pendingAyah,
    view: VIEWS.READER,
    navDirection: 'forward',
    controlsVisible: false,
  }),
  setSelectedSurah: (selectedSurah) => set({ selectedSurah: Number(selectedSurah) || 1, view: VIEWS.SURAH, navDirection: 'forward', controlsVisible: false }),
  openSurahInfo: (selectedSurah) => set({ selectedSurah: Number(selectedSurah) || 1, view: VIEWS.SURAH_INFO, navDirection: 'forward', controlsVisible: false }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  setSelectedLine: (selectedLine) => set({ selectedLine }),
  setSelectedAyah: (selectedAyah) => set({ selectedAyah }),
  clearSelectedAyah: () => set({ selectedAyah: null }),
  setAudioTarget: (audioTarget) => set({ audioTarget }),
  setTafsirTarget: (tafsirTarget) => set({ tafsirTarget, view: VIEWS.TAFSIR, navDirection: 'modal', controlsVisible: false }),
  goAyah: (surahNumber, ayahNumber, page) => set({
    page: clampPage(page),
    pendingAyah: { surahNumber: Number(surahNumber), ayahNumber: Number(ayahNumber) },
    view: VIEWS.READER,
    navDirection: 'forward',
    controlsVisible: false,
  }),
  clearPendingAyah: () => set({ pendingAyah: null }),
  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
}));