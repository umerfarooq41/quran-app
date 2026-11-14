import {test,expect} from '@playwright/test';
import {seedLocalRecords} from './fixtures/local-records.js';

for(const theme of ['light','dark']) test(`shared swipe consumers ${theme}`,async({page},info)=>{
  await page.addInitScript(theme=>{
    localStorage.setItem('quran-app-theme',theme);
    localStorage.setItem('quran-app-favorite-surahs','[1,2]');
  },theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await seedLocalRecords(page);
  await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction('tadabburLessons','readwrite'),store=tx.objectStore('tadabburLessons');
    const r=store.get('qa-reflect-lesson');r.onsuccess=()=>store.put({...r.result,studyQuestions:[{id:'qa-question',text:'What does this passage teach?',answer:''}]});
    await new Promise(resolve=>{tx.oncomplete=resolve;});db.close();
  });
  async function check(name) {
    const card=page.locator('.ui-swipe-actions').first();await expect(card).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-navigation-direction', /.+/);
    const front=card.locator(':scope > .tab-card-surface,:scope > .home-favorite-row');
    const initial=await front.boundingBox(),box=await card.boundingBox();
    expect(await front.evaluate(el=>getComputedStyle(el).borderTopRightRadius)).toBe(await card.evaluate(el=>getComputedStyle(el).borderTopRightRadius));
    const x=box.x+box.width*.7,y=box.y+box.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-92,y,{steps:8});await page.mouse.up();
    await expect(card).toHaveClass(/is-swiped/);await page.waitForTimeout(250);
    expect((await front.boundingBox()).width).toBeCloseTo(initial.width,1);
    await card.screenshot({path:info.outputPath(`${name}-${theme}-open.png`)});
    await front.click();await expect(card).not.toHaveClass(/is-swiped/);await page.waitForTimeout(250);
    await expect(card).toHaveAttribute('data-revealed','false');
  }
  await check('favorites');
  await page.getByRole('button',{name:'Library',exact:true}).click();await check('bookmarks');
  await page.getByRole('tab',{name:'Highlights',exact:true}).click();await check('highlights');
  await page.getByRole('button',{name:'Back from library',exact:true}).click();
  await page.getByRole('button',{name:/Begin reflecting|Continue lesson|Explore & revisit/}).click();await check('lessons');
  await page.getByRole('tab',{name:'Questions',exact:true}).click();await check('questions');
});
