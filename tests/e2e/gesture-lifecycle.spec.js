import { test, expect } from '@playwright/test';
import { openReader } from './fixtures/reader-ui.js';
import { seedLocalRecords } from './fixtures/local-records.js';

const toolbar = page => page.getByRole('toolbar', { name: 'Ayah actions' });
async function input(page, touch) {
  const session = touch ? await page.context().newCDPSession(page) : null;
  return {
    down: async (x,y) => session ? session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}) : (await page.mouse.move(x,y), page.mouse.down()),
    move: async (x,y) => session ? session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]}) : page.mouse.move(x,y),
    up: async () => session ? session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}) : page.mouse.up(),
  };
}
for (const touch of [true,false]) test(`press lifecycle with ${touch?'touch':'mouse'}`,async({page})=>{
  await openReader(page);
  const pointer = await input(page,touch);
  const words = page.locator('.reader-page-slide-current .quran-word[data-verse-key]');
  for (const index of [0,3,6]) {
    const word=words.nth(index), box=await word.boundingBox();
    const reference=await word.getAttribute('data-verse-key');
    await pointer.down(box.x+box.width/2,box.y+box.height/2);
    await page.waitForTimeout(470);
    await expect(toolbar(page)).toBeVisible();
    await expect(page.locator('.ayah-tooltip-backdrop')).toHaveAttribute('data-ayah-reference',reference);
    await pointer.up();
    await page.waitForTimeout(150);
    await expect(toolbar(page)).toBeVisible();
    await toolbar(page).getByRole('button',{name:'Highlight',exact:true}).click();
    await expect(toolbar(page)).toBeVisible();
    await page.locator('.ayah-tooltip-backdrop').click({position:{x:4,y:4}});
    await expect(toolbar(page)).toHaveCount(0);
  }
  const box=await words.first().boundingBox();
  for(const [dx,dy] of [[0,40],[45,0]]) {
    await pointer.down(box.x+box.width/2,box.y+box.height/2);
    await pointer.move(box.x+box.width/2+dx,box.y+box.height/2+dy);
    await page.waitForTimeout(500);await expect(toolbar(page)).toHaveCount(0);
    await pointer.up();await page.waitForTimeout(300);
  }
});
for (const theme of ['light','dark']) for (const [width,height] of [[390,844],[768,1024],[1365,900]]) {
  test(`swipe geometry ${theme} ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(t=>localStorage.setItem('quran-app-theme',t),theme);
    await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
    await seedLocalRecords(page);await page.getByRole('button',{name:'Library',exact:true}).click();
    const card=page.locator('.ui-swipe-actions').first(), surface=card.locator('.tab-card-surface');
    await expect(card).toBeVisible();
    await expect(page.locator('.screen-shell').last()).toHaveCSS('transform','none');
    const box=await card.boundingBox(),initial=await surface.boundingBox();
    const x=box.x+box.width*.7,y=box.y+box.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();
    for(const amount of [0,23,46,69,92,46,0]) {
      await page.mouse.move(x-amount,y,{steps:3});
      const front=await surface.boundingBox();
      expect(front.width).toBeCloseTo(initial.width,1);expect(front.height).toBeCloseTo(initial.height,1);
      expect(front.x).toBeCloseTo(initial.x-amount,1);
      const path=info.outputPath(`swipe-${theme}-${width}-${amount}-${amount===46?'mid':''}-${Date.now()}.png`);
      await page.screenshot({path,clip:{x:box.x-2,y:box.y-2,width:box.width+4,height:box.height+4}});
      await info.attach(`swipe ${amount}`,{path,contentType:'image/png'});
    }
    await page.mouse.up();
    await expect(card).toHaveAttribute('data-revealed','false');
    await expect(card.locator('.tab-card-remove')).toBeHidden();
    // Also exercise the animated return, not just a dragged return.
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-92,y);await page.mouse.up();
    await expect(card).toHaveClass(/is-swiped/);
    await page.waitForTimeout(250);
    expect((await surface.boundingBox()).width).toBeCloseTo(initial.width,1);
    await surface.click();await page.waitForTimeout(250);
    await expect(card).toHaveAttribute('data-revealed','false');
  });
}

for (const width of [390,1024]) test(`continuation lines, markers and short tap ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:768});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction('lastRead','readwrite');
    tx.objectStore('lastRead').put({id:'current',page:8,surahNumber:2,ayahNumber:54});
    await new Promise(resolve=>{tx.oncomplete=resolve;});db.close();sessionStorage.clear();
  });
  await page.reload();await page.getByRole('button',{name:/Continue Reading/}).click();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450);
  const pointer=await input(page,true);
  const word=page.locator('.reader-page-slide-current [data-reader-page="8"] [data-verse-key="2:54"]').first();
  await expect(word).toBeVisible();
  let box=await word.boundingBox();
  await pointer.down(box.x+box.width/2,box.y+box.height/2);await pointer.up();
  await expect(page.locator('.ayah-translation-card')).toBeVisible();
  await page.locator('.ayah-translation-backdrop').click({position:{x:3,y:3}});
  await page.waitForTimeout(750);
  for(const target of [word,page.locator('.reader-page-slide-current [data-reader-page="8"] .quran-ayah-marker').first()]) {
    box=await target.boundingBox();await pointer.down(box.x+box.width/2,box.y+box.height/2);
    await page.waitForTimeout(470);await expect(toolbar(page)).toBeVisible();await pointer.up();
    await expect(page.locator('.ayah-tooltip-backdrop')).toHaveAttribute('data-ayah-reference','2:54');
    await toolbar(page).getByRole('button',{name:'Bookmark',exact:true}).click();await expect(toolbar(page)).toBeVisible();
    await page.locator('.ayah-tooltip-backdrop').click({position:{x:3,y:3}});await expect(toolbar(page)).toHaveCount(0);
  }
});

test('touch cancellation cancels pending holds but preserves an activated toolbar',async({page})=>{
  await openReader(page);
  const session=await page.context().newCDPSession(page);
  const word=page.locator('.reader-page-slide-current .quran-word[data-verse-key]').first();
  const r=await word.boundingBox(),point={x:r.x+r.width/2,y:r.y+r.height/2};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await page.waitForTimeout(100);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForTimeout(500);await expect(toolbar(page)).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await expect(toolbar(page)).toBeVisible();
  await word.dispatchEvent('contextmenu',{bubbles:true,cancelable:true,clientX:point.x,clientY:point.y});
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(toolbar(page)).toBeVisible();
  await page.locator('.ayah-tooltip-backdrop').click({position:{x:3,y:3}});
  await expect(toolbar(page)).toHaveCount(0);
});
