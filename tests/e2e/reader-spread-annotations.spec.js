import { holdWord } from './fixtures/reader-ui.js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const timings=JSON.parse(readFileSync(new URL('../../public/data/audio/full/mishari-rashid-al-afasy/segments.json',import.meta.url),'utf8'));
const current='.reader-page-slide-current';
async function seed(page,theme,ayah = 54, pageNumber = 7) {
  await page.setViewportSize({width:1180,height:820});
  await page.addInitScript(t=>localStorage.setItem('quran-app-theme',t),theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.evaluate(async ({theme,ayah,pageNumber})=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['lastRead','settings','bookmarks','highlights'],'readwrite');
    tx.objectStore('lastRead').put({id:'current',page:pageNumber,surahNumber:2,ayahNumber:ayah});
    tx.objectStore('settings').put({id:'app',value:{theme,readerLayout:'auto',reciter:'mishari-rashid-al-afasy',followRecitation:true}});
    tx.objectStore('bookmarks').put({id:99901,surahNumber:2,ayahNumber:ayah,page:pageNumber,category:'Reading',createdAt:Date.now()});
    tx.objectStore('highlights').put({id:99902,surahNumber:2,ayahNumber:ayah,page:pageNumber,color:'amber',createdAt:Date.now()});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();sessionStorage.clear();
  },{theme,ayah,pageNumber});
  await page.goto('/?spread-annotations');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.evaluate(()=>document.fonts.load('24px IndopakNastaleeq'));
}
async function bothSaved(page,count=2) {
  await expect(page.locator(`${current} .reader-page-leaf`)).toHaveCount(2);
  await expect(page.locator(`${current} .reader-ayah-highlight-saved`)).toHaveCount(count);
  for(const path of await page.locator(`${current} .reader-ayah-highlight-saved`).all()) {
    expect(await path.evaluate(el=>getComputedStyle(el).fill)).toBe('rgba(243, 184, 62, 0.24)');
    const box=await path.boundingBox();expect(box.width).toBeGreaterThan(10);expect(box.height).toBeGreaterThan(10);
    const leaf=await path.locator('xpath=ancestor::div[contains(@class,"reader-page-leaf")]').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(leaf.x-1);expect(box.x+box.width).toBeLessThanOrEqual(leaf.x+leaf.width+1);
  }
}
async function bothNavigation(page,count=2) {
  await expect(page.locator(`${current} .reader-navigation-highlight-shape`)).toHaveCount(count);
  for(const path of await page.locator(`${current} .reader-ayah-highlight-navigation`).all()) expect((await path.boundingBox()).width).toBeGreaterThan(10);
}
async function library(page) {
  await page.locator('[data-reader-toggle-zone]').first().click({force:true});
  await page.getByRole('button',{name:'Open library',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible();
}
for(const theme of ['light','dark']) for(const target of [{ayah:54,start:7,positions:[13,14],pages:[7,8],count:2},{ayah:61,start:8,positions:[22,23],pages:[8,9],count:1}]) {
  test(`spanning saved ayah and Index/Library destination flashes ${theme} 2:${target.ayah}`,async({page},info)=>{
    await seed(page,theme,target.ayah,target.start);
    await page.getByRole('button',{name:'Index',exact:true}).click();await page.getByRole('tab',{name:'Surahs',exact:true}).click();
    const card=page.locator('[data-index-surah-card="2"]');await card.locator('.index-expand-button').click();
    await card.getByRole('textbox',{name:'Ayah number from 1 to 286'}).fill(String(target.ayah));await card.getByRole('button',{name:'Go',exact:true}).click();
    await bothNavigation(page,target.count);await bothSaved(page,target.count);
    await library(page);await page.getByRole('tab',{name:'Highlights',exact:true}).click();
    await page.locator('.library-highlight-card .tab-card-hit').click();await bothNavigation(page,target.count);await bothSaved(page,target.count);
    await library(page);await page.getByRole('tab',{name:'Bookmarks',exact:true}).click();
    await page.locator('[role="tabpanel"][aria-label="Bookmarks"] .tab-card-hit').click();
    await expect(page.locator(`${current} [data-reader-page="${target.pages[1]}"] .quran-ayah-marker--flash-reading`)).toHaveCount(1);

    await expect(page.locator(`${current} .reader-navigation-highlight-shape`)).toHaveCount(0);await bothSaved(page,target.count);
    await expect(page.locator(`${current} .reader-navigation-highlight-shape`)).toHaveCount(0);
    await expect(page.locator(`${current} .quran-ayah-marker--flash`)).toHaveCount(0);
    await page.setViewportSize({width:820,height:1180});
    await expect(page.locator(`${current} [data-reader-page="${target.pages[1]}"]`)).toBeVisible();
    await library(page);await page.getByRole('tab',{name:'Bookmarks',exact:true}).click();
    await page.locator('[role="tabpanel"][aria-label="Bookmarks"] .tab-card-hit').click();
    await expect(page.locator(`${current} .reader-page-leaf`)).toHaveCount(1);
    await expect(page.locator(`${current} [data-reader-page="${target.pages[1]}"] .quran-ayah-marker--flash-reading`)).toHaveCount(1);
    await expect(page.locator(`${current} .reader-navigation-highlight-shape`)).toHaveCount(0);
    await expect(page.locator(`${current} .quran-ayah-marker--flash`)).toHaveCount(0);
    await page.setViewportSize({width:1180,height:820});await bothSaved(page,target.count);
    await page.keyboard.press('ArrowLeft');await expect(page.locator(`${current} [data-reader-page="${target.count===2?9:11}"]`)).toBeVisible();
    await expect(page.locator('.reader-page-slide-viewport')).not.toHaveClass(/is-transitioning/);
    await page.keyboard.press('ArrowRight');await bothSaved(page,target.count);
    await expect(page.locator(`${current} .reader-navigation-highlight-shape`)).toHaveCount(0);
    await expect(page.locator(`${current} .quran-ayah-marker--flash`)).toHaveCount(0);
    await info.attach(`spanning-saved-${theme}`,{body:await page.screenshot(),contentType:'image/png'});
  });
  test(`recited word crosses visible pages ${target.count===2?'within a spread':'from page 8 to 9'} ${theme}`,async({page})=>{
    test.setTimeout(60000);
    const length=1200*8000,wav=Buffer.alloc(44+length,128);
    wav.write('RIFF',0);wav.writeUInt32LE(36+length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(length,40);
    await page.route('https://audio-cdn.tarteel.ai/**',route=>{const r=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/),start=Number(r?.[1]||0),end=r?.[2]?Number(r[2]):wav.length-1;return route.fulfill({status:r?206:200,contentType:'audio/wav',headers:{'accept-ranges':'bytes',...(r?{'content-range':`bytes ${start}-${end}/${wav.length}`}:{})},body:wav.subarray(start,end+1)});});
    await seed(page,theme,target.ayah,target.start);await page.getByRole('button',{name:/Continue Reading/}).click();await bothSaved(page,target.count);
    const word=page.locator(`${current} [data-verse-key="2:${target.ayah}"]`).first();await holdWord(page, word);
    await page.getByRole('button',{name:'Play',exact:true}).click();const audio=page.locator('audio.reader-audio-native');
    await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(false);await expect.poll(()=>audio.evaluate(el=>el.readyState)).toBeGreaterThanOrEqual(3);
    await expect.poll(()=>audio.evaluate(el=>el.currentTime)).toBeGreaterThanOrEqual(timings[`2:${target.ayah}`].timestamp_from/1000);
    expect(await audio.evaluate(el=>el.currentTime)).toBeLessThan(timings[`2:${target.ayah}`].timestamp_to/1000);
    for(const [index,position] of target.positions.entries()) {
      const number=target.pages[index];
      const segment=timings[`2:${target.ayah}`].segments.find(s=>s[0]===position);
      const observed=await audio.evaluate((el,{time,position,number,verse})=>new Promise((resolve,reject)=>{
        const observer=new MutationObserver(check),timer=setTimeout(()=>{observer.disconnect();reject(new Error(`Timed word ${verse}:${position} on page ${number} did not appear; time=${el.currentTime}, paused=${el.paused}, rendered=${[...document.querySelectorAll('.is-recited-word')].map(w=>w.dataset.verseKey+':'+w.dataset.wordPosition).join(',')}`));},5000);
        function check(){const root=document.querySelector('.reader-page-slide-current');const word=root.querySelector(`.is-recited-word[data-verse-key="${verse}"][data-word-position="${position}"]`);if(!word||Number(word.closest('[data-reader-page]').dataset.readerPage)!==number)return;const r=word.getBoundingClientRect();if(!r.width||r.right<=0||r.left>=innerWidth)return;clearTimeout(timer);observer.disconnect();resolve({number,pages:[...root.querySelectorAll('[data-reader-page]')].map(e=>Number(e.dataset.readerPage)),transition:root.parentElement.classList.contains('is-transitioning')});}
        observer.observe(document.body,{subtree:true,childList:true,attributes:true});el.currentTime=time;check();
      }),{time:(segment[1]+100)/1000,position,number,verse:`2:${target.ayah}`});
      expect(observed.number).toBe(number);
      expect(observed.pages).toEqual(number===9?[9,10]:[7,8]);
      if(target.count===2) expect(observed.transition).toBe(false);
      await expect(page.locator(`${current} .reader-ayah-highlight-audio`)).toHaveCount(target.count);await bothSaved(page,target.count);
    }
    await page.getByRole('button',{name:'Close audio player',exact:true}).click();
    await page.setViewportSize({width:820,height:1180});await expect(page.locator(`${current} [data-reader-page="${target.pages[1]}"]`)).toBeVisible();
    await expect(page.locator(`${current} .reader-page-leaf`)).toHaveCount(1);
  });
}
