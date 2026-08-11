export async function generateQuranShareImage({
  surahName,
  surahNumber,
  ayahs,
  background,
}) {
  const width = 1200;
  const maxTextWidth = 930;
  const headerTop = 82;
  const headerHeight = 94;
  const bismillahHeight = Number(surahNumber) === 9 ? 0 : 92;
  const textTopGap = 34;
  const footerHeight = 118;
  const bottomPadding = 72;

  let measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 400;
  let measureCtx = measureCanvas.getContext('2d');

  await document.fonts?.load('58px IndopakNastaleeq');
  await document.fonts?.load('30px Inter');

  let fontSize = ayahs.length >= 8 ? 42 : ayahs.length >= 5 ? 48 : ayahs.length >= 3 ? 54 : 60;
  let layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);

  while (layout.height > 1050 && fontSize > 34) {
    fontSize -= 2;
    layout = getAyahLayout(measureCtx, ayahs, fontSize, maxTextWidth);
  }

  const contentHeight = headerTop + headerHeight + bismillahHeight + textTopGap + layout.height + footerHeight + bottomPadding;
  const height = Math.max(700, Math.ceil(contentHeight));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 42, 42, width - 84, height - 84, 48);
  ctx.fillStyle = 'rgba(255,255,255,.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(63, 47, 31, .14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const borderImage = await loadImage('/border/Border Quran-01.svg');
  const borderWidth = 930;
  const borderHeight = borderWidth * (120 / 1200);
  const borderX = (width - borderWidth) / 2;
  ctx.drawImage(borderImage, borderX, headerTop, borderWidth, borderHeight);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#211c17';
  ctx.font = '600 50px IndopakNastaleeq, serif';
  ctx.fillText(surahName, width / 2, headerTop + borderHeight / 2 + 2);

  let contentY = headerTop + borderHeight + 24;

  if (Number(surahNumber) !== 9) {
    ctx.fillStyle = '#2a241e';
    ctx.font = '48px IndopakNastaleeq, serif';
    ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', width / 2, contentY + 32);
    contentY += bismillahHeight;
  }

  contentY += textTopGap;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#17130f';
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  layout.lines.forEach((line) => {
    ctx.fillText(line.text, width / 2, contentY + line.ascent);
    contentY += line.height;
  });

  const footerY = height - 82;
  const icon = await loadImage('/icons/icon-192.png');
  const iconSize = 42;
  const label = 'Al Quran';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 30px Inter, ui-sans-serif, system-ui';
  const labelWidth = ctx.measureText(label).width;
  const footerWidth = iconSize + 14 + labelWidth;
  const footerX = (width - footerWidth) / 2;
  ctx.drawImage(icon, footerX, footerY - iconSize / 2, iconSize, iconSize);
  ctx.fillStyle = 'rgba(45, 38, 30, .68)';
  ctx.fillText(label, footerX + iconSize + 14, footerY + 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Share image could not be generated.'));
    }, 'image/png');
  });
}

function getAyahLayout(ctx, ayahs, fontSize, maxWidth) {
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;
  const lineHeight = fontSize * 1.75;
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
