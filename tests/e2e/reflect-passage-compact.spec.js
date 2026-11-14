import { test, expect } from '@playwright/test';
import { seedLocalRecords } from './fixtures/local-records.js';

for (const language of ['en','ur']) for (const theme of ['light','dark']) {
  test(`continuous compact passage ${language} ${theme}`,async({page},info)=>{
    await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
    await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
    await seedLocalRecords(page);
    await page.evaluate(async language=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
      const tx=db.transaction('tadabburLessons','readwrite'),store=tx.objectStore('tadabburLessons');
      const request=store.get('qa-reflect-lesson');request.onsuccess=()=>{
        const lesson=request.result;
        lesson.sourceSnapshot.translationId=language==='ur'?'ur-al-maududi':'en-al-maududi';
        lesson.sourceSnapshot.wordByWordLanguage=language;
        lesson.sourceSnapshot.verses=lesson.sourceSnapshot.verses.map(verse=>({...verse,
          translation:(language==='ur'?'اللہ کے نام سے جو رحمان و رحیم ہے':'In the name of Allah, the Most Compassionate, the Most Merciful')+' [1] [2]',
          wordByWordWords:[{arabic:'اللَّهِ',meaning:language==='ur'?'اللہ':'Allah'}],
          tafsirNotes:[{number:1,text:('First note. ').repeat(40)},{number:2,text:'Second note.'}],
        }));store.put(lesson);
      };
      await new Promise(resolve=>{tx.oncomplete=resolve;});db.close();
    },language);
    await page.reload();
    await page.getByRole('button',{name:/Continue lesson/}).click();
    await page.getByRole('button',{name:/^QA saved lesson/}).click();
    const passage=page.locator('.reflect-passage-section');
    const ayahs=passage.locator('.reflect-lesson-ayah');
    await expect(ayahs).toHaveCount(3);
    await expect(passage.locator('.ayah-word-by-word-heading')).toHaveCount(0);
    await expect(passage.getByRole('button',{name:/Previous Ayah|Next Ayah/})).toHaveCount(0);
    await expect(passage.getByRole('button',{name:language==='ur'?'Urdu':'English',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(ayahs.first().locator('.ayah-translation-text')).toHaveAttribute('dir',language==='ur'?'rtl':'ltr');
    await expect(ayahs.first().locator('.reflect-ayah-body')).toHaveCSS('padding','0px');
    await expect(ayahs.first().locator('.reflect-ayah-reference')).toHaveCSS('height','24px');
    await expect(ayahs.first()).toHaveCSS('border-top-width','0px');
    await expect(ayahs.nth(1)).toHaveCSS('border-top-width','1px');
    // Internal dividers must not use the white glass-edge border on cream cards.
    const divider = await ayahs.nth(1).evaluate(el => {
      const probe = document.createElement('span');
      probe.style.borderTop = '1px solid var(--ui-divider)';
      el.append(probe);
      const expected = getComputedStyle(probe).borderTopColor;
      probe.remove();
      return { actual: getComputedStyle(el).borderTopColor, expected };
    });
    expect(divider.actual).toBe(divider.expected);
    expect(divider.actual).not.toBe('transparent');
    if (theme === 'light') expect(divider.actual).not.toMatch(/^rgba?\(255, 255, 255/);
    const keyword=ayahs.first().getByRole('button',{name:/Toggle keyword/});
    await keyword.click();await expect(keyword).toHaveAttribute('aria-pressed','true');
    const savedChip=page.locator('.reflect-keyword-chip').first();
    await expect(savedChip).toBeVisible();
    await expect(savedChip).toHaveCSS('display', /^(inline-)?flex$/);
    await expect(savedChip.locator('.reflect-keyword-arabic')).toHaveText('اللَّهِ');
    await expect(savedChip.locator('.reflect-keyword-meaning')).toHaveCount(0);
    const dividerLayout=await ayahs.nth(1).evaluate(el=>({
      top:getComputedStyle(el).marginTop,
      padding:getComputedStyle(el).paddingTop,
    }));
    expect(dividerLayout).toEqual({top:'12px',padding:'12px'});
    const reflectionDivider=page.locator('#reflect-my-reflection');
    if (await reflectionDivider.count()) {
      await expect(reflectionDivider).toHaveCSS('border-top-width','1px');
    }
    const one=ayahs.first().getByRole('button',{name:'Toggle Tafsir footnote 1'});
    await one.scrollIntoViewIfNeeded();
    const scroll=page.locator('.reflect-content');
    const before=await scroll.evaluate(el=>el.scrollTop);
    await one.click();
    await expect(passage.locator('.reflect-selected-tafsir')).toHaveCount(1);
    expect(await scroll.evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
    await ayahs.first().getByRole('button',{name:'Toggle Tafsir footnote 2'}).click();
    await expect(passage.locator('.reflect-selected-tafsir')).toHaveText(/Second note/);
    expect(await scroll.evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
    await ayahs.nth(1).getByRole('button',{name:'Toggle Tafsir footnote 1'}).click();
    await expect(passage.locator('.reflect-selected-tafsir')).toHaveCount(1);
    await expect(ayahs.first().locator('.reflect-selected-tafsir')).toHaveCount(0);
    await ayahs.nth(1).getByRole('button',{name:'Toggle Tafsir footnote 1'}).click();
    await expect(passage.locator('.reflect-selected-tafsir')).toHaveCount(0);
    await passage.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`passage-${language}-${theme}.png`)});
    const saved=await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
      return new Promise(resolve=>{const r=db.transaction('tadabburLessons').objectStore('tadabburLessons').get('qa-reflect-lesson');r.onsuccess=()=>{resolve(r.result.keywords);db.close();};});
    });expect(saved).toHaveLength(1);
    expect(saved[0].language).toBe(language);
  });
}


test('Discover reveals English and Urdu for Arabic-only keyword chips', async ({ page }) => {
  await page.goto('/');
  await seedLocalRecords(page);
  await page.evaluate(async () => {
    const database = await new Promise(resolve => {
      const request = indexedDB.open('quranFluentLocal');
      request.onsuccess = () => resolve(request.result);
    });
    const tx = database.transaction('tadabburLessons', 'readwrite');
    const store = tx.objectStore('tadabburLessons');
    const lesson = await new Promise(resolve => {
      const request = store.get('qa-reflect-lesson');
      request.onsuccess = () => resolve(request.result);
    });
    lesson.keywords = [{ key: '3:1', ayahNumber: 3, arabic: 'الرَّحِيمِ', meaning: 'Most Merciful', language: 'en' }];
    store.put(lesson);
    await new Promise(resolve => { tx.oncomplete = resolve; });
    database.close();
  });
  await page.reload();
  await page.getByRole('button', {name:/Continue lesson/}).click();
  await page.getByRole('tablist', {name:'Reflect sections'}).getByRole('tab', {name:'Discover'}).click();
  const chip = page.locator('.reflect-keyword-list .reflect-keyword-chip').first();
  await expect(chip.locator('.reflect-keyword-arabic')).toHaveText('الرَّحِيمِ');
  await expect(chip.locator('.reflect-keyword-source')).toHaveText('1:3');
  await expect(chip.locator('.reflect-keyword-meaning')).toHaveCount(0);
  await chip.click();
  const sheet = page.getByRole('dialog', {name:'Saved Keyword'});
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('English', {exact:true})).toBeVisible();
  await expect(sheet.getByText('Urdu', {exact:true})).toBeVisible();
  await expect(sheet.getByText('Loading…')).toHaveCount(0);
  await expect(sheet.getByText('English meaning unavailable for this word.')).toHaveCount(0);
  await expect(sheet.getByText('اس لفظ کا اردو معنی دستیاب نہیں ہے۔')).toHaveCount(0);
  await sheet.getByRole('button',{name:'Jump to Ayah'}).click();
  await expect(page.locator('.reflect-passage-section')).toBeVisible();
  await expect(page.locator('[data-reflect-ayah="3"]')).toBeVisible();
});
