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
  { id: 'desert', label: 'Desert', imageSrc: '/share/backgrounds/desert.png', videoSrc: '/share/videos/desert.mp4' },
  { id: 'forest', label: 'Forest', imageSrc: '/share/backgrounds/forest.png', videoSrc: '/share/videos/forest.mp4' },
  { id: 'ice', label: 'Ice', imageSrc: '/share/backgrounds/ice.png', videoSrc: '/share/videos/ice.mp4' },
  { id: 'mountains', label: 'Mountains', imageSrc: '/share/backgrounds/mountains.png', videoSrc: '/share/videos/mountains.mp4' },
  { id: 'space', label: 'Space', imageSrc: '/share/backgrounds/space.png', videoSrc: '/share/videos/space.mp4' },
  { id: 'undersea', label: 'Undersea', imageSrc: '/share/backgrounds/undersea.png', videoSrc: '/share/videos/undersea.mp4' },
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
        }
      : {
          type: 'solid',
          assetId: null,
          label: '',
          imageSrc: '',
          videoSrc: '',
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
