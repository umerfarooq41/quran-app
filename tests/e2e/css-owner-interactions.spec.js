import { holdWord } from './fixtures/reader-ui.js';
import { test, expect } from '@playwright/test';
import { seedLocalRecords } from './fixtures/local-records.js';

async function home(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
}
async function roleColor(page, token) {
  return page.evaluate(token => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}
for (const theme of ['light','dark']) {
  test(`Reflect saved cards and editable answers use neutral ${theme} surfaces`, async ({ page }) => {
    await home(page);
    await seedLocalRecords(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    await page.getByRole('button', { name: /Begin reflecting|Continue lesson|Explore & revisit/i }).click();
    const card = page.locator('.reflect-screen .tab-card-surface').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('background-color', await roleColor(page, '--ui-card-bg'));
    await page.getByRole('button', { name: 'QA saved lesson' }).click();
    await expect(page.locator('#reflect-lesson-title')).toBeVisible();
    const passage = page.locator('.reflect-passage-section');
    await expect(passage).toBeVisible();
    await expect(passage).toHaveCSS('background-color', await roleColor(page, '--ui-card-bg'));
    expect(parseFloat(await passage.evaluate(el => getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(14);
    const answer = page.locator('#reflect-imagine');
    await expect(answer).toHaveCSS('background-color', await roleColor(page, '--ui-control-bg'));
    await answer.fill(`Neutral ${theme} answer`);
    await expect(answer).toHaveValue(`Neutral ${theme} answer`);
  });
  test(`Help disclosures use shared ${theme} surfaces`, async ({ page }) => {
    await home(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Help and guide/i }).click();
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    await expect(page.locator('.help-section').first()).toHaveCSS('background-color', await roleColor(page, '--ui-card-bg'));
    const trigger = page.locator('.help-section-trigger').first();
    const expanded = await trigger.getAttribute('aria-expanded');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', expanded === 'true' ? 'false' : 'true');
  });
}

test('Reader ayah actions open Share Quran and produce a PNG export', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  const word = page.locator('.quran-line-ayah:not([aria-hidden="true"]) .quran-word').first();
  await expect(word).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await holdWord(page, word);
  await expect(page.getByRole('toolbar', { name: 'Ayah actions' })).toBeVisible();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Share Quran', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(page.locator('.share-image-preview-stage img')).toBeVisible();
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'Download Image', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(await download.failure()).toBeNull();
  await page.getByRole('button', { name: 'Video', exact: true }).click();
  await expect(page.locator('.share-video-preview-stage')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play video preview', exact: true })).toBeVisible();
});
