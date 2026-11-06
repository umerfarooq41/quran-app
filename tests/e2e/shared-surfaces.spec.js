import { test, expect } from '@playwright/test';

async function home(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
}

test('shared glass surfaces keep distinct card and control roles', async ({ page }) => {
  await home(page);
  const result = await page.evaluate(() => {
    const card = document.querySelector('.home-action-chip');
    const style = getComputedStyle(card);
    const root = getComputedStyle(document.documentElement);
    return {
      cardBackground: style.backgroundColor,
      cardBorder: style.borderTopColor,
      tokenCard: root.getPropertyValue('--ui-card-bg').trim(),
      tokenControl: root.getPropertyValue('--ui-control-bg').trim(),
      brandGradient: root.getPropertyValue('--brand-bg-light').trim(),
      heroBackground: getComputedStyle(document.querySelector('.home-hero-card')).backgroundImage,
    };
  });
  expect(result.cardBackground).toBe('rgba(255, 255, 255, 0.66)');
  expect(result.tokenCard).not.toBe(result.tokenControl);
  expect(result.brandGradient).toContain('#fdf8ef');
  expect(result.heroBackground).toContain('linear-gradient');
});

test('Index, Search and Settings retain warm glass surfaces', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(page.locator('.index-card').first()).toBeVisible();
  await expect(page.locator('.index-card').first()).toHaveCSS('backdrop-filter', /blur\(16px\)/);
  await page.getByRole('button', { name: 'Back from index' }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.search-form')).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.42)');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-card').first()).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.66)');
});

test('Reader Mushaf stays sixteen lines after opening from Home', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  const mushaf = page.locator('.reader-page').first();
  await expect(mushaf).toBeVisible();
  await expect.poll(() => mushaf.evaluate(el => getComputedStyle(el).gridTemplateRows.split(' ').length)).toBe(16);
});

test('Reflect selected tabs do not animate through low-contrast intermediate colors', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: /Begin reflecting/i }).click();
  const tabs = page.getByRole('tablist', { name: 'Reflect library' });
  await expect(tabs).toBeVisible();
  const selected = tabs.getByRole('tab', { selected: true });
  const transition = await selected.evaluate(element => {
    const style = getComputedStyle(element);
    return { properties: style.transitionProperty.split(',').map(value => value.trim()), background: style.backgroundColor };
  });
  expect(transition.properties).not.toContain('background-color');
  expect(transition.properties).not.toContain('color');
  expect(transition.properties).not.toContain('all');
  expect(transition.background).toBe('rgb(36, 93, 78)');
});
