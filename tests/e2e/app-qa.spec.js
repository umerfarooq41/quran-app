import { test, expect } from '@playwright/test';

async function waitForHome(page) {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, 'document horizontal overflow').toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, 'body horizontal overflow').toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectHealthyVisibleUI(page) {
  const audit = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const brokenImages = [...document.images]
      .filter((image) => visible(image) && image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const emptyControls = [...document.querySelectorAll('button, a, input, select, textarea')]
      .filter(visible)
      .filter((element) => !element.closest('[aria-hidden="true"]'))
      .filter((element) => {
        const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.value || '';
        return !String(label).trim();
      })
      .map((element) => element.outerHTML.slice(0, 180));
    const offscreenControls = [...document.querySelectorAll('button, a, input, select, textarea')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right < -1 || rect.left > innerWidth + 1;
      })
      .map((element) => element.outerHTML.slice(0, 180));
    return { brokenImages, duplicateIds, emptyControls, offscreenControls };
  });

  expect(audit.brokenImages, 'visible images should load').toEqual([]);
  expect(audit.duplicateIds, 'DOM IDs should be unique').toEqual([]);
  expect(audit.emptyControls, 'visible controls should have accessible names').toEqual([]);
  expect(audit.offscreenControls, 'visible controls should not be horizontally offscreen').toEqual([]);
  await expectNoHorizontalOverflow(page);
}

test('home renders the main actions and Reflect card without browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await waitForHome(page);
  await expect(page.getByRole('button', { name: /Continue Reading/i })).toBeVisible();
  for (const name of ['Index', 'Search', 'Library', 'Settings']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Reflect.*Study Ayahs/i })).toBeVisible();
  await expectHealthyVisibleUI(page);
  expect(pageErrors).toEqual([]);
});

test('Reflect opens and its passage selection controls are usable', async ({ page }) => {
  await waitForHome(page);
  await page.getByRole('button', { name: /Reflect.*Study Ayahs/i }).click();
  await expect(page.getByRole('heading', { name: 'Reflect', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New study' }).click();
  await expect(page.getByRole('heading', { name: 'New study' })).toBeVisible();
  const passageSelects = page.locator('select');
  await expect(passageSelects).toHaveCount(3);
  await expect(passageSelects.nth(0)).toBeVisible();
  await expect(passageSelects.nth(1)).toBeVisible();
  await expect(passageSelects.nth(2)).toBeVisible();
  await expectHealthyVisibleUI(page);
});

test('Index, Search, Library and Settings screens open and remain responsive', async ({ page }) => {
  await waitForHome(page);

  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Index' })).toBeVisible();
  await expectHealthyVisibleUI(page);

  await page.getByRole('button', { name: 'Back from index' }).click();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  await expectHealthyVisibleUI(page);

  await page.getByRole('button', { name: /Back/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expectHealthyVisibleUI(page);

  await page.getByRole('button', { name: 'Back from library' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expectHealthyVisibleUI(page);
});

test('reader preserves the 16-row Mushaf grid and loads its Arabic font', async ({ page }) => {
  await waitForHome(page);
  await page.getByRole('button', { name: /Continue Reading/i }).click();

  const mushaf = page.locator('.reader-page').first();
  await expect(mushaf).toBeVisible({ timeout: 15000 });
  await expect.poll(() => mushaf.evaluate((element) => getComputedStyle(element).gridTemplateRows.split(' ').length)).toBe(16);

  const fontStatus = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px IndopakNastaleeq', 'اللَّهُ');
  });
  expect(fontStatus, 'IndoPak Nastaleeq font should be available').toBe(true);
  await expectHealthyVisibleUI(page);
});

test('mobile, narrow-mobile, tablet and desktop layouts have no horizontal overflow', async ({ page }) => {
  await waitForHome(page);
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1365, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }
});

