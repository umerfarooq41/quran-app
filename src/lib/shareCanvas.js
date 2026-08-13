const PORTRAIT_SIZE = Object.freeze({ width: 1080, height: 1440 });
const LANDSCAPE_SIZE = Object.freeze({ width: 1600, height: 900 });

export async function generateQuranShareImage({
  surahName,
  surahNumber,
  ayahs,
  surahMeaning = '',
  orientation = 'portrait',
  textScale = 1,
  backgroundAsset = null,
  showTranslation = false,
  translationsByAyah = {},
  translationDirection = 'ltr',
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

  drawAyahCard(ctx, {
    width,
    height,
    isLandscape,
    ayahs,
    textScale: clamp(Number(textScale) || 1, 0.75, 1.35),
    showTranslation,
    translationsByAyah,
    translationDirection,
    surahNumber,
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

function drawAyahCard(ctx, {
  width,
  height,
  isLandscape,
  ayahs,
  textScale,
  showTranslation,
  translationsByAyah,
  translationDirection,
  surahNumber,
}) {
  const cardWidth = width * (isLandscape ? 0.76 : 0.89);
  const maxCardHeight = height * (isLandscape ? 0.56 : 0.60);
  const cardX = (width - cardWidth) / 2;
  const cardCenterY = height * 0.52;

  const arabicText = (ayahs || [])
    .map((item) => String(item?.text || '').trim())
    .filter(Boolean)
    .join('  ');

  const baseFontSize = (isLandscape ? 58 : 64) * textScale;
  const minimumFontSize = isLandscape ? 34 : 38;
  const maxTextWidth = cardWidth * 0.88;

  let fontSize = baseFontSize;
  let lines = [];
  let lineHeight = fontSize * 1.72;

  while (fontSize >= minimumFontSize) {
    ctx.direction = 'rtl';
    ctx.font = `${Math.round(fontSize)}px IndopakNastaleeq, serif`;
    lines = wrapArabicText(ctx, arabicText, maxTextWidth);
    lineHeight = fontSize * 1.72;
    if ((lines.length * lineHeight) <= maxCardHeight * 0.76) break;
    fontSize -= 2;
  }

  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const translationText = showTranslation
    ? (ayahs || [])
        .map((item) => translationsByAyah?.[item.ayahNumber] || '')
        .filter(Boolean)
        .join(' ')
    : '';
  const translationFontSize = isLandscape ? 30 : 32;
  let translationLines = [];

  if (translationText) {
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.font = `500 ${translationFontSize}px Inter, ui-sans-serif, system-ui`;
    translationLines = wrapPlainText(ctx, translationText, maxTextWidth);
  }

  const translationLineHeight = translationFontSize * 1.5;
  const translationHeight = translationLines.length
    ? (translationLines.length * translationLineHeight) + 28
    : 0;
  const referenceFontSize = isLandscape ? 20 : 22;
  const referenceHeight = referenceFontSize * 1.5 + 18;

  const minimumCardHeight = height * (isLandscape ? 0.30 : 0.24);
  const cardHeight = Math.min(
    maxCardHeight,
    Math.max(
      minimumCardHeight,
      textHeight + translationHeight + referenceHeight + (isLandscape ? 72 : 90),
    ),
  );
  const cardY = cardCenterY - (cardHeight / 2);

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, isLandscape ? 32 : 42);
  ctx.fillStyle = 'rgba(5, 22, 20, .48)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const combinedContentHeight = textHeight + translationHeight + referenceHeight;
  let cursorY = cardCenterY - (combinedContentHeight / 2) + (lineHeight / 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(fontSize)}px IndopakNastaleeq, serif`;

  lines.forEach((line) => {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += lineHeight;
  });

  if (translationLines.length) {
    cursorY += 14;
    ctx.direction = translationDirection === 'rtl' ? 'rtl' : 'ltr';
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `500 ${translationFontSize}px Inter, ui-sans-serif, system-ui`;

    translationLines.forEach((line) => {
      ctx.fillText(line, width / 2, cursorY);
      cursorY += translationLineHeight;
    });
  }

  const firstAyah = ayahs?.[0]?.ayahNumber;
  if (firstAyah) {
    cursorY += 10;
    ctx.direction = 'ltr';
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = `500 ${referenceFontSize}px Inter, ui-sans-serif, system-ui`;
    ctx.fillText(`${surahNumber}:${firstAyah}`, width / 2, cursorY);
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
