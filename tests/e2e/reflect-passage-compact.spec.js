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
    const keyword=ayahs.first().getByRole('button',{name:/Toggle keyword/});
    await keyword.click();await expect(keyword).toHaveAttribute('aria-pressed','true');
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
  });
}
