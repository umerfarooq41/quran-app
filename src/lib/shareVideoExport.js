import { findShareAyahAtTime } from './shareMedia';

const VIDEO_FPS = 30;
const DEFAULT_VIDEO_BITRATE = 5_000_000;
const AUDIO_BITRATE = 128_000;

export async function generateQuranShareVideo({
  composition,
  timeline,
  ayahs,
  translationsByAyah = {},
  translationDirection = 'ltr',
  surahName,
  surahMeaning = '',
  onProgress,
}) {
  assertVideoExportSupport();

  const isLandscape = composition?.orientation === 'landscape';
  const width = isLandscape ? 1280 : 720;
  const height = isLandscape ? 720 : 1280;
  const durationMs = Math.max(1, Number(timeline?.durationMs) || 0);
  const backgroundSrc = composition?.background?.videoSrc;
  const audioSrc = timeline?.audioUrl;

  if (!backgroundSrc) throw new Error('A video background is required.');
  if (!audioSrc) throw new Error('Recitation audio is unavailable.');

  await Promise.all([
    document.fonts?.load?.('58px IndopakNastaleeq'),
    document.fonts?.load?.('28px Inter'),
  ]);

  const backgroundVideo = document.createElement('video');
  backgroundVideo.src = backgroundSrc;
  backgroundVideo.muted = true;
  backgroundVideo.loop = true;
  backgroundVideo.playsInline = true;
  backgroundVideo.preload = 'auto';

  const audio = document.createElement('audio');
  audio.src = audioSrc;
  audio.preload = 'auto';

  await Promise.all([
    waitForMedia(backgroundVideo, 'Background video could not be loaded.'),
    waitForMedia(audio, 'Recitation audio could not be loaded.'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const canvasStream = canvas.captureStream(VIDEO_FPS);
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioDestination = audioContext.createMediaStreamDestination();

  let audioSource;
  try {
    audioSource = audioContext.createMediaElementSource(audio);
    audioSource.connect(audioDestination);
  } catch (error) {
    canvasStream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => {});
    throw new Error(
      'This reciter audio cannot be captured for offline video export. Use a bundled/local reciter audio source.',
    );
  }

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);

  const mimeType = chooseRecorderMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: DEFAULT_VIDEO_BITRATE,
    audioBitsPerSecond: AUDIO_BITRATE,
  });

  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data);
  });

  const stopped = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.addEventListener('error', () => reject(new Error('Video recorder failed.')), { once: true });
  });

  const cleanup = async () => {
    backgroundVideo.pause();
    audio.pause();
    canvasStream.getTracks().forEach((track) => track.stop());
    combinedStream.getTracks().forEach((track) => track.stop());
    try { audioSource?.disconnect(); } catch {}
    try { await audioContext.close(); } catch {}
  };

  try {
    backgroundVideo.currentTime = 0;
    audio.currentTime = Math.max(0, Number(timeline.sourceStartMs) || 0) / 1000;
    await audioContext.resume();
    await backgroundVideo.play();

    recorder.start(500);
    await audio.play();

    const startedAt = performance.now();
    let animationFrame = 0;

    await new Promise((resolve, reject) => {
      const render = () => {
        try {
          const audioElapsedMs = Math.max(
            0,
            (audio.currentTime * 1000) - (Number(timeline.sourceStartMs) || 0),
          );
          const elapsedMs = Math.min(durationMs, audioElapsedMs);
          const timelineEntry = findShareAyahAtTime(timeline.timeline, elapsedMs);
          const currentAyah = ayahs.find(
            (item) => Number(item.ayahNumber) === Number(timelineEntry?.ayahNumber),
          ) || ayahs[0];

          drawVideoFrame(ctx, {
            video: backgroundVideo,
            width,
            height,
            isLandscape,
            surahName,
            surahMeaning,
            ayah: currentAyah,
            translation: composition?.showTranslation
              ? translationsByAyah?.[currentAyah?.ayahNumber] || ''
              : '',
            translationDirection,
            textScale: composition?.style?.textScale || 1,
          });

          onProgress?.(Math.min(1, elapsedMs / durationMs));

          if (
            elapsedMs >= durationMs - 20
            || audio.currentTime * 1000 >= Number(timeline.sourceEndMs) - 20
            || audio.ended
          ) {
            resolve();
            return;
          }

          // Fallback guard in case a browser fails to advance the audio element.
          if (performance.now() - startedAt > durationMs + 5000) {
            reject(new Error('Video export timed out.'));
            return;
          }

          animationFrame = requestAnimationFrame(render);
        } catch (error) {
          reject(error);
        }
      };

      animationFrame = requestAnimationFrame(render);
    });

    cancelAnimationFrame(animationFrame);
    audio.pause();
    backgroundVideo.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    onProgress?.(1);

    if (!chunks.length) throw new Error('The browser did not produce a video file.');
    return new Blob(chunks, { type: mimeType });
  } finally {
    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    await cleanup();
  }
}

function drawVideoFrame(ctx, {
  video,
  width,
  height,
  isLandscape,
  surahName,
  surahMeaning,
  ayah,
  translation,
  translationDirection,
  textScale,
}) {
  drawVideoCover(ctx, video, width, height);

  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, 'rgba(4,18,17,.20)');
  overlay.addColorStop(.55, 'rgba(4,18,17,.30)');
  overlay.addColorStop(1, 'rgba(4,18,17,.42)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header gets a reserved top zone.
  ctx.direction = 'rtl';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${isLandscape ? 42 : 50}px IndopakNastaleeq, serif`;
  ctx.fillText(`سُورَةُ ${surahName}`, width / 2, height * (isLandscape ? .105 : .09));

  if (surahMeaning) {
    ctx.direction = 'ltr';
    ctx.font = `500 ${isLandscape ? 20 : 24}px Inter, ui-sans-serif, system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,.90)';
    ctx.fillText(surahMeaning, width / 2, height * (isLandscape ? .155 : .13));
  }

  const cardCenterY = height * (isLandscape ? .50 : .49);
  const cardWidth = width * (isLandscape ? .76 : .86);
  const maxCardHeight = height * (isLandscape ? .47 : .50);
  const cardX = (width - cardWidth) / 2;
  const maxTextWidth = cardWidth * .88;

  const arabicText = String(ayah?.text || '');
  let arabicFont = (isLandscape ? 39 : 47) * clamp(Number(textScale) || 1, .75, 1.35);
  let arabicLines = [];

  while (arabicFont >= (isLandscape ? 27 : 32)) {
    ctx.direction = 'rtl';
    ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;
    arabicLines = wrapText(ctx, arabicText, maxTextWidth);
    if (arabicLines.length <= (isLandscape ? 3 : 5)) break;
    arabicFont -= 2;
  }

  const arabicLineHeight = arabicFont * 1.58;
  const translationFont = isLandscape ? 19 : 22;
  let translationLines = [];

  if (translation) {
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.font = `500 ${translationFont}px Inter, ui-sans-serif, system-ui`;
    translationLines = wrapText(ctx, translation, maxTextWidth);
    const maxTranslationLines = isLandscape ? 3 : 5;
    if (translationLines.length > maxTranslationLines) {
      translationLines = truncateLines(translationLines, maxTranslationLines);
    }
  }

  const translationLineHeight = translationFont * 1.42;
  const arabicHeight = arabicLines.length * arabicLineHeight;
  const translationHeight = translationLines.length
    ? 18 + (translationLines.length * translationLineHeight)
    : 0;
  const cardHeight = Math.min(
    maxCardHeight,
    Math.max(
      height * (isLandscape ? .25 : .20),
      arabicHeight + translationHeight + (isLandscape ? 62 : 78),
    ),
  );
  const cardY = cardCenterY - cardHeight / 2;

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, isLandscape ? 28 : 34);
  ctx.fillStyle = 'rgba(5,22,20,.52)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let cursorY = cardCenterY - ((arabicHeight + translationHeight) / 2) + arabicLineHeight / 2;
  ctx.direction = 'rtl';
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;
  arabicLines.forEach((line) => {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += arabicLineHeight;
  });

  if (translationLines.length) {
    cursorY += 10;
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.fillStyle = 'rgba(255,255,255,.93)';
    ctx.font = `500 ${translationFont}px Inter, ui-sans-serif, system-ui`;
    translationLines.forEach((line) => {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += translationLineHeight;
    });
  }
}

function chooseRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}

function assertVideoExportSupport() {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Offline video export is not supported by this browser.');
  }
  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Canvas video capture is not supported by this browser.');
  }
  if (!(window.AudioContext || window.webkitAudioContext)) {
    throw new Error('Audio mixing is not supported by this browser.');
  }
}

function waitForMedia(media, message) {
  if (media.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(message));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener('loadedmetadata', ready);
      media.removeEventListener('canplay', ready);
      media.removeEventListener('error', failed);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error(message));
    };

    media.addEventListener('loadedmetadata', ready, { once: true });
    media.addEventListener('canplay', ready, { once: true });
    media.addEventListener('error', failed, { once: true });
  });
}

function drawVideoCover(ctx, video, width, height) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  result[maxLines - 1] = `${result[maxLines - 1]}…`;
  return result;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
