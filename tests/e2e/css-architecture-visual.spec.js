import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  for (const screen of ['Home', 'Index', 'Search', 'Library', 'Reflect', 'Settings', 'Reader']) {
    test(`${screen} ${theme} styling baseline`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-07T10:00:00Z'));
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      if (screen === 'Reader') await page.getByRole('button', { name: /Continue Reading/i }).click();
      else if (screen === 'Reflect') await page.getByRole('button', { name: /Begin reflecting|Continue lesson|Explore & revisit/i }).click();
      else if (screen !== 'Home') await page.getByRole('button', { name: screen, exact: true }).click();
      if (screen === 'Reader') await expect(page.locator('.reader-page').first()).toBeVisible();
      else if (screen !== 'Home') await expect(page.getByRole('heading', { name: screen, exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${screen.toLowerCase()}-${theme}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.001, timeout: 20000 });
    });
  }
}
