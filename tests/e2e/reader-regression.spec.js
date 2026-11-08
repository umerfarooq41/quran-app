import { holdWord } from './fixtures/reader-ui.js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const timings=JSON.parse(readFileSync(new URL('../../public/data/audio/full/mishari-rashid-al-afasy/segments.json',import.meta.url),'utf8'));

async function seededReader(page, theme, number, annotations = false, readerLayout = 'single') {
  await page.setViewportSize(readerLayout === 'double' ? {width:1180,height:820} : {width:390,height:844});
  await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.evaluate(async({theme,number,annotations,readerLayout})=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['lastRead','settings','bookmarks','highlights'],'readwrite');
    tx.objectStore('lastRead').put({id:'current',page:number,surahNumber:number===7?2:15,ayahNumber:number===7?45:60});
    tx.objectStore('settings').put({id:'app',value:{theme,readerLayout,reciter:'mishari-rashid-al-afasy',followRecitation:true,fontScale:1}});
    if(annotations){
      tx.objectStore('bookmarks').put({id:987001,category:'Reading',surahNumber:2,ayahNumber:45,page:7,createdAt:Date.now()});
      tx.objectStore('highlights').put({id:987002,color:'amber',surahNumber:2,ayahNumber:45,page:7,createdAt:Date.now()});
    }
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();sessionStorage.clear();
  },{theme,number,annotations,readerLayout});
  await page.goto('/?reader-regression='+number);await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.getByRole('button',{name:/Continue Reading/}).click();await expect(page.locator('.reader-page').first()).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}
for (const readerLayout of ['single','double']) for(const theme of ['light','dark']) {
  test(`permanent quarter and bookmark capsules survive page turns ${theme} ${readerLayout}`,async({page})=>{
    await seededReader(page,theme,7,true,readerLayout);
    const quarter=page.locator('.quran-ayah-marker--quarter');const bookmark=page.locator('.quran-ayah-marker--bookmark');
    await expect(quarter).toHaveCount(1);await expect(bookmark).toHaveCount(1);
    const shape=async locator=>locator.evaluate(el=>{const s=getComputedStyle(el,'::after');return {width:s.width,height:s.height,border:s.borderRadius,color:s.backgroundColor};});
    const q=await shape(quarter),b=await shape(bookmark);
    expect(parseFloat(q.height)).toBeGreaterThan(parseFloat(q.width));expect(parseFloat(b.height)).toBeGreaterThan(parseFloat(b.width));
    expect(q.color).not.toBe(b.color);
    await expect(page.locator('.reader-ayah-highlight-saved')).not.toHaveCount(0);
    await page.evaluate(()=>{window.__readerLeavingEvidence=new Promise((resolve,reject)=>{
      const observer=new MutationObserver(check);
      const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Outgoing page lost its saved annotations during the turn'));},2000);
      function check(){const leaving=document.querySelector('.reader-page-slide-leaving');if(!leaving?.querySelector('.quran-ayah-marker--bookmark')||!leaving.querySelector('.reader-ayah-highlight-saved'))return;clearTimeout(timer);observer.disconnect();resolve({bookmark:true,highlight:true,inert:leaving.inert});}
      observer.observe(document.body,{subtree:true,attributes:true,childList:true});check();
    });});
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(()=>window.__readerLeavingEvidence)).toEqual({bookmark:true,highlight:true,inert:true});
    await expect(quarter).toHaveCount(0);
    await expect(page.locator('.reader-page-slide-viewport')).not.toHaveClass(/is-transitioning/);
    await page.keyboard.press('ArrowRight');await expect(quarter).toHaveCount(1);await expect(bookmark).toHaveCount(1);
    await expect(page.locator('.quran-ayah-marker--flash')).toHaveCount(0);
    expect(await shape(quarter)).toEqual(q);
  });
  test(`long-press Play follows a timed word across page 238 to 239 ${theme} ${readerLayout}`,async({page})=>{
    test.setTimeout(60000);
    const length=1200*8000,wav=Buffer.alloc(44+length,128);
    wav.write('RIFF',0);wav.writeUInt32LE(36+length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(length,40);
    await page.route('https://audio-cdn.tarteel.ai/**',route=>{
      const range=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
      const start=Number(range?.[1] || 0),end=range?.[2] ? Number(range[2]) : wav.length-1;
      return route.fulfill({status:range?206:200,contentType:'audio/wav',headers:{'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${end}/${wav.length}`}:{})},body:wav.subarray(start,end+1)});
    });
    await seededReader(page,theme,238,false,readerLayout);
    const word=page.locator('[data-verse-key="15:60"]').first();await expect(word).toBeVisible();
    await holdWord(page, word);
    await expect(page.getByRole('toolbar',{name:'Ayah actions'})).toBeVisible();
    await page.getByRole('button',{name:'Play',exact:true}).click();
    const audio=page.locator('audio.reader-audio-native');
    await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(false);
    await expect.poll(()=>audio.evaluate(el=>el.readyState)).toBeGreaterThanOrEqual(3);
    await expect.poll(()=>audio.evaluate(el=>el.currentTime)).toBeGreaterThanOrEqual(timings['15:60'].timestamp_from / 1000);
    expect(await audio.evaluate(el=>el.currentTime)).toBeLessThan(timings['15:60'].timestamp_to / 1000);
    const current=page.locator('.reader-page-slide-current .reader-page');
    for(const [position,visible] of [[3,'15:60'],[4,'15:61']]) {
      const segment=timings['15:60'].segments.find(s=>s[0]===position);
      // Word 4 lasts only 550 ms. Observe it inside the browser so an IPC
      // round trip cannot miss a correctly rendered native playback frame.
      const observed = await audio.evaluate((el,{time,position,visible}) => new Promise((resolve,reject) => {
        const observer = new MutationObserver(check);
        const timeout = setTimeout(() => {observer.disconnect();reject(new Error('Timed word did not render on its expected page'));},5000);
        function check() {
          const word=document.querySelector(`.reader-page-slide-current .is-recited-word[data-verse-key="15:60"][data-word-position="${position}"]`);
          const root=word?.closest('.reader-page');
          if(!word||!root.querySelector(`[data-verse-key="${visible}"]`))return;
          const r=word.getBoundingClientRect(),style=getComputedStyle(word);
          if(!r.width||!r.height||r.right<=0||r.left>=innerWidth||r.bottom<=0||r.top>=innerHeight||style.visibility==='hidden')return;
          clearTimeout(timeout);observer.disconnect();resolve({position:Number(word.dataset.wordPosition),verse:word.dataset.verseKey});
        }
        observer.observe(document.body,{subtree:true,childList:true,attributes:true});
        el.currentTime=time;check();
      }),{time:(segment[1]+100)/1000,position,visible});
      expect(observed).toEqual({position,verse:'15:60'});
      await expect(current.locator(`[data-verse-key="${visible}"]`).first()).toBeVisible();
    }
    await page.getByRole('button',{name:'Close audio player',exact:true}).click();
    await expect(page.locator('.reader-audio-panel-wrap')).toHaveCount(0);
  });
}
