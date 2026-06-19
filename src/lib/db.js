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

export async function getRecentSearches(limit = 10) {
  return db.recentSearches
    .orderBy('createdAt')
    .reverse()
    .limit(Math.max(1, Number(limit) || 10))
    .toArray();
}

export async function clearRecentSearches() {
  await db.recentSearches.clear();
}

export async function saveRecentSearch(query) {
  const cleanQuery = String(query || '').trim().replace(/\s+/g, ' ');
  if (!cleanQuery) return getRecentSearches();

  const searchKey = cleanQuery.normalize('NFKC').toLocaleLowerCase();

  return db.transaction('rw', db.recentSearches, async () => {
    const rows = await db.recentSearches.toArray();
    const matches = rows.filter((row) => (
      String(row.query || '')
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFKC')
        .toLocaleLowerCase() === searchKey
    ));
    const [existing, ...duplicates] = matches;
    const createdAt = Date.now();

    if (existing?.id) {
      await db.recentSearches.put({
        ...existing,
        query: cleanQuery,
        createdAt,
      });
    } else {
      await db.recentSearches.add({ query: cleanQuery, createdAt });
    }

    if (duplicates.length) {
      await db.recentSearches.bulkDelete(duplicates.map((row) => row.id));
    }

    const newest = await db.recentSearches
      .orderBy('createdAt')
      .reverse()
      .toArray();
    const staleIds = newest.slice(10).map((row) => row.id);

    if (staleIds.length) {
      await db.recentSearches.bulkDelete(staleIds);
    }

    return db.recentSearches
      .orderBy('createdAt')
      .reverse()
      .limit(10)
      .toArray();
  });
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

export async function removeAyahBookmark(id) {
  return db.transaction('rw', db.bookmarks, db.notes, async () => {
    const bookmark = await db.bookmarks.get(id);
    if (!bookmark) return null;

    await db.bookmarks.delete(id);

    if (bookmark.category === 'Notes') {
      const noteRows = await db.notes
        .where('surahNumber')
        .equals(Number(bookmark.surahNumber))
        .and((item) => item.ayahNumber === Number(bookmark.ayahNumber))
        .toArray();

      if (noteRows.length) {
        await db.notes.bulkDelete(noteRows.map((item) => item.id));
      }
    }

    return bookmark;
  });
}

export async function changeAyahBookmarkType(id, category) {
  const nextCategory = category || 'Reading';

  return db.transaction('rw', db.bookmarks, db.notes, async () => {
    const bookmark = await db.bookmarks.get(id);
    if (!bookmark || bookmark.category === nextCategory) return bookmark || null;

    const duplicate = await db.bookmarks
      .where('surahNumber')
      .equals(Number(bookmark.surahNumber))
      .and((item) =>
        item.id !== bookmark.id &&
        item.ayahNumber === Number(bookmark.ayahNumber) &&
        item.category === nextCategory)
      .first();

    let updatedBookmark;

    if (duplicate) {
      updatedBookmark = {
        ...duplicate,
        page: bookmark.page || duplicate.page,
        preview: bookmark.preview || duplicate.preview,
        note: bookmark.note || duplicate.note || '',
        updatedAt: Date.now(),
      };
      await db.bookmarks.put(updatedBookmark);
      await db.bookmarks.delete(bookmark.id);
    } else {
      updatedBookmark = {
        ...bookmark,
        category: nextCategory,
        updatedAt: Date.now(),
      };
      await db.bookmarks.put(updatedBookmark);
    }

    const noteRows = await db.notes
      .where('surahNumber')
      .equals(Number(bookmark.surahNumber))
      .and((item) => item.ayahNumber === Number(bookmark.ayahNumber))
      .toArray();

    if (bookmark.category === 'Notes' && nextCategory !== 'Notes' && noteRows.length) {
      await db.notes.bulkDelete(noteRows.map((item) => item.id));
    }

    if (nextCategory === 'Notes') {
      const existingNote = noteRows[0];
      await db.notes.put({
        ...existingNote,
        ...(existingNote?.id ? { id: existingNote.id } : {}),
        surahNumber: Number(bookmark.surahNumber),
        ayahNumber: Number(bookmark.ayahNumber),
        page: bookmark.page,
        text: updatedBookmark.note || '',
        createdAt: existingNote?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }

    return updatedBookmark;
  });
}

export async function removeAyahHighlight(surahNumber, ayahNumber) {
  const matches = await db.highlights
    .where('surahNumber')
    .equals(Number(surahNumber))
    .and((item) => item.ayahNumber === Number(ayahNumber))
    .toArray();

  if (matches.length) {
    await db.highlights.bulkDelete(matches.map((item) => item.id));
  }

  return matches.length;
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
