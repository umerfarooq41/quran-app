import { getFullSurahPlayback } from './fullSurahAudio';

export const SHARE_BISMILLAH_TEXT = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

// Trim only the tiny tail after the final 1:1 word so the next Fatiha ayah
// cannot leak into the Share Bismillah clip. The start always comes from the
// first 1:1 word segment, so any reciter intro/A‘udhu remains excluded.
const BISMILLAH_END_GUARD_MS = 140;
const BISMILLAH_FALLBACK_END_GUARD_MS = 180;
const SHARE_MAIN_END_FADE_MS = 180;

export const SHARE_MEDIA_MODES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
});

export const SHARE_MEDIA_TABS = Object.freeze([
  { id: 'audio', label: 'Audio' },
  { id: 'background', label: 'Background' },
  { id: 'text', label: 'Text' },
]);

// Add user-owned/AI-generated clips here. The UI intentionally tolerates an
// empty library so no copyrighted sample media needs to ship with the app.
export const SHARE_BACKGROUND_ASSETS = Object.freeze([
  { id: 'green_forest', label: 'Green Forest', imageSrc: '/share/backgrounds/green_forest.webp', videoSrc: '/share/videos/green_forest.mp4', accentColor: '#6FA66F' },
  { id: 'ice_stream', label: 'Ice Stream', imageSrc: '/share/backgrounds/ice_stream.webp', videoSrc: '/share/videos/ice_stream.mp4', accentColor: '#B9D9EA' },
  { id: 'night_city', label: 'Night City', imageSrc: '/share/backgrounds/night_city.webp', videoSrc: '/share/videos/night_city.mp4', accentColor: '#7183A6' },
  { id: 'stormy_coast', label: 'Stormy Coast', imageSrc: '/share/backgrounds/stormy_coast.webp', videoSrc: '/share/videos/stormy_coast.mp4', accentColor: '#7895A3' },
  { id: 'sunset_coast', label: 'Sunset Coast', imageSrc: '/share/backgrounds/sunset_coast.webp', videoSrc: '/share/videos/sunset_coast.mp4', accentColor: '#D99B63' },
  { id: 'underwater_canyon', label: 'Underwater Canyon', imageSrc: '/share/backgrounds/underwater_canyon.webp', videoSrc: '/share/videos/underwater_canyon.mp4', accentColor: '#4A9FB0' },
]);

export function buildShareComposition({
  mode,
  surahNumber,
  fromAyah,
  toAyah,
  backgroundAsset = null,
  reciterId = '',
  showTranslation = false,
  translationId = null,
  style = {},
}) {
  return {
    mode: mode === SHARE_MEDIA_MODES.VIDEO ? SHARE_MEDIA_MODES.VIDEO : SHARE_MEDIA_MODES.IMAGE,
    surahNumber: Number(surahNumber) || 1,
    fromAyah: Number(fromAyah) || 1,
    toAyah: Number(toAyah) || Number(fromAyah) || 1,
    background: backgroundAsset
      ? {
          type: 'media',
          assetId: backgroundAsset.id,
          label: backgroundAsset.label || '',
          imageSrc: backgroundAsset.imageSrc || '',
          videoSrc: backgroundAsset.videoSrc || '',
          accentColor: backgroundAsset.accentColor || '#d8b36a',
        }
      : {
          type: 'solid',
          assetId: null,
          label: '',
          imageSrc: '',
          videoSrc: '',
          accentColor: '#d8b36a',
        },
    orientation: 'portrait',
    reciterId,
    showTranslation: Boolean(showTranslation),
    translationId,
    style: {
      textColor: style.textColor || '#ffffff',
      overlayOpacity: Number.isFinite(Number(style.overlayOpacity))
        ? Number(style.overlayOpacity)
        : 0.42,
      alignment: style.alignment || 'center',
      textScale: Number.isFinite(Number(style.textScale)) ? Number(style.textScale) : 1,
      translationScale: Number.isFinite(Number(style.translationScale)) ? Number(style.translationScale) : 1,
    },
  };
}

export function shouldIncludeShareBismillah(surahNumber, fromAyah) {
  const surah = Number(surahNumber) || 1;
  const firstAyah = Number(fromAyah) || 1;
  if (surah === 9) return false;
  if (surah === 1 && firstAyah === 1) return false;
  return true;
}

export async function loadShareVideoTimeline(composition, fetchImpl = globalThis.fetch) {
  if (!composition?.reciterId || !composition?.surahNumber) return null;

  const playback = await getFullSurahPlayback(
    composition.reciterId,
    composition.surahNumber,
    fetchImpl,
  );
  if (!playback?.timeline?.length) return null;

  const selected = playback.timeline.filter((entry) => {
    const ayahNumber = Number(entry.ayahNumber);
    return ayahNumber >= composition.fromAyah && ayahNumber <= composition.toAyah;
  });
  if (!selected.length) return null;

  let bismillah = null;
  if (shouldIncludeShareBismillah(composition.surahNumber, composition.fromAyah)) {
    const fatihaPlayback = composition.surahNumber === 1
      ? playback
      : await getFullSurahPlayback(composition.reciterId, 1, fetchImpl);
    const firstAyah = fatihaPlayback?.timeline?.find((entry) => Number(entry.ayahNumber) === 1);
    if (fatihaPlayback?.audioUrl && firstAyah) {
      const wordSegments = Array.isArray(firstAyah.wordSegments)
        ? firstAyah.wordSegments.filter((segment) => (
            Number.isFinite(Number(segment?.startMs))
            && Number.isFinite(Number(segment?.endMs))
          ))
        : [];
      const hasWordBoundaries = wordSegments.length > 0;
      const sourceStartMs = hasWordBoundaries
        ? Number(wordSegments[0].startMs)
        : Number(firstAyah.startMs);
      const rawSourceEndMs = hasWordBoundaries
        ? Number(wordSegments[wordSegments.length - 1].endMs)
        : Number(firstAyah.endMs);
      const endGuardMs = hasWordBoundaries
        ? BISMILLAH_END_GUARD_MS
        : BISMILLAH_FALLBACK_END_GUARD_MS;
      const sourceEndMs = Math.max(sourceStartMs, rawSourceEndMs - endGuardMs);
      const durationMs = Math.max(0, sourceEndMs - sourceStartMs);

      if (Number.isFinite(sourceStartMs) && Number.isFinite(sourceEndMs) && durationMs > 0) {
        bismillah = {
          audioUrl: fatihaPlayback.audioUrl,
          sourceStartMs,
          sourceEndMs,
          startMs: 0,
          endMs: durationMs,
          durationMs,
          ayahNumber: 1,
          wordSegments: hasWordBoundaries
            ? wordSegments.map((segment) => ({
                ...segment,
                sourceStartMs: Number(segment.startMs) || 0,
                sourceEndMs: Number(segment.endMs) || 0,
                startMs: Math.max(0, (Number(segment.startMs) || 0) - sourceStartMs),
                endMs: Math.min(
                  durationMs,
                  Math.max(0, (Number(segment.endMs) || 0) - sourceStartMs),
                ),
              })).filter((segment) => segment.endMs > segment.startMs)
            : [],
        };
      }
    }
  }

  // Use the first/last timed Quran words as the main clip boundaries whenever
  // word timing exists. Ayah-level timestamps for several reciters overlap at
  // boundaries, which can otherwise include the tail of the previous ayah or
  // the opening of the next one in a Share Quran video.
  const firstEntry = selected[0];
  const lastEntry = selected[selected.length - 1];
  const firstWord = Array.isArray(firstEntry.wordSegments) && firstEntry.wordSegments.length
    ? firstEntry.wordSegments[0]
    : null;
  const lastWord = Array.isArray(lastEntry.wordSegments) && lastEntry.wordSegments.length
    ? lastEntry.wordSegments[lastEntry.wordSegments.length - 1]
    : null;

  const firstStart = Number(firstWord?.startMs ?? firstEntry.startMs) || 0;
  let lastEnd = Number(lastWord?.endMs ?? lastEntry.endMs) || firstStart;

  // Never let a selected clip cross into the first timed word of the following
  // ayah, even when source timestamps overlap. This is a hard safety boundary;
  // the final selected word gets a short fade instead of allowing next-ayah
  // speech to leak into the export.
  const lastPlaybackIndex = playback.timeline.indexOf(lastEntry);
  const nextEntry = lastPlaybackIndex >= 0 ? playback.timeline[lastPlaybackIndex + 1] : null;
  const nextFirstWord = Array.isArray(nextEntry?.wordSegments) && nextEntry.wordSegments.length
    ? nextEntry.wordSegments[0]
    : null;
  const nextSpeechStartMs = Number(nextFirstWord?.startMs ?? nextEntry?.startMs);
  if (Number.isFinite(nextSpeechStartMs) && nextSpeechStartMs > firstStart) {
    lastEnd = Math.min(lastEnd, nextSpeechStartMs);
  }
  lastEnd = Math.max(firstStart + 1, lastEnd);

  const preRollMs = Number(bismillah?.durationMs) || 0;
  const normalizedTimeline = selected.map((entry) => {
    const clippedStart = Math.max(firstStart, Number(entry.startMs) || firstStart);
    const clippedEnd = Math.min(lastEnd, Number(entry.endMs) || lastEnd);
    return {
      ...entry,
      sourceStartMs: clippedStart,
      sourceEndMs: clippedEnd,
      startMs: preRollMs + Math.max(0, clippedStart - firstStart),
      endMs: preRollMs + Math.max(0, clippedEnd - firstStart),
      wordSegments: (Array.isArray(entry.wordSegments) ? entry.wordSegments : []).map((segment) => ({
        ...segment,
        sourceStartMs: Number(segment.startMs) || 0,
        sourceEndMs: Number(segment.endMs) || 0,
        startMs: preRollMs + Math.max(0, Math.max(firstStart, Number(segment.startMs) || 0) - firstStart),
        endMs: preRollMs + Math.max(0, Math.min(lastEnd, Number(segment.endMs) || 0) - firstStart),
      })).filter((segment) => segment.endMs > segment.startMs),
    };
  }).filter((entry) => entry.endMs > entry.startMs);

  const selectedDurationMs = Math.max(1, lastEnd - firstStart);

  return {
    ...playback,
    sourceStartMs: firstStart,
    sourceEndMs: lastEnd,
    selectedDurationMs,
    endFadeMs: SHARE_MAIN_END_FADE_MS,
    bismillah,
    bismillahDurationMs: preRollMs,
    durationMs: preRollMs + selectedDurationMs,
    timeline: normalizedTimeline,
  };
}

export function findShareAyahAtTime(timeline, elapsedMs) {
  if (!Array.isArray(timeline) || !timeline.length) return null;
  const time = Math.max(0, Number(elapsedMs) || 0);

  let low = 0;
  let high = timeline.length - 1;
  let best = timeline[0];

  while (low <= high) {
    const mid = (low + high) >> 1;
    const entry = timeline[mid];
    if (time < entry.startMs) {
      high = mid - 1;
    } else {
      best = entry;
      low = mid + 1;
    }
  }

  return time <= best.endMs ? best : timeline[Math.min(low, timeline.length - 1)] || best;
}
