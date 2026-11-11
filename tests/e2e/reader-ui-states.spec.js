import { test, expect } from '@playwright/test';
import { openReader, wordEvent, mockRecitation, pauseRecitation } from './fixtures/reader-ui.js';
import { seedLocalRecords } from './fixtures/local-records.js';
const shot = { animations:'disabled', maxDiffPixelRatio:0.001, timeout:20000 };
for(const theme of ['light','dark']) {
  test(`Reader chrome and annotations ${theme}`, async ({ page }) => {
    await openReader(page,theme);
    await seedLocalRecords(page);
    await page.reload();
    await expect(page.locator('.reader-page').first()).toBeVisible();
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    await page.evaluate(()=>document.fonts.ready);
    await expect(page).toHaveScreenshot(`reader-annotations-${theme}.png`,shot);
    await page.locator('[data-reader-toggle-zone]').first().click({force:true});
    await expect(page.locator('.reader-listen-pill')).toBeVisible();
    await expect(page).toHaveScreenshot(`reader-chrome-${theme}.png`,shot);
  });
  test(`Reader player states ${theme}`, async ({ page }) => {
    await mockRecitation(page);await openReader(page,theme);
    await page.locator('[data-reader-toggle-zone]').first().click({force:true});
    await page.locator('.reader-listen-pill').click();
    await pauseRecitation(page);
    const panel = page.locator('.reader-audio-expanded-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveScreenshot(`audio-expanded-${theme}.png`,shot);
    await page.getByRole('button',{name:/^Reciters:/}).click();
    await expect(page.getByRole('listbox',{name:'Reciters'})).toBeVisible();
    await expect(panel).toHaveScreenshot(`audio-reciter-picker-${theme}.png`,shot);
    await page.getByRole('option').nth(1).click();
    await pauseRecitation(page,false);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.getByRole('button',{name:'Repeat off'}).click();
    await page.getByRole('button',{name:'Playback speed'}).click();
    await expect(panel).toHaveScreenshot(`audio-selected-controls-${theme}.png`,shot);
    await page.getByRole('button',{name:'Collapse audio player'}).click();
    await expect(page.locator('.reader-audio-mini-panel')).toBeVisible();
    if (await page.locator('.reader-screen-spread').count()) {
      const player = await page.locator('.reader-audio-mini-panel').boundingBox();
      for (const footer of await page.locator('.reader-page-slide-current .reader-footer-meta').all()) {
        const box = await footer.boundingBox();
        expect(box.y + box.height, 'spread metadata must remain above the shared media dock').toBeLessThanOrEqual(player.y);
      }
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect(page).toHaveScreenshot(`audio-collapsed-${theme}.png`,shot);
    await page.getByRole('button',{name:'Expand audio player'}).click();
    await expect(page.getByRole('button',{name:'Close audio player'})).toBeVisible();
    await page.getByRole('button',{name:'Close audio player'}).click();
    await expect(page.locator('.reader-audio-panel-wrap')).toHaveCount(0);
  });
  test(`Reader translation panel ${theme}`, async ({ page }) => {
    await openReader(page,theme);await wordEvent(page,'click');
    const sheet = page.locator('.ayah-translation-card');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.ayah-translation-text')).not.toBeEmpty({timeout:20000});
    await expect(sheet).toHaveScreenshot(`translation-${theme}.png`,shot);
    await page.getByRole('button',{name:'Next Ayah',exact:true}).click();
    await expect(sheet.locator('.ayah-translation-text')).toBeVisible();
    await expect(sheet).toHaveScreenshot(`translation-next-${theme}.png`,shot);
  });
  test(`Share Quran UI states ${theme}`, async ({ page }) => {
    await openReader(page,theme);await wordEvent(page,'contextmenu');
    await page.getByRole('button',{name:'Share',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Share Quran'})).toBeVisible();
    await page.getByRole('button',{name:'Image',exact:true}).click();
    await expect(page.locator('.quran-share-generated-image')).toBeVisible();
    await expect(page.locator('.share-media-mode-switch')).toHaveScreenshot(`share-mode-${theme}.png`,shot);
    await expect(page.locator('.share-media-settings-card')).toHaveScreenshot(`share-audio-settings-${theme}.png`,shot);
    await page.getByRole('navigation',{name:'Share Quran media settings'}).getByRole('button',{name:'Text',exact:true}).click();
    await expect(page.locator('.share-media-settings-card')).toHaveScreenshot(`share-text-settings-${theme}.png`,shot);
    await page.getByRole('button',{name:'Video',exact:true}).click();
    await page.evaluate(()=>document.querySelectorAll('video').forEach(v=>{v.pause();v.currentTime=0;v.style.visibility='hidden';}));
    await expect(page.getByRole('button',{name:'Fullscreen preview',exact:true})).toBeVisible();
    await expect(page.locator('.share-video-preview-controls')).toHaveScreenshot(`share-video-controls-${theme}.png`,shot);
    await page.getByRole('button',{name:'Fullscreen preview',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Video export preview'})).toBeVisible();
    await page.getByRole('button',{name:'Exit fullscreen preview'}).click();
    await expect(page.getByRole('dialog',{name:'Video export preview'})).toHaveCount(0);
  });
}
