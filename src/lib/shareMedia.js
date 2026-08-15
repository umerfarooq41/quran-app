import { getFullSurahPlayback } from './fullSurahAudio';

export const SHARE_MEDIA_MODES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
});

export const SHARE_MEDIA_TABS = Object.freeze([
  { id: 'audio', label: 'Audio' },
  { id: 'background', label: 'Background' },
  { id: 'text', label: 'Text' },
  { id: 'style', label: 'Style' },
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
  orientation = 'portrait',
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
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
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
    },
  };
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

  const firstStart = Number(selected[0].startMs) || 0;
  const normalizedTimeline = selected.map((entry) => ({
    ...entry,
    sourceStartMs: Number(entry.startMs) || 0,
    sourceEndMs: Number(entry.endMs) || 0,
    startMs: Math.max(0, (Number(entry.startMs) || 0) - firstStart),
    endMs: Math.max(0, (Number(entry.endMs) || 0) - firstStart),
    wordSegments: (Array.isArray(entry.wordSegments) ? entry.wordSegments : []).map((segment) => ({
      ...segment,
      sourceStartMs: Number(segment.startMs) || 0,
      sourceEndMs: Number(segment.endMs) || 0,
      startMs: Math.max(0, (Number(segment.startMs) || 0) - firstStart),
      endMs: Math.max(0, (Number(segment.endMs) || 0) - firstStart),
    })),
  }));

  return {
    ...playback,
    sourceStartMs: firstStart,
    sourceEndMs: Number(selected[selected.length - 1].endMs) || firstStart,
    durationMs: Math.max(
      1,
      (Number(selected[selected.length - 1].endMs) || firstStart) - firstStart,
    ),
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
