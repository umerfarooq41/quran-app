import { getFullSurahPlayback } from './fullSurahAudio';

export const SHARE_BISMILLAH_TEXT = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

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
      // Prefer the exact first/last Quran-word boundaries for 1:1. This keeps
      // reciter-specific A'udhu/intro audio outside the Share Bismillah clip.
      // Fall back to the ayah boundary for datasets without word segments.
      const sourceStartMs = wordSegments.length
        ? Number(wordSegments[0].startMs)
        : (Number(firstAyah.startMs) || 0);
      const sourceEndMs = wordSegments.length
        ? Number(wordSegments[wordSegments.length - 1].endMs)
        : (Number(firstAyah.endMs) || sourceStartMs);
      const durationMs = Math.max(0, sourceEndMs - sourceStartMs);
      if (durationMs > 0) {
        bismillah = {
          audioUrl: fatihaPlayback.audioUrl,
          sourceStartMs,
          sourceEndMs,
          startMs: 0,
          endMs: durationMs,
          durationMs,
          ayahNumber: 1,
          wordSegments: wordSegments.map((segment) => ({
            ...segment,
            sourceStartMs: Number(segment.startMs) || 0,
            sourceEndMs: Number(segment.endMs) || 0,
            startMs: Math.max(0, (Number(segment.startMs) || 0) - sourceStartMs),
            endMs: Math.max(0, (Number(segment.endMs) || 0) - sourceStartMs),
          })),
        };
      }
    }
  }

  const preRollMs = Number(bismillah?.durationMs) || 0;
  const firstStart = Number(selected[0].startMs) || 0;
  const normalizedTimeline = selected.map((entry) => ({
    ...entry,
    sourceStartMs: Number(entry.startMs) || 0,
    sourceEndMs: Number(entry.endMs) || 0,
    startMs: preRollMs + Math.max(0, (Number(entry.startMs) || 0) - firstStart),
    endMs: preRollMs + Math.max(0, (Number(entry.endMs) || 0) - firstStart),
    wordSegments: (Array.isArray(entry.wordSegments) ? entry.wordSegments : []).map((segment) => ({
      ...segment,
      sourceStartMs: Number(segment.startMs) || 0,
      sourceEndMs: Number(segment.endMs) || 0,
      startMs: preRollMs + Math.max(0, (Number(segment.startMs) || 0) - firstStart),
      endMs: preRollMs + Math.max(0, (Number(segment.endMs) || 0) - firstStart),
    })),
  }));

  const selectedDurationMs = Math.max(
    1,
    (Number(selected[selected.length - 1].endMs) || firstStart) - firstStart,
  );

  return {
    ...playback,
    sourceStartMs: firstStart,
    sourceEndMs: Number(selected[selected.length - 1].endMs) || firstStart,
    selectedDurationMs,
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
