const PORTRAIT_SIZE = Object.freeze({ width: 1080, height: 1920 });
const LANDSCAPE_SIZE = Object.freeze({ width: 1600, height: 900 });
const BISMILLAH_TEXT = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

export async function generateQuranShareImage({
  surahName,
  surahNumber,
  ayahs,
  surahMeaning = '',
  orientation = 'portrait',
  textScale = 1,
  translationScale = 1,
  backgroundAsset = null,
  showTranslation = false,
  translationsByAyah = {},
  translationDirection = 'ltr',
  showBismillah = false,
}) {
  const isLandscape = orientation === 'landscape';
  const { width, height } = isLandscape ? LANDSCAPE_SIZE : PORTRAIT_SIZE;

  await Promise.all([
    document.fonts?.load?.('64px IndopakNastaleeq'),
    document.fonts?.load?.('30px Inter'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  await drawBackground(ctx, {
    width,
    height,
    imageSrc: backgroundAsset?.imageSrc || '',
  });

  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, 'rgba(4, 18, 17, .26)');
  overlay.addColorStop(0.45, 'rgba(4, 18, 17, .40)');
  overlay.addColorStop(1, 'rgba(4, 18, 17, .50)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  drawSurahHeader(ctx, {
    width,
    height,
    isLandscape,
    surahName,
    surahMeaning,
  });

  if (showBismillah) {
    drawBismillah(ctx, { width, height, isLandscape, textScale });
  }

  drawAyahCard(ctx, {
    width,
    height,
    isLandscape,
    ayahs,
    textScale: clamp(Number(textScale) || 1, 0.75, 1.35),
    translationScale: clamp(Number(translationScale) || 1, 0.75, 1.35),
    showTranslation,
    translationsByAyah,
    translationDirection,
    surahNumber,
    showBismillah,
  });
return canvasToBlob(canvas);
}

async function drawBackground(ctx, { width, height, imageSrc }) {
  if (imageSrc) {
    try {
      const image = await loadImage(imageSrc);
      drawImageCover(ctx, image, 0, 0, width, height);
      return;
    } catch {
      // Keep image generation usable if an asset is missing.
    }
  }

  const fallback = ctx.createLinearGradient(0, 0, width, height);
  fallback.addColorStop(0, '#17473f');
  fallback.addColorStop(0.55, '#103a34');
  fallback.addColorStop(1, '#0b2d29');
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, width, height);
}

function drawSurahHeader(ctx, { width, height, isLandscape, surahName, surahMeaning }) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.direction = 'rtl';
  ctx.font = `700 ${isLandscape ? 58 : 64}px IndopakNastaleeq, serif`;

  ctx.fillText(
    `سُورَةُ ${surahName}`,
    width / 2,
    height * (isLandscape ? 0.12 : 0.105),
  );

  if (surahMeaning) {
    ctx.direction = 'ltr';
    ctx.font = `500 ${isLandscape ? 28 : 30}px Inter, ui-sans-serif, system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,.90)';
    ctx.fillText(
      surahMeaning,
      width / 2,
      height * (isLandscape ? 0.175 : 0.153),
    );
  }
}

function drawBismillah(ctx, { width, height, isLandscape, textScale }) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  const fontSize = (isLandscape ? 58 : 64) * clamp(Number(textScale) || 1, 0.75, 1.35);
  ctx.font = `${Math.round(fontSize)}px IndopakNastaleeq, serif`;
  ctx.fillText(
    BISMILLAH_TEXT,
    width / 2,
    height * (isLandscape ? 0.225 : 0.205),
  );
}

function drawAyahCard(ctx, {
  width,
  height,
  isLandscape,
  ayahs,
  textScale,
  translationScale,
  showTranslation,
  translationsByAyah,
  translationDirection,
  surahNumber,
  showBismillah = false,
}) {
  const cardWidth = width * (isLandscape ? 0.82 : 0.89);
  const cardX = (width - cardWidth) / 2;

  // The title owns the top of the composition. The text card never enters it.
  const safeTop = height * (showBismillah
    ? (isLandscape ? 0.285 : 0.255)
    : (isLandscape ? 0.225 : 0.205));
  const safeBottom = height * (isLandscape ? 0.94 : 0.94);
  const maxCardHeight = safeBottom - safeTop;
  const maxTextWidth = cardWidth * 0.88;

  const arabicText = (ayahs || [])
    .map((item) => String(item?.text || '').trim())
    .filter(Boolean)
    .join('  ');
  const translationText = showTranslation
    ? (ayahs || [])
        .map((item) => translationsByAyah?.[item.ayahNumber] || '')
        .filter(Boolean)
        .join(' ')
    : '';

  const requestedArabicFont = (isLandscape ? 58 : 64) * textScale;
  const requestedTranslationFont = (isLandscape ? 30 : 32) * translationScale;
  const minimumArabicFont = isLandscape ? 27 : 30;
  const minimumTranslationFont = isLandscape ? 17 : 18;
  let referenceFontSize = showTranslation ? requestedTranslationFont : requestedArabicFont;
  let referenceHeight = referenceFontSize * 1.5 + 16;
  const verticalPadding = isLandscape ? 58 : 72;

  let arabicFont = requestedArabicFont;
  let translationFont = requestedTranslationFont;
  let lines = [];
  let translationLines = [];
  let lineHeight = 0;
  let translationLineHeight = 0;
  let contentHeight = 0;

  const measure = () => {
    ctx.direction = 'rtl';
    ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;
    lines = wrapArabicText(ctx, arabicText, maxTextWidth);
    lineHeight = arabicFont * 1.66;

    translationLines = [];
    translationLineHeight = translationFont * 1.46;
    if (translationText) {
      ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
      ctx.font = `500 ${Math.round(translationFont)}px Inter, ui-sans-serif, system-ui`;
      translationLines = wrapPlainText(ctx, translationText, maxTextWidth);
    }

    referenceFontSize = translationText ? translationFont : arabicFont;
    referenceHeight = referenceFontSize * 1.5 + 16;

    const arabicHeight = Math.max(lineHeight, lines.length * lineHeight);
    const translationHeight = translationLines.length
      ? 18 + (translationLines.length * translationLineHeight)
      : 0;
    contentHeight = arabicHeight + translationHeight + referenceHeight;
    return contentHeight + verticalPadding;
  };

  let requiredHeight = measure();
  let guard = 0;
  while (requiredHeight > maxCardHeight && guard < 80) {
    guard += 1;
    const canReduceArabic = arabicFont > minimumArabicFont;
    const canReduceTranslation = translationText && translationFont > minimumTranslationFont;
    if (!canReduceArabic && !canReduceTranslation) break;

    if (canReduceArabic) arabicFont = Math.max(minimumArabicFont, arabicFont - 1.5);
    if (canReduceTranslation) translationFont = Math.max(minimumTranslationFont, translationFont - 1);
    requiredHeight = measure();
  }

  const minimumCardHeight = height * (isLandscape ? 0.26 : 0.22);
  const cardHeight = Math.min(maxCardHeight, Math.max(minimumCardHeight, requiredHeight));

  // Match video positioning: start centered, grow symmetrically, then lock
  // the top edge at the protected Surah-title area and continue downward.
  const compositionCenterY = height / 2;
  const centeredCardY = compositionCenterY - (cardHeight / 2);
  const symmetricHeightBeforeTitle = Math.max(0, (compositionCenterY - safeTop) * 2);
  const cardY = cardHeight <= symmetricHeightBeforeTitle
    ? centeredCardY
    : safeTop;
  const cardCenterY = cardY + (cardHeight / 2);

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, isLandscape ? 24 : 28);
  ctx.fillStyle = 'rgba(4, 19, 18, .42)';
  ctx.fill();

  const arabicHeight = Math.max(lineHeight, lines.length * lineHeight);
  const translationHeight = translationLines.length
    ? 18 + (translationLines.length * translationLineHeight)
    : 0;
  const combinedContentHeight = arabicHeight + translationHeight + referenceHeight;
  let cursorY = cardCenterY - (combinedContentHeight / 2) + (lineHeight / 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(arabicFont)}px IndopakNastaleeq, serif`;

  lines.forEach((line) => {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += lineHeight;
  });

  if (translationLines.length) {
    cursorY += 12;
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `500 ${Math.round(translationFont)}px Inter, ui-sans-serif, system-ui`;
    translationLines.forEach((line) => {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += translationLineHeight;
    });
  }

  const firstAyah = ayahs?.[0]?.ayahNumber;
  const lastAyah = ayahs?.[ayahs.length - 1]?.ayahNumber;
  if (firstAyah) {
    const reference = Number(lastAyah) > Number(firstAyah)
      ? `${surahNumber}:${firstAyah}-${lastAyah}`
      : `${surahNumber}:${firstAyah}`;
    cursorY += 8;
    ctx.direction = 'ltr';
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = `500 ${referenceFontSize}px Inter, ui-sans-serif, system-ui`;
    ctx.fillText(reference, width / 2, cursorY);
  }
}


function wrapArabicText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function wrapPlainText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let currentLine = '';
  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawImageCover(ctx, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Background image failed to load: ${src}`));
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Image could not be generated.'));
    }, 'image/png', 1);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
