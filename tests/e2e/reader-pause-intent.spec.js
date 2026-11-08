import { test, expect } from '@playwright/test';
import { openReader, mockRecitation } from './fixtures/reader-ui.js';

async function listen(page) {
  await openReader(page);
  await page.locator('[data-reader-toggle-zone]').first().click({force:true});
  await page.locator('.reader-listen-pill').click();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  return page.locator('audio.reader-audio-native');
}

test('Pause during source loading remains paused when metadata arrives',async({page})=>{
  await mockRecitation(page);
  let release;const gate=new Promise(resolve=>release=resolve);let requested=false;
  await page.route('https://audio-cdn.tarteel.ai/**',async route=>{requested=true;await gate;await route.fallback();});
  const audio=await listen(page);await expect.poll(()=>requested).toBe(true);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  release();await expect.poll(()=>audio.evaluate(el=>el.readyState)).toBeGreaterThanOrEqual(3);
  await expect(page.getByText('Loading audio...', {exact:true})).toHaveCount(0);
  await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
  await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(false);
  await page.getByRole('button',{name:'Pause',exact:true}).click();await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
});

test('a delayed native play promise cannot override a newer Pause',async({page})=>{
  await page.addInitScript(()=>{
    window.__holdReaderPlay=true;window.__readerPlayResolvers=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      const result=original.apply(this,args);
      if(!window.__holdReaderPlay||this.src.startsWith('data:'))return result;
      return result.then(()=>new Promise(resolve=>window.__readerPlayResolvers.push(resolve)));
    };
  });
  await mockRecitation(page);const audio=await listen(page);
  await expect.poll(()=>page.evaluate(()=>window.__readerPlayResolvers.length)).toBeGreaterThan(0);
  await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(false);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.evaluate(async()=>{
    window.__holdReaderPlay=false;
    window.__readerPlayResolvers.splice(0).forEach(resolve=>resolve());
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
  await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(false);
});
