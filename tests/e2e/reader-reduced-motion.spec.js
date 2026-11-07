import { test, expect } from '@playwright/test';
import { openReader, mockRecitation, pauseRecitation } from './fixtures/reader-ui.js';

test('reduced-motion preferences suppress page and player phase animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await mockRecitation(page);await openReader(page);
  const viewport = page.locator('.reader-page-slide-viewport');
  for(const direction of ['is-next','is-previous']) {
    const name=await viewport.evaluate((el,direction)=>{
      el.classList.add('is-transitioning',direction);
      const result=getComputedStyle(el.querySelector('.reader-page-slide-current')).animationName;
      el.classList.remove('is-transitioning',direction);return result;
    },direction);
    expect(name).toBe('none');
  }
  await page.locator('[data-reader-toggle-zone]').first().click({force:true});
  await page.locator('.reader-listen-pill').click();await pauseRecitation(page);
  const animations=await page.locator('.reader-audio-panel-wrap').evaluate(el=>{
    el.classList.add('reader-audio-panel-transitioning');
    const result=[...el.querySelectorAll('.reader-audio-panel-modern')].map(p=>getComputedStyle(p).animationName);
    el.classList.remove('reader-audio-panel-transitioning');return result;
  });
  expect(animations).toEqual(['none','none']);
});
