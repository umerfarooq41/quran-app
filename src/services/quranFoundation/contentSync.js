import { db } from '../../lib/db';
import { qfGet } from './client';

const API_PREFIX = '/api/v4/';
const PAGE_SIZE = 100;
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeResourceFilter(resources) {
  const groups = Object.entries(resources || {})
    .map(([group, ids]) => {
      const normalizedIds = [...new Set((Array.isArray(ids) ? ids : [ids])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0))]
        .sort((a, b) => a - b);
      return normalizedIds.length ? [group, normalizedIds] : null;
    })
    .filter(Boolean)
    .sort(([left], [right]) => left.localeCompare(right));

  if (!groups.length) throw new Error('No Quran Foundation resources were selected for Content Sync.');
  return groups.map(([group, ids]) => `${group}:${ids.join(',')}`).join(';');
}

function parseApiPath(relativePath) {
  const parsed = new URL(String(relativePath || ''), 'https://qf-content-sync.invalid');
  if (!parsed.pathname.startsWith(API_PREFIX)) {
    throw new Error('Quran Foundation returned an unsupported Content Sync URL.');
  }

  const path = parsed.pathname.slice(API_PREFIX.length);
  const params = {};
  parsed.searchParams.forEach((value, key) => {
    if (params[key] === undefined) params[key] = value;
    else if (Array.isArray(params[key])) params[key].push(value);
    else params[key] = [params[key], value];
  });
  return { path, params };
}

async function getApiPath(relativePath, signal) {
  const { path, params } = parseApiPath(relativePath);
  return qfGet(path, params, { signal });
}

function getMutations(payload) {
  if (Array.isArray(payload?.mutations)) return payload.mutations;
  if (Array.isArray(payload?.sync?.mutations)) return payload.sync.mutations;
  return [];
}

function getSnapshotRecords(payload) {
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.snapshot?.records)) return payload.snapshot.records;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  return [];
}

function getRecordKey(record) {
  const value = record?.record_key
    ?? record?.verse_key
    ?? record?.word_key
    ?? record?.key
    ?? record?.id;
  return value == null ? '' : String(value);
}

function makeRowKey(group, resourceId, recordType, recordKey) {
  return [group, resourceId, recordType, recordKey].join(':');
}

async function replaceResourceSnapshot(group, resourceId, snapshot, fetchedAt) {
  const records = getSnapshotRecords(snapshot);
  const rows = records.map((record) => {
    const recordType = String(record?.record_type || record?.type || '');
    const recordKey = getRecordKey(record);
    if (!recordType || !recordKey) return null;
    return {
      key: makeRowKey(group, resourceId, recordType, recordKey),
      resourceGroup: group,
      resourceId: Number(resourceId),
      recordType,
      recordKey,
      data: record,
      updatedAt: fetchedAt,
    };
  }).filter(Boolean);

  await db.transaction('rw', db.contentSyncRows, async () => {
    await db.contentSyncRows
      .where('[resourceGroup+resourceId]')
      .equals([group, Number(resourceId)])
      .delete();
    if (rows.length) await db.contentSyncRows.bulkPut(rows);
  });

  return rows.length;
}

async function applyMutation(mutation, signal) {
  const type = String(mutation?.type || '').toUpperCase();
  const group = String(mutation?.resource_group || '');
  const resourceId = Number(mutation?.resource_id);
  if (!group || !Number.isInteger(resourceId) || resourceId < 1) return;

  if (type === 'RESOURCE_CREATE' || type === 'RESOURCE_INVALIDATE') {
    if (!mutation.snapshot_url) {
      throw new Error(`Content Sync ${type} did not include a snapshot URL.`);
    }
    const snapshot = await getApiPath(mutation.snapshot_url, signal);
    await replaceResourceSnapshot(group, resourceId, snapshot, Date.now());
    return;
  }

  if (type === 'RESOURCE_DELETE') {
    await db.contentSyncRows
      .where('[resourceGroup+resourceId]')
      .equals([group, resourceId])
      .delete();
    return;
  }

  if (type === 'RESOURCE_UPDATE') return;

  if (type === 'ROW_CREATE' || type === 'ROW_UPDATE' || type === 'ROW_DELETE') {
    const recordType = String(mutation?.record_type || mutation?.data?.record_type || '');
    const recordKey = String(mutation?.record_key ?? getRecordKey(mutation?.data));
    if (!recordType || !recordKey) {
      throw new Error(`Content Sync ${type} did not include a record identity.`);
    }

    const key = makeRowKey(group, resourceId, recordType, recordKey);
    if (type === 'ROW_DELETE') {
      await db.contentSyncRows.delete(key);
      return;
    }

    if (!mutation.data || typeof mutation.data !== 'object') {
      throw new Error(`Content Sync ${type} did not include row data.`);
    }

    await db.contentSyncRows.put({
      key,
      resourceGroup: group,
      resourceId,
      recordType,
      recordKey,
      data: mutation.data,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Sync only explicitly selected public resources. Ordinary Content API reads
 * are never written into this store: rows enter through Content Sync snapshots
 * and mutation events only.
 */
const inFlightSyncs = new Map();

export function syncContentResources(resources, options = {}) {
  const resourceFilter = normalizeResourceFilter(resources);
  if (inFlightSyncs.has(resourceFilter)) return inFlightSyncs.get(resourceFilter);

  const request = performContentSync(resourceFilter, options)
    .finally(() => inFlightSyncs.delete(resourceFilter));
  inFlightSyncs.set(resourceFilter, request);
  return request;
}

async function performContentSync(resourceFilter, options = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline', synced: false };
  }

  const stateId = resourceFilter;
  const previousState = await db.contentSyncState.get(stateId);
  const now = Date.now();
  const due = !previousState?.lastSuccessfulSyncAt
    || now - previousState.lastSuccessfulSyncAt >= SYNC_INTERVAL_MS;
  const force = Boolean(options.force);
  if (!force && !due) {
    return {
      status: 'fresh',
      synced: false,
      lastSuccessfulSyncAt: previousState.lastSuccessfulSyncAt,
      resourceFilter,
    };
  }

  const signal = options.signal;
  let page;
  if (previousState?.syncToken && !options.bootstrap) {
    try {
      page = await qfGet('resources/sync', {
        resources: resourceFilter,
        sync_token: previousState.syncToken,
        per_page: PAGE_SIZE,
      }, { signal });
    } catch (error) {
      // A 410 means the server can no longer continue from this checkpoint.
      // Rebuild the selected resources from snapshots without deleting user data.
      if (!/\\b410\\b/.test(String(error?.message || error))) throw error;
      page = await qfGet('resources/sync', {
        resources: resourceFilter,
        bootstrap: true,
        per_page: PAGE_SIZE,
      }, { signal });
    }
  } else {
    page = await qfGet('resources/sync', {
      resources: resourceFilter,
      bootstrap: true,
      per_page: PAGE_SIZE,
    }, { signal });
  }

  let finalToken = null;
  let pageCount = 0;
  let appliedMutations = 0;

  while (page) {
    pageCount += 1;
    if (pageCount > 500) throw new Error('Content Sync exceeded the safety page limit.');

    const mutations = getMutations(page).slice().sort((a, b) => (
      Number(a?.sequence || 0) - Number(b?.sequence || 0)
    ));

    for (const mutation of mutations) {
      await applyMutation(mutation, signal);
      appliedMutations += 1;
    }

    if (page?.has_more) {
      if (!page?.next_page_url) {
        throw new Error('Content Sync indicated more pages but did not provide a cursor.');
      }
      page = await getApiPath(page.next_page_url, signal);
      continue;
    }

    finalToken = page?.next_sync_token || page?.sync?.next_sync_token || null;
    break;
  }

  if (!finalToken) {
    throw new Error('Content Sync did not return a final checkpoint; the previous checkpoint was kept.');
  }

  await db.contentSyncState.put({
    id: stateId,
    resourceFilter,
    syncToken: finalToken,
    lastSuccessfulSyncAt: now,
    lastMutationCount: appliedMutations,
  });

  return {
    status: 'synced',
    synced: true,
    resourceFilter,
    pageCount,
    appliedMutations,
    lastSuccessfulSyncAt: now,
  };
}

export async function getSyncedResourceRows(group, resourceId, recordType) {
  let query = db.contentSyncRows
    .where('[resourceGroup+resourceId]')
    .equals([String(group), Number(resourceId)]);

  if (recordType) {
    query = db.contentSyncRows
      .where('[resourceGroup+resourceId+recordType]')
      .equals([String(group), Number(resourceId), String(recordType)]);
  }

  return query.toArray();
}

export async function getSyncedResourceRow(group, resourceId, recordType, recordKey) {
  const key = makeRowKey(
    String(group),
    Number(resourceId),
    String(recordType),
    String(recordKey),
  );
  return db.contentSyncRows.get(key);
}

export async function getContentSyncStatus(resources) {
  const resourceFilter = normalizeResourceFilter(resources);
  const state = await db.contentSyncState.get(resourceFilter);
  return {
    lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt || null,
    resourceFilter,
    isDue: !state?.lastSuccessfulSyncAt
      || Date.now() - state.lastSuccessfulSyncAt >= SYNC_INTERVAL_MS,
  };
}
