export const VIEWS = {
  HOME: 'home',
  READER: 'reader',
  INDEX: 'index',
  SURAH: 'surah',
  SURAH_INFO: 'surahInfo',
  SEARCH: 'search',
  TABS: 'tabs',
  TAFSIR: 'tafsir',
  SETTINGS: 'settings',
  SHARE_QURAN: 'shareQuran',
};

export const VALID_VIEWS = new Set(Object.values(VIEWS));

export function normalizeView(view) {
  if (view === 'bookmarks') return VIEWS.TABS;
  if (view === 'info') return VIEWS.SURAH_INFO;
  return VALID_VIEWS.has(view) ? view : VIEWS.HOME;
}
