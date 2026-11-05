import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  // The app hydrates its local database before showing the usable screen.
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, 'document should not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, 'body should not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('home screen renders its main actions and study card', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await waitForApp(page);
  await expect(page.getByRole('button', { name: /Continue Reading/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Index', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Library/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Settings/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Begin reflecting/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(pageErrors, 'app should not throw uncaught page errors').toEqual([]);
});

test('Reflect card opens the Reflect screen', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: /Begin reflecting/i }).click();
  await expect(page.getByText(/Reflect/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('home screen remains within the viewport after resizing', async ({ page }) => {
  await waitForApp(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await expectNoHorizontalOverflow(page);
});
