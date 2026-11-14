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

db.version(2).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
  wordTranslations: '&key, language, surahNumber, ayahNumber, fetchedAt, expiresAt',
});

db.version(3).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
  wordTranslations: '&key, language, surahNumber, ayahNumber, fetchedAt, expiresAt',
  contentSyncRows: '&key, [resourceGroup+resourceId], [resourceGroup+resourceId+recordType], recordKey',
  contentSyncState: '&id, lastSuccessfulSyncAt',
});


db.version(4).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
  wordTranslations: '&key, language, surahNumber, ayahNumber, fetchedAt, expiresAt',
  contentSyncRows: '&key, [resourceGroup+resourceId], [resourceGroup+resourceId+recordType], [resourceGroup+resourceId+recordType+verseKey], recordKey',
  contentSyncState: '&id, lastSuccessfulSyncAt',
}).upgrade(async (transaction) => {
  // Rebuild Content Sync checkpoints so older cache rows are refreshed from
  // authoritative snapshots with the stable record-key format.
  await transaction.table('contentSyncState').clear();
  await transaction.table('contentSyncRows').toCollection().modify((row) => {
    row.verseKey = String(row.data?.verse_key || row.data?.group_verse_key_from || '');
  });
});


db.version(5).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
  wordTranslations: '&key, language, surahNumber, ayahNumber, fetchedAt, expiresAt',
  contentSyncRows: '&key, [resourceGroup+resourceId], [resourceGroup+resourceId+recordType], [resourceGroup+resourceId+recordType+verseKey], recordKey',
  contentSyncState: '&id, lastSuccessfulSyncAt',
  tadabburLessons: '&id, surahNumber, startAyah, endAyah, status, createdAt, updatedAt',
});


// Normalize legacy Reflect/Tadabbur bookmark categories without dropping saved
// bookmarks. Keep the oldest record when both labels exist for the same ayah.
db.version(6).stores({
  bookmarks: '++id, category, surahNumber, ayahNumber, page, createdAt',
  highlights: '++id, color, surahNumber, ayahNumber, page, createdAt',
  notes: '++id, surahNumber, ayahNumber, page, updatedAt',
  lastRead: 'id, page, surahNumber, ayahNumber, updatedAt',
  settings: 'id',
  recentSearches: '++id, query, createdAt',
  memorizationProgress: '++id, surahNumber, ayahNumber, status, updatedAt',
  wordTranslations: '&key, language, surahNumber, ayahNumber, fetchedAt, expiresAt',
  contentSyncRows: '&key, [resourceGroup+resourceId], [resourceGroup+resourceId+recordType], [resourceGroup+resourceId+recordType+verseKey], recordKey',
  contentSyncState: '&id, lastSuccessfulSyncAt',
  tadabburLessons: '&id, surahNumber, startAyah, endAyah, status, createdAt, updatedAt',
}).upgrade(async (tx) => {
  const table = tx.table('bookmarks');
  const rows = await table.toArray();
  const seen = new Map();
  for (const row of rows) {
    if (row.category !== 'Reflect' && row.category !== 'Tadabbur') continue;
    const key = String(row.surahNumber) + ':' + String(row.ayahNumber);
    const existing = seen.get(key);
    if (existing) {
      const merged = {
        ...existing,
        note: existing.note || row.note || '',
        preview: existing.preview || row.preview || '',
        updatedAt: Math.max(existing.updatedAt || 0, row.updatedAt || 0),
      };
      await table.put(merged);
      await table.delete(row.id);
    } else {
      const normalized = { ...row, category: 'Reflect' };
      await table.put(normalized);
      seen.set(key, normalized);
    }
  }
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
  const lineIndex = Number.isInteger(payload.lineIndex)
    ? payload.lineIndex
    : null;
  const wordIndex = Number.isInteger(payload.wordIndex)
    ? payload.wordIndex
    : null;
  const matches = await db.highlights
    .where('surahNumber')
    .equals(surahNumber)
    .and((item) => item.ayahNumber === ayahNumber)
    .toArray();
  const [existing, ...duplicates] = matches;
  const record = {
    ...existing,
    ...payload,
    page: Number(payload.page) || existing?.page || null,
    surah: surahNumber,
    ayah: ayahNumber,
    surahNumber,
    ayahNumber,
    lineIndex,
    wordIndex,
    ayahKey: payload.ayahKey || `${surahNumber}:${ayahNumber}`,
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
  const category = payload.category === 'Tadabbur' ? 'Reflect' : (payload.category || 'Reading');

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
  const nextCategory = category === 'Tadabbur' ? 'Reflect' : (category || 'Reading');

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


export async function saveTadabburLesson(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('A Tadabbur lesson is required.');
  }

  const id = String(payload.id || createLocalLessonId());
  const existing = await db.tadabburLessons.get(id);
  const now = Date.now();
  const record = {
    ...existing,
    ...payload,
    id,
    createdAt: existing?.createdAt || payload.createdAt || now,
    updatedAt: now,
  };

  await db.tadabburLessons.put(record);
  return record;
}

export async function getTadabburLesson(id) {
  return db.tadabburLessons.get(String(id));
}

export async function getTadabburLessons() {
  return db.tadabburLessons.orderBy('updatedAt').reverse().toArray();
}

export async function updateTadabburLesson(id, patch) {
  const lessonId = String(id || '');
  if (!lessonId || !patch || typeof patch !== 'object') return null;

  return db.transaction('rw', db.tadabburLessons, async () => {
    const existing = await db.tadabburLessons.get(lessonId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...patch,
      id: lessonId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    await db.tadabburLessons.put(updated);
    return updated;
  });
}

/**
 * Persist a single Reflect answer field without overwriting other fields.
 * The read/modify/write is serialized by Dexie's transaction.
 */
export async function saveReflectAnswerField(id, group, index, value) {
  const lessonId = String(id || '');
  if (!lessonId || !['prepare', 'final', 'notes', 'tadabbur'].includes(group)) {
    throw new Error('Invalid Reflect answer field.');
  }
  if (group !== 'notes' && group !== 'tadabbur' && (!Number.isInteger(index) || index < 0)) {
    throw new Error('Invalid Reflect question index.');
  }
  return db.transaction('rw', db.tadabburLessons, async () => {
    const existing = await db.tadabburLessons.get(lessonId);
    if (!existing) throw new Error('Reflect study not found.');
    const answers = { ...(existing.answers || {}) };
    if (group === 'notes') {
      answers.notes = String(value ?? '');
    } else if (group === 'tadabbur') {
      const allowed = ['imagine', 'dua', 'evaluate', 'commitment', 'startWhen', 'plan'];
      if (!allowed.includes(index)) throw new Error('Invalid reflection field.');
      answers.tadabbur = { ...(answers.tadabbur || {}), [index]: String(value ?? '') };
    } else {
      const entries = [...(Array.isArray(answers[group]) ? answers[group] : [])];
      entries[index] = String(value ?? '');
      answers[group] = entries;
    }
    const updated = { ...existing, answers, updatedAt: Date.now() };
    await db.tadabburLessons.put(updated);
    return updated;
  });
}

export async function saveReflectKeywords(id, keywords) {
  if (!Array.isArray(keywords)) throw new Error('Invalid keywords.');
  return db.transaction('rw', db.tadabburLessons, async () => {
    const existing = await db.tadabburLessons.get(String(id));
    if (!existing) throw new Error('Reflect study not found.');
    const updated = {
      ...existing,
      keywords: keywords.map((word) => ({
        key: String(word.key),
        ayahNumber: Number(word.ayahNumber),
        arabic: String(word.arabic || ''),
        meaning: String(word.meaning || ''),
        ...(word.language === 'ur' || word.language === 'en' ? { language: word.language } : {}),
        ...(word.location ? { location: String(word.location) } : {}),
      })),
      updatedAt: Date.now(),
    };
    await db.tadabburLessons.put(updated);
    return updated;
  });
}

export async function deleteTadabburLesson(id) {
  return db.tadabburLessons.delete(String(id));
}

function createLocalLessonId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `tadabbur-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
