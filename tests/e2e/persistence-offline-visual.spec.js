import { test, expect } from '@playwright/test';

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 20000 });
}

async function seedLocalRecords(page) {
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('quranFluentLocal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['bookmarks', 'highlights', 'tadabburLessons'], 'readwrite');
    const now = Date.now();
    transaction.objectStore('bookmarks').put({
      id: 990001, category: 'Reading', surahNumber: 1, ayahNumber: 1,
      page: 1, preview: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', createdAt: now, updatedAt: now,
    });
    transaction.objectStore('highlights').put({
      id: 990002, color: '#FACC15', surahNumber: 1, ayahNumber: 2,
      page: 1, preview: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', createdAt: now, updatedAt: now,
    });
    transaction.objectStore('tadabburLessons').put({
      id: 'qa-reflect-lesson', surahNumber: 1, startAyah: 1, endAyah: 3,
      title: 'QA saved lesson', status: 'saved', createdAt: now, updatedAt: now,
      answers: { prepare: ['', '', ''], tadabbur: { imagine: 'QA persistence note' } },
      finalQuestions: [],
      sourceSnapshot: {
        translationId: 'en-sahih', translationName: 'QA translation',
        wordByWordLanguage: 'en',
        verses: [
          { ayahNumber: 1, arabic: 'بِسْمِ اللَّهِ', text: 'بِسْمِ اللَّهِ', translation: 'In the name of Allah', wordByWordWords: [], tafsirNotes: [] },
          { ayahNumber: 2, arabic: 'الْحَمْدُ لِلَّهِ', text: 'الْحَمْدُ لِلَّهِ', translation: 'All praise is for Allah', wordByWordWords: [], tafsirNotes: [] },
          { ayahNumber: 3, arabic: 'الرَّحْمَٰنِ الرَّحِيمِ', text: 'الرَّحْمَٰنِ الرَّحِيمِ', translation: 'The Most Compassionate, Most Merciful', wordByWordWords: [], tafsirNotes: [] },
        ],
      },
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
}

test('Library reads persisted bookmarks and highlights and supports removal', async ({ page }) => {
  await openHome(page);
  await seedLocalRecords(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText('1:1', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Bookmark actions' }).click();
  await page.getByRole('button', { name: 'Remove Bookmark' }).click();
  await expect(page.getByText('Bookmark removed')).toBeVisible();

  await page.getByRole('tab', { name: /Highlights/i }).click();
  await expect(page.getByRole('tabpanel', { name: 'Highlights' })).toBeVisible();
  await expect(page.getByText('Highlight', { exact: true })).toBeVisible();
});

test('saved Reflect lesson and its personal notes survive reloads', async ({ page }) => {
  await openHome(page);
  await seedLocalRecords(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
  await page.getByRole('button', { name: /Begin reflecting/i }).click();

  await expect(page.getByRole('heading', { name: 'Reflect', exact: true })).toBeVisible();
  await expect(page.getByText('1 saved')).toBeVisible();
  await page.getByRole('button', { name: 'QA saved lesson' }).click();
  await expect(page.locator('#reflect-lesson-title')).toHaveValue('QA saved lesson');
  await expect(page.getByText('In the name of Allah')).toBeVisible();
  await expect(page.locator('#reflect-imagine')).toHaveValue('QA persistence note');
  await expect(page.getByRole('group', { name: 'Word-by-word language' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Urdu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Urdu', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ayah-word-by-word').first()).toBeVisible();
  await expect(page.locator('.reflect-ayah-reference').first()).toContainText(/Al-Fatihah 1:1|Al-Baqarah 2:/);

  await page.reload();
  await expect(page.locator('#root')).not.toBeEmpty();
  const persistedNotes = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('quranFluentLocal');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('tadabburLessons')) {
        database.close();
        resolve(null);
        return;
      }
      const transaction = database.transaction('tadabburLessons', 'readonly');
      const recordRequest = transaction.objectStore('tadabburLessons').get('qa-reflect-lesson');
      recordRequest.onsuccess = () => {
        resolve(recordRequest.result?.answers?.tadabbur?.imagine || null);
        database.close();
      };
      recordRequest.onerror = () => reject(recordRequest.error);
    };
  }));
  expect(persistedNotes).toBe('QA persistence note');
});

test('Reflect bookmarks appear independently of saved Reflect studies', async ({ page }) => {
  await openHome(page);
  await seedLocalRecords(page);
  await page.evaluate(async () => {
    const request = indexedDB.open('quranFluentLocal');
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('bookmarks', 'readwrite');
    transaction.objectStore('bookmarks').put({
      id: 990003, category: 'Reflect', surahNumber: 1, ayahNumber: 2,
      page: 1, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText('Reflect', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back from library' }).click();
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.quran-ayah-marker--bookmark-tadabbur').first()).toBeVisible();
});

test('installed production service worker supports an offline cold reload', async ({ page, context }) => {
  await openHome(page);

  const serviceWorkerState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false, registered: false, controlled: false };
    const registration = await navigator.serviceWorker.ready;
    return {
      supported: true,
      registered: Boolean(registration.active),
      controlled: Boolean(navigator.serviceWorker.controller),
    };
  });
  expect(serviceWorkerState.supported).toBe(true);
  expect(serviceWorkerState.registered).toBe(true);

  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Al Quran' })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.reader-page').first()).toBeVisible();
  await expect(page.locator('.reader-page').first()).toBeVisible();

  await context.setOffline(false);
});

test('key screens produce reviewable visual evidence', async ({ page }, testInfo) => {
  await openHome(page);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true });

  await page.getByRole('button', { name: 'Back from library' }).click();
  await page.getByRole('button', { name: /Begin reflecting/i }).click();
  await expect(page.getByRole('heading', { name: 'Reflect', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reflect.png'), fullPage: true });

  await page.getByRole('button', { name: 'Back from Reflect' }).click();
  await page.getByRole('button', { name: /Continue Reading/i }).click();
  await expect(page.locator('.reader-page').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
});

test('visible interactive controls expose accessible names', async ({ page }) => {
  await openHome(page);
  const unnamed = await page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible').evaluateAll((elements) =>
    elements.filter((element) => {
      const name = element.getAttribute('aria-label')
        || element.getAttribute('title')
        || element.innerText
        || element.value
        || '';
      return !String(name).trim();
    }).map((element) => element.outerHTML.slice(0, 200)),
  );
  expect(unnamed, 'visible interactive controls should have accessible names').toEqual([]);
});
