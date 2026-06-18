export async function generateQuranShareImage({
  surahName,
  ayahs,
  background,
  appName = 'Quran App',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  let ctx = canvas.getContext('2d');

  await document.fonts?.load('58px IndopakNastaleeq');

  const standardTextHeight = 1030;
  let fontSize = 58;
  let layout = getAyahLayout(ctx, ayahs, fontSize, 900);

  while (layout.height > standardTextHeight && fontSize > 24) {
    fontSize -= 2;
    layout = getAyahLayout(ctx, ayahs, fontSize, 900);
  }

  if (layout.height > standardTextHeight) {
    canvas.height = Math.ceil(layout.height + 470);
    ctx = canvas.getContext('2d');
  }

  const maxTextHeight = canvas.height - 470;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundedRect(ctx, 58, 58, 1084, canvas.height - 116, 54);
  ctx.fillStyle = 'rgba(255,255,255,.58)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(63, 47, 31, .16)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawRoundedRect(ctx, 84, 84, 1032, canvas.height - 168, 40);
  ctx.strokeStyle = 'rgba(63, 47, 31, .12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2d261e';
  ctx.font = '600 54px IndopakNastaleeq, serif';
  ctx.fillText(surahName, 600, 178);

  ctx.strokeStyle = 'rgba(76, 58, 37, .28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(260, 220);
  ctx.lineTo(500, 220);
  ctx.moveTo(700, 220);
  ctx.lineTo(940, 220);
  ctx.stroke();

  ctx.fillStyle = 'rgba(76, 58, 37, .72)';
  ctx.beginPath();
  ctx.moveTo(600, 203);
  ctx.lineTo(617, 220);
  ctx.lineTo(600, 237);
  ctx.lineTo(583, 220);
  ctx.closePath();
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#17130f';
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;

  let y = 300 + Math.max(0, (maxTextHeight - layout.height) / 2);
  layout.lines.forEach((line) => {
    ctx.fillText(line.text, 1040, y);
    y += line.height;
  });

  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(45, 38, 30, .62)';
  ctx.font = '600 30px Inter, ui-sans-serif, system-ui';
  ctx.fillText(appName, 600, canvas.height - 120);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Share image could not be generated.'));
    }, 'image/png');
  });
}

function getAyahLayout(ctx, ayahs, fontSize, maxWidth) {
  ctx.font = `${fontSize}px IndopakNastaleeq, serif`;
  const lineHeight = fontSize * 1.65;
  const lines = [];

  ayahs.forEach((ayah) => {
    const text = `${cleanAyahText(ayah.text)}  ۝ ${toArabicNumber(ayah.ayahNumber)}`;
    const wrapped = wrapRtlText(ctx, text, maxWidth);
    wrapped.forEach((line) => lines.push({ text: line, height: lineHeight }));
    lines.push({ text: '', height: lineHeight * .24 });
  });

  if (lines.length) lines.pop();
  return {
    lines,
    height: lines.reduce((total, line) => total + line.height, 0),
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
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}
