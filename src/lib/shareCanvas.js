function getShareLayout(orientation = 'portrait') {
  if (orientation === 'landscape') {
    return {
      width: 1600,
      height: 900,
      frameInset: 28,
      frameRadius: 50,
      contentSideInset: 105,
      titleY: 82,
      dividerY: 128,
      dividerSideInset: 180,
      dividerGap: 72,
      bismillahY: 184,
      bodyTopWithBismillah: 242,
      bodyTopWithoutBismillah: 174,
      footerReserve: 120,
      bottomInset: 28,
      minFontSize: 34,
      maxBodyHeightBeforeShrink: 520,
    };
  }

  return {
    width: 1200,
    height: 1600,
    frameInset: 32,
    frameRadius: 54,
    contentSideInset: 88,
    titleY: 104,
    dividerY: 158,
    dividerSideInset: 142,
    dividerGap: 66,
    bismillahY: 226,
    bodyTopWithBismillah: 302,
    bodyTopWithoutBismillah: 214,
    footerReserve: 150,
    bottomInset: 34,
    minFontSize: 44,
    maxBodyHeightBeforeShrink: 1120,
  };
}

export async function generateQuranShareImage({
  surahName,
  surahNumber,
  ayahs,
  background,
  surahMeaning = '',
  orientation = 'portrait',
}) {

  if (unifiedMediaStyle) {
    return generateUnifiedShareImage({
      surahName,
      surahNumber,
      ayahs,
      surahMeaning,
      textScale,
      orientation,
    });
  }


  const SHARE_LAYOUT = getShareLayout(orientation);
  const { width, height } = SHARE_LAYOUT;
  const maxTextWidth = width - (SHARE_LAYOUT.contentSideInset * 2);

  let measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 400;
  let measureCtx = measureCanvas.getContext('2d');

  await document.fonts?.load('68px IndopakNastaleeq');
  await document.fonts?.load('30px Inter');

  let fontSize = getStartingFontSize(ayahs.length);
  let layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);

  while (layout.height > SHARE_LAYOUT.maxBodyHeightBeforeShrink && fontSize > SHARE_LAYOUT.minFontSize) {
    fontSize -= 2;
    layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);
  }

  const bodyTop = Number(surahNumber) === 9
    ? SHARE_LAYOUT.bodyTopWithoutBismillah
    : SHARE_LAYOUT.bodyTopWithBismillah;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Sand outer frame.
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Cream reading surface. One radius system is used for every export.
  const frameX = SHARE_LAYOUT.frameInset;
  const frameY = SHARE_LAYOUT.frameInset;
  const frameWidth = width - (SHARE_LAYOUT.frameInset * 2);
  const frameHeight = height - (SHARE_LAYOUT.frameInset * 2);
  drawRoundedRect(
    ctx,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    SHARE_LAYOUT.frameRadius,
  );
  ctx.fillStyle = '#fbf5e9';
  ctx.fill();
  ctx.strokeStyle = 'rgba(142, 111, 58, .24)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Surah title.
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#211c17';
  ctx.font = '600 52px IndopakNastaleeq, serif';
  ctx.fillText(`سُورَةُ ${surahName}`, width / 2, SHARE_LAYOUT.titleY - 10);

  if (surahMeaning) {
    ctx.direction = 'ltr';
    ctx.font = '500 24px Inter, ui-sans-serif, system-ui';
    ctx.fillStyle = 'rgba(55, 46, 37, .66)';
    ctx.fillText(surahMeaning, width / 2, SHARE_LAYOUT.titleY + 31);
    ctx.direction = 'rtl';
  }

  // Divider.
  const dividerY = SHARE_LAYOUT.dividerY;
  ctx.strokeStyle = 'rgba(76, 62, 45, .24)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(SHARE_LAYOUT.dividerSideInset, dividerY);
  ctx.lineTo(width / 2 - SHARE_LAYOUT.dividerGap, dividerY);
  ctx.moveTo(width / 2 + SHARE_LAYOUT.dividerGap, dividerY);
  ctx.lineTo(width - SHARE_LAYOUT.dividerSideInset, dividerY);
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, dividerY);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(76, 62, 45, .50)';
  ctx.fillRect(-13, -13, 26, 26);
  ctx.restore();

  if (Number(surahNumber) !== 9) {
    ctx.fillStyle = '#28211b';
    ctx.font = `${Math.max(48, Math.round(fontSize * .92))}px IndopakNastaleeq, serif`;
    ctx.fillText(
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      width / 2,
      SHARE_LAYOUT.bismillahY,
    );
  }

  // Continuous, centered Quran text with more confident use of the frame width.
  let contentY = bodyTop;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#17130f';
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  layout.lines.forEach((line) => {
    ctx.fillText(line.text, width / 2, contentY + line.ascent);
    contentY += line.height;
  });

  const reference = getReference(surahNumber, ayahs);
  const brandY = height - 68;
  const referenceY = brandY - 48;

  if (reference) {
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 27px Inter, ui-sans-serif, system-ui';
    ctx.fillStyle = 'rgba(55, 46, 37, .58)';
    ctx.fillText(reference, width / 2, referenceY);
  }

  const icon = await loadImage('/icons/icon-192.png');
  const iconSize = 38;
  const label = 'Al Quran';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 31px Inter, ui-sans-serif, system-ui';
  const labelWidth = ctx.measureText(label).width;
  const footerWidth = iconSize + 12 + labelWidth;
  const footerX = (width - footerWidth) / 2;

  drawImageWithoutWhite(
    ctx,
    icon,
    footerX,
    brandY - iconSize / 2,
    iconSize,
    iconSize,
  );
  ctx.fillStyle = 'rgba(47, 39, 31, .72)';
  ctx.fillText(label, footerX + iconSize + 12, brandY + 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Share image could not be generated.'));
    }, 'image/png');
  });
}

function getStartingFontSize(count) {
  if (count >= 9) return 56;
  if (count >= 7) return 59;
  if (count >= 5) return 62;
  if (count >= 3) return 66;
  return 72;
}

function getAyahLayout(ctx, ayahs, fontSize, maxWidth) {
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;
  const lineHeight = fontSize * 1.72;
  const text = ayahs
    .map((ayah) => `${cleanAyahText(ayah.text)} ۝ ${toArabicNumber(ayah.ayahNumber)}`)
    .join(' ');
  const wrapped = wrapRtlText(ctx, text, maxWidth);

  return {
    lines: wrapped.map((line) => ({
      text: line,
      height: lineHeight,
      ascent: fontSize,
    })),
    height: wrapped.length * lineHeight,
  };
}

function wrapRtlText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function getReference(surahNumber, ayahs) {
  if (!ayahs.length) return '';
  const first = ayahs[0].ayahNumber;
  const last = ayahs[ayahs.length - 1].ayahNumber;
  return first === last ? `${surahNumber}:${first}` : `${surahNumber}:${first}-${last}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image asset: ${src}`));
    image.src = src;
  });
}

function cleanAyahText(text = '') {
  return String(text)
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

function drawImageWithoutWhite(ctx, image, x, y, width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.round(width));
  offscreen.height = Math.max(1, Math.round(height));
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);

  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r > 242 && g > 242 && b > 242) pixels[i + 3] = 0;
  }
  offCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(offscreen, x, y, width, height);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}


async function generateUnifiedShareImage({
  surahName,
  surahNumber,
  ayahs,
  surahMeaning,
  textScale,
  orientation,
}) {
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 1600 : 1080;
  const height = isLandscape ? 900 : 1440;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#17473f');
  bg.addColorStop(0.55, '#103a34');
  bg.addColorStop(1, '#0b2d29');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.72, height * 0.15, 0,
    width * 0.72, height * 0.15, width * 0.65,
  );
  glow.addColorStop(0, 'rgba(234,216,184,.18)');
  glow.addColorStop(1, 'rgba(234,216,184,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.direction = 'rtl';
  ctx.font = `${Math.round((isLandscape ? 58 : 64) * textScale)}px IndopakNastaleeq, serif`;
  ctx.fillText(`سُورَةُ ${surahName}`, width / 2, height * (isLandscape ? 0.12 : 0.105));

  if (surahMeaning) {
    ctx.direction = 'ltr';
    ctx.font = `500 ${isLandscape ? 28 : 30}px Inter, ui-sans-serif, system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,.90)';
    ctx.fillText(surahMeaning, width / 2, height * (isLandscape ? 0.17 : 0.15));
  }

  const cardW = width * (isLandscape ? 0.74 : 0.88);
  const maxCardH = height * (isLandscape ? 0.56 : 0.60);
  const cardX = (width - cardW) / 2;
  const cardCenterY = height * 0.52;

  const arabicText = (ayahs || []).map((item) => item?.text || '').filter(Boolean).join('  ');
  const baseFont = (isLandscape ? 56 : 62) * textScale;
  const minFont = isLandscape ? 38 : 42;
  const maxTextW = cardW * 0.88;

  let fontSize = baseFont;
  let lines = [];
  while (fontSize >= minFont) {
    ctx.direction = 'rtl';
    ctx.font = `${Math.round(fontSize)}px IndopakNastaleeq, serif`;
    lines = wrapArabicCanvasText(ctx, arabicText, maxTextW);
    const lineHeight = fontSize * 1.72;
    if ((lines.length * lineHeight) <= maxCardH * 0.76) break;
    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.72;
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const cardH = Math.min(
    maxCardH,
    Math.max(height * (isLandscape ? 0.30 : 0.24), textHeight + (isLandscape ? 88 : 110)),
  );
  const cardY = cardCenterY - cardH / 2;

  roundedRectPathUnified(ctx, cardX, cardY, cardW, cardH, isLandscape ? 32 : 42);
  ctx.fillStyle = 'rgba(5, 22, 20, .47)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.direction = 'rtl';
  ctx.font = `${Math.round(fontSize)}px IndopakNastaleeq, serif`;
  const firstY = cardCenterY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, firstY + index * lineHeight);
  });

  const firstAyah = ayahs?.[0]?.ayahNumber;
  const lastAyah = ayahs?.[ayahs.length - 1]?.ayahNumber;
  const ref = firstAyah === lastAyah
    ? `${surahNumber}:${firstAyah}`
    : `${surahNumber}:${firstAyah}-${lastAyah}`;

  ctx.direction = 'ltr';
  ctx.font = `500 ${isLandscape ? 22 : 24}px Inter, ui-sans-serif, system-ui`;
  ctx.fillStyle = 'rgba(255,255,255,.70)';
  ctx.fillText(ref, width / 2, Math.min(height * 0.91, cardY + cardH + (isLandscape ? 42 : 54)));

  return canvasToBlobUnified(canvas);
}

function wrapArabicCanvasText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function roundedRectPathUnified(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function canvasToBlobUnified(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Image could not be generated.'));
    }, 'image/png', 1);
  });
}
