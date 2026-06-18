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

export async function saveAyahHighlight(payload) {
  const surahNumber = Number(payload.surahNumber);
  const ayahNumber = Number(payload.ayahNumber);
  const matches = await db.highlights
    .where('surahNumber')
    .equals(surahNumber)
    .and((item) => item.ayahNumber === ayahNumber)
    .toArray();
  const [existing, ...duplicates] = matches;
  const record = {
    ...existing,
    ...payload,
    surahNumber,
    ayahNumber,
    createdAt: existing?.createdAt || payload.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const id = existing?.id
    ? await db.highlights.put({ ...record, id: existing.id })
    : await db.highlights.add(record);

  if (duplicates.length) {
    await db.highlights.bulkDelete(duplicates.map((item) => item.id));
  }

  return { ...record, id };
}

export async function saveAyahBookmark(payload) {
  const surahNumber = Number(payload.surahNumber);
  const ayahNumber = Number(payload.ayahNumber);
  const category = payload.category || 'Reading';

  return db.transaction('rw', db.bookmarks, db.notes, async () => {
    const matches = await db.bookmarks
      .where('surahNumber')
      .equals(surahNumber)
      .and((item) => item.ayahNumber === ayahNumber && item.category === category)
      .toArray();
    const [existing, ...duplicates] = matches;
    const record = {
      ...existing,
      ...payload,
      surahNumber,
      ayahNumber,
      category,
      note: payload.note || '',
      createdAt: existing?.createdAt || payload.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const id = existing?.id
      ? await db.bookmarks.put({ ...record, id: existing.id })
      : await db.bookmarks.add(record);

    if (duplicates.length) {
      await db.bookmarks.bulkDelete(duplicates.map((item) => item.id));
    }

    if (category === 'Notes') {
      const existingNote = await db.notes
        .where('surahNumber')
        .equals(surahNumber)
        .and((item) => item.ayahNumber === ayahNumber)
        .first();

      await db.notes.put({
        ...existingNote,
        ...(existingNote?.id ? { id: existingNote.id } : {}),
        surahNumber,
        ayahNumber,
        page: payload.page,
        text: payload.note || '',
        createdAt: existingNote?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { ...record, id };
  });
}

export async function getAyahAnnotations(surahNumber, ayahNumber) {
  const safeSurah = Number(surahNumber);
  const safeAyah = Number(ayahNumber);
  const [highlight, bookmarks] = await Promise.all([
    db.highlights
      .where('surahNumber')
      .equals(safeSurah)
      .and((item) => item.ayahNumber === safeAyah)
      .first(),
    db.bookmarks
      .where('surahNumber')
      .equals(safeSurah)
      .and((item) => item.ayahNumber === safeAyah)
      .toArray(),
  ]);

  return { highlight, bookmarks };
}
