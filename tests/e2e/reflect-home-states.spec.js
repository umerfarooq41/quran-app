import { test, expect } from '@playwright/test';
import { seedLocalRecords } from './fixtures/local-records.js';

for (const state of ['empty', 'unfinished', 'completed']) {
  test(`Reflect home ${state}`, async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
    if (state !== 'empty') {
      await seedLocalRecords(page);
      await page.evaluate(async (state) => {
        const db = await new Promise(resolve => {
          const request = indexedDB.open('quranFluentLocal');
          request.onsuccess = () => resolve(request.result);
        });
        const tx = db.transaction('tadabburLessons', 'readwrite');
        const store = tx.objectStore('tadabburLessons');
        const request = store.get('qa-reflect-lesson');
        request.onsuccess = () => {
          const lesson = request.result;
          store.put({ ...lesson, status: state === 'completed' ? 'completed' : 'in-progress', updatedAt: 2 });
          store.put({ ...lesson, id: 'older', surahNumber: 2, startAyah: 153, endAyah: 157, title: 'Older unfinished', updatedAt: 1, status: state === 'completed' ? 'completed' : 'saved' });
          store.put({ ...lesson, id: 'finished', surahNumber: 3, startAyah: 10, endAyah: 12, title: 'Latest finished', status: 'completed', updatedAt: 3 });
        };
        await new Promise(resolve => { tx.oncomplete = resolve; });
        db.close();
      }, state);
      await page.reload();
    }
    const card = page.locator('.home-reflect-card');
    const title = state === 'empty' ? 'Begin reflecting' : state === 'unfinished' ? 'Continue lesson' : 'Explore & revisit';
    await expect(card.locator('strong')).toHaveText(title);
    await expect(card.locator('small')).toHaveText(state === 'empty' ? 'Choose a passage and begin your first lesson.' : state === 'completed' ? 'Return to your reflections or begin a new lesson.' : /Al.*1:1–3/);
    await expect(page.locator('.home-reflect-section').getByRole('button')).toHaveCount(1);
    await page.screenshot({ path: info.outputPath(`home-${state}.png`) });
    await card.click();
    await expect(page.getByRole('heading', { name: 'Reflect', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Lessons', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reflect-lesson-title')).toHaveCount(0);
  });
}
