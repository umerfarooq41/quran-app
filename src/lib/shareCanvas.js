export async function generateAyahImage({ reference, text }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 680);
  gradient.addColorStop(0, '#eef7ff');
  gradient.addColorStop(0.55, '#ffffff');
  gradient.addColorStop(1, '#e9f7ef');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.roundRect(70, 70, 1060, 540, 34);
  ctx.fill();
  ctx.fillStyle = '#18324a';
  ctx.font = '44px Inter, sans-serif';
  ctx.fillText(reference, 110, 145);
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#12263a';
  ctx.font = '64px IndopakNastaleeq, serif';
  wrapText(ctx, text, 1080, 250, 980, 100);
  return canvas.toDataURL('image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}
