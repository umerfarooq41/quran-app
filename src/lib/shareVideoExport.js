import { findShareAyahAtTime } from './shareMedia';
import { findWordAtTime } from './fullSurahAudio';
import { getQuranWordsForAyah } from './quranWordMap';

// The bundled share backgrounds are 1280×720 / 24 fps at roughly 2 Mbps.
// Matching the source cadence and using a modest headroom avoids wasting bits
// without reducing the visible detail that exists in the source clips.
const VIDEO_FPS = 24;
const DEFAULT_VIDEO_BITRATE = 2_200_000;
const AUDIO_BITRATE = 96_000;

export async function generateQuranShareVideo({
  composition,
  timeline,
  ayahs,
  translationsByAyah = {},
  translationDirection = 'ltr',
  surahName,
  surahMeaning = '',
  highlightColor = '#d8b36a',
  translationScale = 1,
  onProgress,
}) {
  assertVideoExportSupport();

  const isLandscape = composition?.orientation === 'landscape';
  const width = isLandscape ? 1280 : 720;
  const height = isLandscape ? 720 : 1280;
  const durationMs = Math.max(1, Number(timeline?.durationMs) || 0);
  const preRollMs = Math.max(0, Number(timeline?.bismillahDurationMs) || 0);
  const backgroundSrc = composition?.background?.videoSrc;
  const audioSrc = timeline?.audioUrl;
  const bismillahSrc = preRollMs > 0 ? timeline?.bismillah?.audioUrl : '';

  if (!backgroundSrc) throw new Error('A video background is required.');
  if (!audioSrc) throw new Error('Recitation audio is unavailable.');
  if (preRollMs > 0 && !bismillahSrc) throw new Error('Bismillah audio is unavailable.');

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
  const capturableAudio = await prepareCapturableAudio(audioSrc);
  audio.src = capturableAudio.src;
  audio.preload = 'auto';

  let bismillahAudio = null;
  let capturableBismillah = null;
  if (bismillahSrc) {
    bismillahAudio = document.createElement('audio');
    capturableBismillah = await prepareCapturableAudio(bismillahSrc);
    bismillahAudio.src = capturableBismillah.src;
    bismillahAudio.preload = 'auto';
  }

  await Promise.all([
    waitForMedia(backgroundVideo, 'Background video could not be loaded.'),
    waitForMedia(audio, 'Recitation audio could not be loaded.'),
    bismillahAudio
      ? waitForMedia(bismillahAudio, 'Bismillah audio could not be loaded.')
      : Promise.resolve(),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const canvasStream = canvas.captureStream(VIDEO_FPS);
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioDestination = audioContext.createMediaStreamDestination();
  const audioSources = [];

  const connectAudio = (media) => {
    const source = audioContext.createMediaElementSource(media);
    source.connect(audioDestination);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    source.connect(silentGain);
    silentGain.connect(audioContext.destination);
    audioSources.push(source);
  };

  try {
    connectAudio(audio);
    if (bismillahAudio) connectAudio(bismillahAudio);
  } catch (error) {
    canvasStream.getTracks().forEach((track) => track.stop());
    capturableAudio.revoke?.();
    capturableBismillah?.revoke?.();
    await audioContext.close().catch(() => {});
    throw new Error(
      'This reciter audio cannot be captured for offline video export. Use a bundled/local reciter audio source.',
      { cause: error },
    );
  }

  const audioTracks = audioDestination.stream.getAudioTracks();
  if (!audioTracks.length) {
    canvasStream.getTracks().forEach((track) => track.stop());
    capturableAudio.revoke?.();
    capturableBismillah?.revoke?.();
    await audioContext.close().catch(() => {});
    throw new Error('The browser did not create an audio track for the exported video.');
  }

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ]);

  let recorderSetup;
  try {
    recorderSetup = createVideoRecorder(combinedStream);
  } catch (error) {
    canvasStream.getTracks().forEach((track) => track.stop());
    combinedStream.getTracks().forEach((track) => track.stop());
    capturableAudio.revoke?.();
    capturableBismillah?.revoke?.();
    await audioContext.close().catch(() => {});
    throw new Error('This browser cannot start the offline video encoder.', { cause: error });
  }
  const { recorder, mimeType } = recorderSetup;

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
    bismillahAudio?.pause();
    canvasStream.getTracks().forEach((track) => track.stop());
    combinedStream.getTracks().forEach((track) => track.stop());
    audioSources.forEach((source) => {
      try { source.disconnect(); } catch {}
    });
    capturableAudio.revoke?.();
    capturableBismillah?.revoke?.();
    try { await audioContext.close(); } catch {}
  };

  try {
    backgroundVideo.currentTime = 0;
    audio.currentTime = Math.max(0, Number(timeline.sourceStartMs) || 0) / 1000;
    if (bismillahAudio) {
      bismillahAudio.currentTime = Math.max(0, Number(timeline.bismillah?.sourceStartMs) || 0) / 1000;
    }

    await audioContext.resume();
    await backgroundVideo.play();
    recorder.start(1000);

    let phase = preRollMs > 0 && bismillahAudio ? 'bismillah' : 'main';
    try {
      if (phase === 'bismillah') await bismillahAudio.play();
      else await audio.play();
    } catch (error) {
      throw new Error('Recitation audio could not start during video export.', { cause: error });
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    let mainStartPending = false;

    await new Promise((resolve, reject) => {
      const render = () => {
        try {
          let elapsedMs = 0;
          let isBismillah = false;

          if (phase === 'bismillah' && bismillahAudio) {
            const bismillahElapsed = Math.max(
              0,
              (bismillahAudio.currentTime * 1000) - Number(timeline.bismillah?.sourceStartMs || 0),
            );
            elapsedMs = Math.min(preRollMs, bismillahElapsed);
            isBismillah = true;

            if (
              bismillahElapsed >= preRollMs - 20
              || bismillahAudio.currentTime * 1000 >= Number(timeline.bismillah?.sourceEndMs || 0) - 20
              || bismillahAudio.ended
            ) {
              bismillahAudio.pause();
              phase = 'main';
              mainStartPending = true;
              audio.currentTime = Math.max(0, Number(timeline.sourceStartMs) || 0) / 1000;
              audio.play().then(() => {
                mainStartPending = false;
              }).catch(reject);
            }
          } else {
            const mainElapsed = Math.max(
              0,
              (audio.currentTime * 1000) - (Number(timeline.sourceStartMs) || 0),
            );
            elapsedMs = Math.min(durationMs, preRollMs + mainElapsed);
          }

          const timelineEntry = isBismillah
            ? null
            : findShareAyahAtTime(timeline.timeline, elapsedMs);
          const currentAyah = isBismillah
            ? null
            : ayahs.find((item) => Number(item.ayahNumber) === Number(timelineEntry?.ayahNumber)) || ayahs[0];
          const activeWord = isBismillah ? null : findWordAtTime(timelineEntry, elapsedMs);
          const wordItems = isBismillah
            ? []
            : getQuranWordsForAyah(composition?.surahNumber, currentAyah?.ayahNumber);

          drawVideoFrame(ctx, {
            video: backgroundVideo,
            width,
            height,
            isLandscape,
            surahName,
            surahMeaning,
            surahNumber: composition?.surahNumber,
            ayah: currentAyah,
            wordItems,
            activeWordPosition: activeWord?.position || null,
            highlightColor,
            translation: !isBismillah && composition?.showTranslation
              ? translationsByAyah?.[currentAyah?.ayahNumber] || ''
              : '',
            translationDirection,
            textScale: composition?.style?.textScale || 1,
            translationScale: composition?.style?.translationScale || translationScale || 1,
            isBismillah,
          });

          onProgress?.(Math.min(1, elapsedMs / durationMs));

          if (
            phase === 'main'
            && !mainStartPending
            && (
              elapsedMs >= durationMs - 20
              || audio.currentTime * 1000 >= Number(timeline.sourceEndMs) - 20
              || audio.ended
            )
          ) {
            resolve();
            return;
          }

          if (performance.now() - startedAt > durationMs + 8000) {
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
    bismillahAudio?.pause();
    backgroundVideo.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    onProgress?.(1);

    if (!chunks.length) throw new Error('The browser did not produce a video file.');
    const outputMimeType = mimeType?.toLowerCase().startsWith('video/mp4')
      ? mimeType
      : 'video/mp4';

    const output = new Blob(chunks, { type: outputMimeType });
    if (!output.size) throw new Error('The browser produced an empty video file.');
    if (!output.type.toLowerCase().startsWith('video/mp4')) {
      throw new Error('The browser did not produce an MP4 video.');
    }
    return output;
  } finally {
    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    await cleanup();
  }
}

function drawVideoFrame(ctx, {
  video, width, height, isLandscape, surahName, surahMeaning, surahNumber,
  ayah, wordItems, activeWordPosition, highlightColor, translation,
  translationDirection, textScale, translationScale = 1, isBismillah = false,
}) {
  drawVideoCover(ctx, video, width, height);
  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, 'rgba(4,18,17,.16)');
  overlay.addColorStop(.55, 'rgba(4,18,17,.22)');
  overlay.addColorStop(1, 'rgba(4,18,17,.34)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${isLandscape ? 40 : 48}px IndopakNastaleeq, serif`;
  ctx.fillText(`سُورَةُ ${surahName}`, width / 2, height * (isLandscape ? .075 : .065));

  if (surahMeaning) {
    ctx.direction = 'ltr';
    ctx.font = `500 ${isLandscape ? 19 : 23}px Inter, ui-sans-serif, system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,.90)';
    ctx.fillText(surahMeaning, width / 2, height * (isLandscape ? .12 : .102));
  }

  if (isBismillah) {
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const bismillahFont = (isLandscape ? 37 : 45) * clamp(Number(textScale) || 1, .75, 1.35);
    ctx.font = `${Math.round(bismillahFont)}px IndopakNastaleeq, serif`;
    ctx.fillText(
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      width / 2,
      height * (isLandscape ? .24 : .21),
    );
    return;
  }

  const safeTop = height * (isLandscape ? .18 : .165);
  const safeBottom = height * (isLandscape ? .93 : .91);
  const maxCardHeight = safeBottom - safeTop;
  const cardWidth = width * (isLandscape ? .86 : .88);
  const cardX = (width - cardWidth) / 2;
  const maxTextWidth = cardWidth * .88;

  const requestedArabicFont = (isLandscape ? 37 : 45) * clamp(Number(textScale) || 1, .75, 1.35);
  const requestedTranslationFont = (isLandscape ? 18 : 21) * clamp(Number(translationScale) || 1, .75, 1.35);
  const minimumArabicFont = isLandscape ? 23 : 27;
  const minimumTranslationFont = isLandscape ? 14 : 16;
  let referenceFont = translation ? requestedTranslationFont : requestedArabicFont;
  let referenceHeight = referenceFont * 1.6 + 10;
  const verticalPadding = isLandscape ? 44 : 56;

  let arabicFont = requestedArabicFont;
  let translationFont = requestedTranslationFont;
  let arabicLines = [];
  let translationLines = [];
  let arabicLineHeight = 0;
  let translationLineHeight = 0;
  let contentHeight = 0;

  const measure = () => {
    ctx.direction = 'rtl';
    ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;
    arabicLines = wrapWordItems(ctx, wordItems, maxTextWidth);
    arabicLineHeight = arabicFont * 1.50;

    translationLines = [];
    translationLineHeight = translationFont * 1.36;
    if (translation) {
      ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
      ctx.font = `500 ${Math.round(translationFont)}px Inter, ui-sans-serif, system-ui`;
      translationLines = wrapText(ctx, translation, maxTextWidth);
    }

    referenceFont = translation ? translationFont : arabicFont;
    referenceHeight = referenceFont * 1.6 + 10;

    const arabicHeight = Math.max(arabicLineHeight, arabicLines.length * arabicLineHeight);
    const translationHeight = translationLines.length
      ? 16 + (translationLines.length * translationLineHeight)
      : 0;
    contentHeight = arabicHeight + translationHeight + referenceHeight;
    return contentHeight + verticalPadding;
  };

  let requiredHeight = measure();
  let guard = 0;
  while (requiredHeight > maxCardHeight && guard < 80) {
    guard += 1;
    const canReduceArabic = arabicFont > minimumArabicFont;
    const canReduceTranslation = translation && translationFont > minimumTranslationFont;
    if (!canReduceArabic && !canReduceTranslation) break;
    if (canReduceArabic) arabicFont = Math.max(minimumArabicFont, arabicFont - 1);
    if (canReduceTranslation) translationFont = Math.max(minimumTranslationFont, translationFont - .75);
    requiredHeight = measure();
  }

  const minimumCardHeight = height * (isLandscape ? .22 : .16);
  const cardHeight = Math.min(maxCardHeight, Math.max(minimumCardHeight, requiredHeight));

  // Match the live preview's center-first growth model.
  // Keep short/medium cards centered. Once their upper edge reaches the
  // protected title zone, lock the top there and grow downward.
  const previewCenterY = height / 2;
  const centeredCardY = previewCenterY - (cardHeight / 2);
  const symmetricHeightBeforeTitle = Math.max(0, (previewCenterY - safeTop) * 2);
  const cardY = cardHeight <= symmetricHeightBeforeTitle
    ? centeredCardY
    : safeTop;
  const cardCenterY = cardY + cardHeight / 2;

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, isLandscape ? 20 : 24);
  ctx.fillStyle = 'rgba(4, 19, 18, .42)';
  ctx.fill();

  const arabicHeight = Math.max(arabicLineHeight, arabicLines.length * arabicLineHeight);
  const translationHeight = translationLines.length
    ? 16 + (translationLines.length * translationLineHeight)
    : 0;
  const finalContentHeight = arabicHeight + translationHeight + referenceHeight;
  let cursorY = cardCenterY - finalContentHeight / 2 + arabicLineHeight / 2;

  ctx.direction = 'rtl';
  ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;
  arabicLines.forEach((line) => {
    drawRtlWordLine(ctx, {
      words: line,
      centerX: width / 2,
      y: cursorY,
      font: `${Math.round(arabicFont)}px IndopakNastaleeq, serif`,
      normalColor: '#ffffff',
      highlightColor,
      activeWordPosition,
    });
    cursorY += arabicLineHeight;
  });

  if (translationLines.length) {
    cursorY += 8;
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.font = `500 ${Math.round(translationFont)}px Inter, ui-sans-serif, system-ui`;
    translationLines.forEach((line) => {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += translationLineHeight;
    });
  }

  cursorY += 7;
  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.70)';
  ctx.font = `500 ${referenceFont}px Inter, ui-sans-serif, system-ui`;
  ctx.fillText(`${surahNumber}:${ayah?.ayahNumber}`, width / 2, cursorY);
}

function wrapWordItems(ctx, wordItems, maxWidth) {
  const items = Array.isArray(wordItems) && wordItems.length ? wordItems : [];
  if (!items.length) return [[]];
  const lines = [];
  let current = [];
  items.forEach((word) => {
    const candidate = [...current, word];
    const text = candidate.map((item) => item.text).join(' ');
    if (!current.length || ctx.measureText(text).width <= maxWidth) current = candidate;
    else { lines.push(current); current = [word]; }
  });
  if (current.length) lines.push(current);
  return lines;
}

function drawRtlWordLine(ctx, { words, centerX, y, font, normalColor, highlightColor, activeWordPosition }) {
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  const spaceWidth = ctx.measureText(' ').width;
  const widths = words.map((word) => ctx.measureText(word.text).width);
  const totalWidth = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, words.length - 1) * spaceWidth;
  let x = centerX + totalWidth / 2;
  words.forEach((word, index) => {
    const width = widths[index];
    ctx.textAlign = 'right';
    ctx.fillStyle = Number(word.position) === Number(activeWordPosition) ? highlightColor : normalColor;
    ctx.fillText(word.text, x, y);
    x -= width + spaceWidth;
  });
}


async function prepareCapturableAudio(src) {
  let response;
  try {
    response = await fetch(src, { mode: 'cors', credentials: 'omit' });
  } catch (error) {
    throw new Error(
      'The selected reciter audio cannot be captured for video export because its server blocks cross-origin downloads. Try another reciter or use a bundled/local audio source.',
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new Error(`Recitation audio download failed (${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('The selected reciter returned an empty audio file.');
  }

  const objectUrl = URL.createObjectURL(blob);
  return {
    src: objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

function createVideoRecorder(stream) {
  // WhatsApp is most reliable with an MP4 container using H.264/AVC video
  // and AAC-LC audio. Prefer an explicit mobile-friendly AVC/AAC profile,
  // then allow the browser to choose its own MP4-compatible codecs.
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs="avc1.424028,mp4a.40.2"',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];

  let lastError = null;
  for (const mimeType of candidates) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue;

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: DEFAULT_VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE,
      });

      const actualMimeType = recorder.mimeType || mimeType;
      if (!actualMimeType.toLowerCase().startsWith('video/mp4')) {
        continue;
      }

      return {
        mimeType: actualMimeType,
        recorder,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    'This browser cannot encode WhatsApp-compatible MP4 video. Update Chrome/your Android WebView and try again.',
    { cause: lastError || undefined },
  );
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
