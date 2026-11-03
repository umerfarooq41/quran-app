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
  for (const name of [/Continue Reading/i, /Index/i, /Search/i, /Library/i, /Settings/i, /Reflect.*Study Ayahs/i]) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expectHealthyVisibleUI(page);
  expect(pageErrors).toEqual([]);
});

test('Reflect opens and its passage selection controls are usable', async ({ page }) => {
  await waitForHome(page);
  await page.getByRole('button', { name: /Reflect.*Study Ayahs/i }).click();
  await expect(page.getByRole('heading', { name: 'Reflect' })).toBeVisible();
  await page.getByRole('button', { name: 'New study' }).click();
  await expect(page.getByRole('heading', { name: 'New study' })).toBeVisible();
  await expect(page.getByLabel('Surah')).toBeVisible();
  await expect(page.getByLabel('Start Ayah')).toBeVisible();
  await expect(page.getByLabel('End Ayah')).toBeVisible();
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

test('Qur’an dataset has 114 ordered Surahs and intact 16-line Mushaf pages', async ({ page }) => {
  await page.goto('/');
  const integrity = await page.evaluate(async () => {
    const quran = await import('/src/lib/quran.js');
    const surahChecks = quran.surahs.map((surah) => {
      const verses = quran.getSurahAyahs(surah.number);
      return {
        number: surah.number,
        expected: surah.verses,
        actual: verses.length,
        ordered: verses.every((ayah, index) => ayah.ayahNumber === index + 1),
      };
    });
    const pageChecks = quran.quranPages.map((mushafPage) => ({
      page: mushafPage.page,
      lines: mushafPage.lines.length,
    }));
    const ayahChecks = quran.quranAyahs.map((ayah) => {
      const pageNumber = quran.findPageForReference(ayah.surahNumber, ayah.ayahNumber);
      const resolvedPage = quran.getPage(pageNumber);
      return {
        reference: `${ayah.surahNumber}:${ayah.ayahNumber}`,
        valid: pageNumber >= 1
          && pageNumber <= quran.totalPages
          && resolvedPage.lines.some((line) => line.surahNumber === ayah.surahNumber
            && line.ayahStart !== null
            && ayah.ayahNumber >= line.ayahStart
            && ayah.ayahNumber <= line.ayahEnd),
      };
    });
    return {
      surahCount: quran.surahs.length,
      uniqueSurahCount: new Set(quran.surahs.map((surah) => surah.number)).size,
      totalPages: quran.totalPages,
      pageCount: quran.quranPages.length,
      surahChecks,
      pageChecks,
      ayahChecks,
    };
  });

  expect(integrity.surahCount).toBe(114);
  expect(integrity.uniqueSurahCount).toBe(114);
  expect(integrity.pageCount).toBe(integrity.totalPages);
  expect(integrity.surahChecks.filter((surah) => surah.expected !== surah.actual || !surah.ordered)).toEqual([]);
  expect(integrity.pageChecks.filter((mushafPage) => mushafPage.lines !== 16)).toEqual([]);
  expect(integrity.ayahChecks.filter((ayah) => !ayah.valid)).toEqual([]);
});
