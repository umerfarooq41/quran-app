const SHARE_LAYOUT = {
  width: 1200,
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
  maxBodyHeightBeforeShrink: 1450,
};

export async function generateQuranShareImage({
  surahName,
  surahNumber,
  ayahs,
  background,
}) {
  const { width } = SHARE_LAYOUT;
  const maxTextWidth = width - (SHARE_LAYOUT.contentSideInset * 2);

  let measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 400;
  let measureCtx = measureCanvas.getContext('2d');

  await document.fonts?.load('68px IndopakNastaleeq');
  await document.fonts?.load('30px Inter');

  let fontSize = getStartingFontSize(ayahs.length);
  let layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);

  while (layout.height > SHARE_LAYOUT.maxBodyHeightBeforeShrink && fontSize > 46) {
    fontSize -= 2;
    layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);
  }

  const bodyTop = Number(surahNumber) === 9
    ? SHARE_LAYOUT.bodyTopWithoutBismillah
    : SHARE_LAYOUT.bodyTopWithBismillah;
  const contentBottom = bodyTop + layout.height;
  const height = Math.max(
    760,
    Math.ceil(contentBottom + SHARE_LAYOUT.footerReserve + SHARE_LAYOUT.bottomInset),
  );

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
  ctx.fillText(`سُورَةُ ${surahName}`, width / 2, SHARE_LAYOUT.titleY);

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
