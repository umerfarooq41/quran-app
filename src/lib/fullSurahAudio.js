export const FULL_SURAH_FOLDER_BY_RECITER = Object.freeze({
  'abdul-basit-abdul-samad': 'abdul-basit-abdul-samad',
  'abdullah-awad-al-juhani': 'abdullah-awad-al-juhani',
  'abdur-rahman-as-sudais': 'abdur-rahman-as-sudais',
  'abu-bakr-al-shatri': 'abu-bakr-al-shatri',
  'maher-al-mu-aiqly': 'maher-al-mu-aiqly',
  'mahmoud-khalil-al-husary': 'mahmoud-khalil-al-husary',
  'mishari-rashid-al-afasy': 'mishari-rashid-al-afasy',
  'saad-al-ghamdi': 'saad-al-ghamdi',
  'saud-al-shuraim': 'saud-al-shuraim',
  'yasser-al-dosari': 'yasser-al-dosari',
});

const reciterDataCache = new Map();

export function getFullSurahFolder(reciterId) {
  return FULL_SURAH_FOLDER_BY_RECITER[reciterId] || '';
}

export function hasFullSurahAudio(reciterId) {
  return Boolean(getFullSurahFolder(reciterId));
}

export async function loadFullSurahReciterData(reciterId, fetchImpl = globalThis.fetch) {
  const folder = getFullSurahFolder(reciterId);
  if (!folder) return null;

  if (reciterDataCache.has(reciterId)) {
    return reciterDataCache.get(reciterId);
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Audio metadata cannot be loaded in this environment.');
  }

  const baseUrl = `/data/audio/full/${encodeURIComponent(folder)}`;
  const loadingPromise = Promise.all([
    fetchJson(`${baseUrl}/surah.json`, fetchImpl),
    fetchJson(`${baseUrl}/segments.json`, fetchImpl),
  ]).then(([surahs, segments]) => ({
    reciterId,
    folder,
    surahs,
    segments,
    timelines: new Map(),
  }));

  reciterDataCache.set(reciterId, loadingPromise);

  try {
    return await loadingPromise;
  } catch (error) {
    if (reciterDataCache.get(reciterId) === loadingPromise) {
      reciterDataCache.delete(reciterId);
    }
    throw error;
  }
}

export async function getFullSurahPlayback(reciterId, surahNumber, fetchImpl = globalThis.fetch) {
  const surah = normalizePositiveInteger(surahNumber);
  if (!surah || surah > 114) return null;

  const reciterData = await loadFullSurahReciterData(reciterId, fetchImpl);
  if (!reciterData) return null;

  const rawSurah = reciterData.surahs?.[String(surah)];
  const audioUrl = typeof rawSurah?.audio_url === 'string'
    ? rawSurah.audio_url.trim()
    : '';
  if (!audioUrl) return null;

  let timeline = reciterData.timelines.get(surah);
  if (!timeline) {
    timeline = buildSurahTimeline(reciterData.segments, surah);
    reciterData.timelines.set(surah, timeline);
  }
  if (!timeline.length) return null;

  return {
    reciterId,
    folder: reciterData.folder,
    surahNumber: surah,
    audioUrl,
    timeline,
  };
}

export function buildSurahTimeline(segmentsByVerse, surahNumber) {
  const surah = normalizePositiveInteger(surahNumber);
  if (!surah || !isPlainObject(segmentsByVerse)) return [];

  const timeline = [];

  Object.entries(segmentsByVerse).forEach(([verseKey, timing]) => {
    const parsed = parseVerseKey(verseKey);
    if (!parsed || parsed.surahNumber !== surah || !isPlainObject(timing)) return;

    const startMs = Number(timing.timestamp_from);
    const endMs = Number(timing.timestamp_to);
    if (
      !Number.isFinite(startMs)
      || !Number.isFinite(endMs)
      || startMs < 0
      || endMs <= startMs
    ) {
      return;
    }

    const occurrenceCounts = new Map();
    const wordSegments = (Array.isArray(timing.segments) ? timing.segments : [])
      .map(normalizeWordSegment)
      .filter(Boolean)
      .sort((first, second) => (
        first.startMs - second.startMs
        || first.endMs - second.endMs
        || first.sourceIndex - second.sourceIndex
      ))
      .map(({ sourceIndex, ...segment }) => {
        const occurrenceIndex = occurrenceCounts.get(segment.position) || 0;
        occurrenceCounts.set(segment.position, occurrenceIndex + 1);
        return { ...segment, occurrenceIndex };
      });

    timeline.push({
      verseKey: `${parsed.surahNumber}:${parsed.ayahNumber}`,
      surahNumber: parsed.surahNumber,
      ayahNumber: parsed.ayahNumber,
      startMs,
      endMs,
      wordSegments,
    });
  });

  return timeline.sort((first, second) => (
    first.startMs - second.startMs
    || first.ayahNumber - second.ayahNumber
  ));
}

export function findAyahTiming(timeline, ayahNumber) {
  const ayah = normalizePositiveInteger(ayahNumber);
  if (!ayah || !Array.isArray(timeline)) return null;
  return timeline.find((entry) => entry.ayahNumber === ayah) || null;
}

export function findAyahAtTime(timeline, timeMs) {
  const time = Number(timeMs);
  if (!Array.isArray(timeline) || !timeline.length || !Number.isFinite(time)) return null;
  if (time <= timeline[0].startMs) return timeline[0];

  let low = 0;
  let high = timeline.length - 1;
  let match = timeline[0];

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = timeline[middle];
    if (candidate.startMs <= time) {
      match = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return match;
}


export function findWordAtTime(ayahTiming, timeMs) {
  const time = Number(timeMs);
  const wordSegments = ayahTiming?.wordSegments;
  if (!Array.isArray(wordSegments) || !wordSegments.length || !Number.isFinite(time)) {
    return null;
  }

  // Word segments are already chronological. Restrict the lookup to the
  // active ayah so repeated positions remain distinct and cheap to search.
  for (let index = 0; index < wordSegments.length; index += 1) {
    const segment = wordSegments[index];
    if (time < segment.startMs) return null;
    if (time >= segment.startMs && time < segment.endMs) return segment;
  }

  return null;
}

export function clearFullSurahAudioCache() {
  reciterDataCache.clear();
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response?.ok) {
    throw new Error(`Full-Surah audio data is unavailable (${response?.status || 'network error'}).`);
  }

  const data = await response.json();
  if (!isPlainObject(data)) {
    throw new Error('Full-Surah audio data is malformed.');
  }
  return data;
}

function parseVerseKey(verseKey) {
  const match = /^(\d+):(\d+)$/.exec(String(verseKey));
  if (!match) return null;

  const surahNumber = normalizePositiveInteger(match[1]);
  const ayahNumber = normalizePositiveInteger(match[2]);
  if (!surahNumber || !ayahNumber) return null;
  return { surahNumber, ayahNumber };
}

function normalizeWordSegment(segment, sourceIndex) {
  if (!Array.isArray(segment) || segment.length < 3) return null;

  const position = Number(segment[0]);
  const startMs = Number(segment[1]);
  const endMs = Number(segment[2]);
  if (
    !Number.isInteger(position)
    || position < 1
    || !Number.isFinite(startMs)
    || !Number.isFinite(endMs)
    || startMs < 0
    || endMs <= startMs
  ) {
    return null;
  }

  return {
    position,
    startMs,
    endMs,
    sourceIndex,
  };
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
