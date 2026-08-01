export const FULL_SURAH_FOLDER_BY_RECITER = Object.freeze({
  'abdul-basit-abdul-samad': 'abdul-basit-abdul-samad',
  'abdur-rahman-as-sudais': 'abdur-rahman-as-sudais',
  'abu-bakr-al-shatri': 'abu-bakr-al-shatri',
  'khalid-al-jalil': 'khalid-al-jalil',
  'maher-al-mu-aiqly': 'maher-al-mu-aiqly',
  'mahmoud-khalil-al-husary': 'mahmoud-khalil-al-husary',
  'mishari-rashid-al-afasy': 'mishari-rashid-al-afasy',
  'saad-al-ghamdi': 'saad-al-ghamdi',
  'saud-al-shuraim': 'saud-al-shuraim',
  'yasser-al-dosari': 'yasser-al-dosari',
});

const QF_CHAPTER_RECITER_BY_RECITER = Object.freeze({
  // Quran.com/Quran Foundation chapter-reciter ID.
  'ahmed-ibn-ali-al-ajmy': { id: 19 },
  // Resolve this ID from the live chapter-reciter catalog so the app does not
  // depend on generated local surah.json/segments.json files.
  'abdullah-awad-al-juhani': {
    aliases: [
      'abdullah awad al juhani',
      'abdullah awwad al juhany',
      'abdullaah 3awwaad al juhaynee',
      'abdullah awad al juhany',
    ],
  },
});

const qfPlaybackCache = new Map();
const qfResolvedReciterIdCache = new Map();
let qfChapterRecitersPromise = null;

// Store the Promise itself so resolved data remains in memory for the session
// and concurrent callers share the same fetch-and-parse operation.
const reciterDataCache = new Map();

export function getFullSurahFolder(reciterId) {
  return FULL_SURAH_FOLDER_BY_RECITER[reciterId] || '';
}

export function hasFullSurahAudio(reciterId) {
  return Boolean(
    getFullSurahFolder(reciterId)
    || QF_CHAPTER_RECITER_BY_RECITER[reciterId],
  );
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

  const qfReciterConfig = QF_CHAPTER_RECITER_BY_RECITER[reciterId];
  if (qfReciterConfig) {
    const qfReciterId = await resolveQfChapterReciterId(
      reciterId,
      qfReciterConfig,
      fetchImpl,
    );
    return loadQfChapterPlayback(reciterId, qfReciterId, surah, fetchImpl);
  }

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


async function resolveQfChapterReciterId(reciterId, config, fetchImpl) {
  const configuredId = normalizePositiveInteger(config?.id);
  if (configuredId) return configuredId;

  if (qfResolvedReciterIdCache.has(reciterId)) {
    return qfResolvedReciterIdCache.get(reciterId);
  }

  const aliases = (Array.isArray(config?.aliases) ? config.aliases : [])
    .map(normalizeReciterName)
    .filter(Boolean);
  if (!aliases.length) {
    throw new Error(`Quran Foundation reciter configuration is incomplete for ${reciterId}.`);
  }

  const reciters = await loadQfChapterReciters(fetchImpl);
  const match = reciters.find((reciter) => {
    const candidateNames = [
      reciter?.name,
      reciter?.reciter_name,
      reciter?.translated_name?.name,
      reciter?.style,
    ].map(normalizeReciterName).filter(Boolean);

    return candidateNames.some((candidate) => aliases.some((alias) => (
      candidate === alias
      || candidate.includes(alias)
      || alias.includes(candidate)
    )));
  });

  const resolvedId = normalizePositiveInteger(match?.id);
  if (!resolvedId) {
    throw new Error('Abdullah Awad Al Juhani is unavailable in the Quran Foundation chapter-reciter catalog.');
  }

  qfResolvedReciterIdCache.set(reciterId, resolvedId);
  return resolvedId;
}

async function loadQfChapterReciters(fetchImpl) {
  if (qfChapterRecitersPromise) return qfChapterRecitersPromise;

  qfChapterRecitersPromise = (async () => {
    const path = 'resources/chapter_reciters';
    const response = await fetchImpl(`/api/qf?path=${encodeURIComponent(path)}&language=en`);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Quran Foundation reciter catalog request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const payload = await response.json();
    const reciters = Array.isArray(payload?.reciters)
      ? payload.reciters
      : Array.isArray(payload?.chapter_reciters)
        ? payload.chapter_reciters
        : Array.isArray(payload)
          ? payload
          : [];

    if (!reciters.length) {
      throw new Error('Quran Foundation returned an empty chapter-reciter catalog.');
    }
    return reciters;
  })();

  try {
    return await qfChapterRecitersPromise;
  } catch (error) {
    qfChapterRecitersPromise = null;
    throw error;
  }
}

function normalizeReciterName(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[ʿ‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function loadQfChapterPlayback(reciterId, qfReciterId, surahNumber, fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Quran Foundation audio cannot be loaded in this environment.');
  }

  const cacheKey = `${reciterId}:${surahNumber}`;
  if (qfPlaybackCache.has(cacheKey)) return qfPlaybackCache.get(cacheKey);

  const loadingPromise = (async () => {
    const path = `chapter_recitations/${qfReciterId}/${surahNumber}`;
    const response = await fetchImpl(`/api/qf?path=${encodeURIComponent(path)}&segments=true`);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Quran Foundation audio request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const payload = await response.json();
    const audioFile = payload?.audio_file;
    const audioUrl = typeof audioFile?.audio_url === 'string'
      ? audioFile.audio_url.trim()
      : '';
    const timestamps = Array.isArray(audioFile?.timestamps)
      ? audioFile.timestamps
      : [];

    if (!audioUrl || !timestamps.length) return null;

    const segmentsByVerse = Object.fromEntries(
      timestamps
        .filter((timing) => typeof timing?.verse_key === 'string')
        .map((timing) => [timing.verse_key, timing]),
    );
    const timeline = buildSurahTimeline(segmentsByVerse, surahNumber);
    if (!timeline.length) return null;

    return {
      reciterId,
      folder: '',
      source: 'quran-foundation',
      surahNumber,
      audioUrl,
      timeline,
    };
  })();

  qfPlaybackCache.set(cacheKey, loadingPromise);
  try {
    return await loadingPromise;
  } catch (error) {
    if (qfPlaybackCache.get(cacheKey) === loadingPromise) {
      qfPlaybackCache.delete(cacheKey);
    }
    throw error;
  }
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
      .filter((segment) => (
        segment
        // Keep segments that overlap the ayah window. Several downloaded
        // reciter files are off by a few milliseconds at ayah boundaries;
        // requiring full containment silently removed otherwise valid words.
        && segment.endMs > startMs
        && segment.startMs < endMs
      ))
      .map((segment) => ({
        ...segment,
        startMs: Math.max(startMs, segment.startMs),
        endMs: Math.min(endMs, segment.endMs),
      }))
      .filter((segment) => segment.endMs > segment.startMs)
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
  if (time < timeline[0].startMs) return null;

  let low = 0;
  let high = timeline.length - 1;
  let match = null;

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

  // Do not leak the previous ayah into inter-ayah gaps or past the end of
  // the Surah. Exact starts belong to the new ayah; exact ends do not.
  return match && time < match.endMs ? match : null;
}


const WORD_GAP_TOLERANCE_MS = 120;

export function findWordAtTime(ayahTiming, timeMs) {
  const time = Number(timeMs);
  const wordSegments = ayahTiming?.wordSegments;
  if (!Array.isArray(wordSegments) || !wordSegments.length || !Number.isFinite(time)) {
    return null;
  }

  // Select the most recently started segment. This handles source overlaps
  // correctly because the newer word wins as soon as its segment begins.
  let low = 0;
  let high = wordSegments.length - 1;
  let matchedIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = wordSegments[middle];
    if (candidate.startMs <= time) {
      matchedIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (matchedIndex < 0) return null;

  const match = wordSegments[matchedIndex];
  const next = wordSegments[matchedIndex + 1] || null;
  const ayahEndMs = Number(ayahTiming?.endMs);
  const hardEndMs = Number.isFinite(ayahEndMs) ? ayahEndMs : match.endMs;

  // Bridge only tiny imperfections in source timing. Long pauses are left
  // unhighlighted, and the cap prevents a word leaking into the next ayah.
  const toleratedEndMs = match.endMs + WORD_GAP_TOLERANCE_MS;
  const allowedEndMs = next
    ? Math.min(next.startMs, toleratedEndMs, hardEndMs)
    : Math.min(toleratedEndMs, hardEndMs);

  return time < allowedEndMs ? match : null;
}

export function clearFullSurahAudioCache() {
  reciterDataCache.clear();
  qfPlaybackCache.clear();
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
  // Local JSON stores [word position, absolute Surah start ms, absolute
  // Surah end ms]. Repeated positions are valid; buildSurahTimeline derives
  // their zero-based occurrenceIndex after chronological normalization.
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
