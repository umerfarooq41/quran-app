import { expect } from '@playwright/test';

export async function openReader(page, theme = 'light') {
  await page.addInitScript(theme => localStorage.setItem('quran-app-theme', theme), theme);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.reader-page').first()).toBeVisible();
  await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
export async function wordEvent(page, type) {
  const word = page.locator('.quran-line-ayah:not([aria-hidden="true"]) .quran-word').first();
  await word.evaluate((el, type) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
  }, type);
}
export async function mockRecitation(page, { toneHz = 0 } = {}) {
  const length = 60 * 8000, wav = Buffer.alloc(44 + length, 128);
  wav.write('RIFF',0); wav.writeUInt32LE(36+length,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);
  wav.write('data',36);wav.writeUInt32LE(length,40);
  if (toneHz) for (let index = 0; index < length; index++) wav[44 + index] = Math.round(128 + 60 * Math.sin(2 * Math.PI * toneHz * index / 8000));
  await page.route('https://audio-cdn.tarteel.ai/**', route => route.fulfill({ status:200, contentType:'audio/wav', body:wav }));
}
export async function pauseRecitation(page, expectAutoplay = true) {
  const audio = page.locator('audio.reader-audio-native');
  await expect.poll(() => audio.evaluate(el => el.readyState)).toBeGreaterThanOrEqual(1);
  // The silent unlock clip can play before the recitation source is ready.
  // Wait for real playback, then always issue Pause instead of sampling paused
  // twice across a source handoff and accidentally skipping the user action.
  if (expectAutoplay) await expect.poll(() => audio.evaluate(el => Boolean(
    el.currentSrc && !el.currentSrc.startsWith('data:') && el.readyState >= 3 && !el.paused
  ))).toBe(true);
  if (expectAutoplay || !await audio.evaluate(el => el.paused)) {
    const pause = page.getByRole('button', { name:'Pause',exact:true });
    await expect(pause).toBeVisible();
    await pause.click();
  }
  await expect.poll(() => audio.evaluate(el => el.paused)).toBe(true);
  await audio.evaluate(el => { el.currentTime = 0; });
  await expect(page.getByRole('button', { name:'Play',exact:true })).toBeVisible();
}
