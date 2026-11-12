import { db } from './db';

/**
 * Portable, user-owned backup. Cached Quran content and audio are deliberately
 * excluded: they can be fetched again and would make the backup much larger.
 */
export const BACKUP_FORMAT = 'quran-app-personal-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_TABLES = Object.freeze([
  'bookmarks',
  'highlights',
  'notes',
  'lastRead',
  'settings',
  'recentSearches',
  'memorizationProgress',
  'tadabburLessons',
]);
const FAVORITES_KEY = 'quran-app-favorite-surahs';
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_TABLE_ROWS = 100000;
const INTEGER_ID_TABLES = new Set([
  'bookmarks', 'highlights', 'notes', 'recentSearches', 'memorizationProgress',
]);
const STRING_ID_TABLES = new Set(['lastRead', 'settings', 'tadabburLessons']);

function validRow(table, row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  if (INTEGER_ID_TABLES.has(table)) {
    return Number.isSafeInteger(row.id) && row.id > 0;
  }
  if (STRING_ID_TABLES.has(table)) {
    return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 256;
  }
  return false;
}

function normalizeFavorites(input) {
  if (!Array.isArray(input)) throw new Error('Invalid favorite Surahs in backup.');
  if (input.length > 114) throw new Error('Invalid favorite Surahs in backup.');
  if (!input.every(n => Number.isInteger(n) && n >= 1 && n <= 114)) {
    throw new Error('Invalid favorite Surahs in backup.');
  }
  return [...new Set(input)];
}

export async function createPersonalBackup() {
  const tables = await db.transaction('r', ...BACKUP_TABLES.map(name => db.table(name)), async () => {
    const entries = await Promise.all(BACKUP_TABLES.map(async name => [name, await db.table(name).toArray()]));
    return Object.fromEntries(entries);
  });
  let favorites = [];
  try {
    favorites = normalizeFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
  } catch {
    // A damaged favorites preference must not block safeguarding the Dexie data.
  }
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    favorites,
  };
  const json = JSON.stringify(backup, null, 2);
  if (new Blob([json]).size > MAX_BACKUP_BYTES) {
    throw new Error('Backup exceeds 25 MB. Please contact support before restoring or clearing any data.');
  }
  return json;
}

export function inspectPersonalBackup(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_BACKUP_BYTES) {
    throw new Error('Backup must be a JSON file smaller than 25 MB.');
  }
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON backup.');
  }
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup file or version. No data was changed.');
  }
  if (!backup.tables || typeof backup.tables !== 'object' || Array.isArray(backup.tables)) {
    throw new Error('The backup has no valid data tables.');
  }
  if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) {
    throw new Error('The backup date is invalid.');
  }
  if (Object.keys(backup.tables).length !== BACKUP_TABLES.length ||
      Object.keys(backup.tables).some(name => !BACKUP_TABLES.includes(name))) {
    throw new Error('The backup does not match this version of the app.');
  }

  const counts = {};
  for (const name of BACKUP_TABLES) {
    const rows = backup.tables[name];
    if (!Array.isArray(rows) || rows.length > MAX_TABLE_ROWS ||
        !rows.every(row => validRow(name, row))) {
      throw new Error('The backup contains invalid ' + name + ' records.');
    }
    const ids = new Set(rows.map(row => row.id));
    if (ids.size !== rows.length) {
      throw new Error('The backup has duplicate ' + name + ' records.');
    }
    counts[name] = rows.length;
  }
  const favorites = normalizeFavorites(backup.favorites);
  return { backup, counts, favorites, exportedAt: backup.exportedAt };
}

export async function restorePersonalBackup(inspection) {
  // Re-validate immediately before the destructive operation.
  const normalized = inspectPersonalBackup(JSON.stringify(inspection?.backup));
  const { backup, favorites } = normalized;
  await db.transaction('rw', ...BACKUP_TABLES.map(name => db.table(name)), async () => {
    for (const name of BACKUP_TABLES) {
      const table = db.table(name);
      await table.clear();
      if (backup.tables[name].length) await table.bulkPut(backup.tables[name]);
    }
  });
  // Favorites live outside Dexie and must be restored after the atomic commit.
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  // Do not leave the pre-restore theme preference overriding the restored DB.
  const appSettings = backup.tables.settings.find(row => row.id === 'app')?.value;
  if (appSettings && ['auto', 'light', 'dark'].includes(appSettings.theme)) {
    localStorage.setItem('quran-app-theme', appSettings.theme);
  } else {
    localStorage.removeItem('quran-app-theme');
  }
}

export function downloadPersonalBackup(json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'quran-app-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
