import Dexie from 'dexie';

export const db = new Dexie('quranFluentLocal');

db.version(1).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
});

export async function saveLastRead(payload) {
  await db.lastRead.put({ id: 'current', updatedAt: Date.now(), ...payload });
}

export async function getLastRead() {
  return db.lastRead.get('current');
}

export async function upsertSetting(id, value) {
  await db.settings.put({ id, value, updatedAt: Date.now() });
}

export async function getSettings() {
  const rows = await db.settings.toArray();
  return Object.fromEntries(rows.map((row) => [row.id, row.value]));
}
