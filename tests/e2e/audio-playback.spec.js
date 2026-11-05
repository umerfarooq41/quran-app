import { test, expect } from '@playwright/test';

function createSilentWav(durationSeconds = 60, sampleRate = 8000) {
  const dataLength = durationSeconds * sampleRate;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataLength, 40);
  wav.fill(128, 44);
  return wav;
}

test('Reader audio loads, plays, pauses, seeks, repeats and changes speed', async ({ page }) => {
  const audioRequests = [];
  const wav = createSilentWav();

  await page.route('https://audio-cdn.tarteel.ai/**', async (route) => {
    audioRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'audio/wav',
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      },
      body: wav,
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.reader-page').first()).toBeVisible();

  await page.locator('.reader-listen-pill').click({ force: true });
  await expect(page.locator('.reader-audio-panel-wrap')).toBeVisible({ timeout: 15000 });

  const audio = page.locator('audio.reader-audio-native');
  await expect.poll(() => audioRequests.length).toBeGreaterThan(0);
  await expect.poll(() => audio.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeGreaterThan(0);
  expect(audioRequests.length).toBeGreaterThan(0);

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => audio.evaluate((element) => element.paused)).toBe(true);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.paused)).toBe(false);

  const progress = page.getByRole('slider', { name: 'Audio progress' });
  await progress.focus();
  await progress.press('ArrowRight');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Repeat off' }).click();
  await expect(page.getByRole('button', { name: 'Repeat current ayah' })).toBeVisible();
  await page.getByRole('button', { name: 'Repeat current ayah' }).click();
  await expect(page.getByRole('button', { name: 'Repeat current Surah' })).toBeVisible();

  await page.getByRole('button', { name: 'Playback speed' }).click();
  await expect.poll(() => audio.evaluate((element) => element.playbackRate)).toBe(1.25);
});
