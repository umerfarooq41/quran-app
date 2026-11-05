import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function auditPage(page, screenName) {
  // Wait for screen transitions before measuring computed color contrast.
  await page.waitForFunction(() => [...document.getAnimations()].filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length === 0, null, { timeout: 5000 }).catch(() => {});
  let results;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      break;
    } catch (error) {
      if (attempt === 2 || !/Execution context was destroyed|navigation/i.test(String(error))) throw error;
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#root')).not.toBeEmpty();
    }
  }

  const serious = results.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ));

  expect(
    serious.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
    `${screenName} should not have critical or serious accessibility violations`,
  ).toEqual([]);
}

test('Home and Reader meet critical WCAG accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
  await auditPage(page, 'Home');

  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.reader-page').first()).toBeVisible();
  await auditPage(page, 'Reader');
});

test('Index, Reflect and Settings meet critical WCAG accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();

  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Index' })).toBeVisible();
  await auditPage(page, 'Index');

  await page.getByRole('button', { name: 'Back from index' }).click();
  await page.getByRole('button', { name: /My Quran Studies/i }).click();
  await expect(page.getByRole('heading', { name: 'Reflect', exact: true })).toBeVisible();
  await auditPage(page, 'Reflect');

  await page.getByRole('button', { name: 'Back from Reflect' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await auditPage(page, 'Settings');
});
