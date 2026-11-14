import {test,expect} from '@playwright/test';

for(const theme of ['light','dark']) for(const enabled of [false,true]) test(`Reader WBW preference without deprecated switch ${enabled} ${theme}`,async({page},info)=>{
  await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.evaluate(async({enabled,theme})=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({id:'app',value:{theme,wordByWordTranslation:enabled,wordByWordLanguage:'ur'}});
    await new Promise(resolve=>{tx.oncomplete=resolve;});db.close();sessionStorage.clear();
  },{enabled,theme});
  await page.reload();await page.getByRole('button',{name:/Continue Reading/}).click();
  await page.evaluate(()=>document.fonts.ready);
  const word=page.locator('.reader-page-slide-current .quran-word[data-verse-key]').first();await word.click();
  const card=page.locator('.ayah-translation-card');
  await expect(card).toBeVisible();
  // The switch was intentionally removed from the translation card. Saved
  // settings still determine whether word-by-word content is shown.
  await expect(card.getByRole('switch',{name:'Word-by-word translation'})).toHaveCount(0);
  await expect(card.locator('.ayah-word-by-word')).toHaveCount(enabled?1:0);
  await expect(card.locator('.ayah-word-by-word-heading')).toHaveCount(0);
  await card.getByRole('button',{name:'Next Ayah'}).click();
  await expect(card.locator('.ayah-word-by-word')).toHaveCount(enabled?1:0);
  await expect.poll(()=>page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('quranFluentLocal');r.onsuccess=()=>resolve(r.result);});
    return new Promise(resolve=>{const r=db.transaction('settings').objectStore('settings').get('app');r.onsuccess=()=>{resolve(r.result.value.wordByWordTranslation);db.close();};});
  })).toBe(enabled);
  await page.screenshot({path:info.outputPath(`reader-wbw-${enabled}-${theme}.png`)});
});
