import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedLocalRecords } from './fixtures/local-records.js';
test.use({ actionTimeout: 15000 });

async function home(page) {
  if (page.url().startsWith('http')) await page.evaluate(() => sessionStorage.clear());
  await page.goto('/?audit-home=' + Date.now());
  await expect(page.getByRole('heading', {name:'Al Quran'})).toBeVisible({timeout:20000});
}
async function healthy(page, name, info, axe = false) {
  console.log('Checking',name);
  const owner = name.startsWith('Reflect') ? '.reflect-screen' : name.startsWith('Index') ? '.index-replica-shell' : name.startsWith('Search') ? '.search-screen' : name.startsWith('Help') ? '.help-screen' : name==='Library' ? '.tabs-screen:not(.reflect-screen)' : name==='Home' ? '.screen-shell:has(.home-branding-block)' : name==='Settings' ? '.settings-screen' : name==='Surah introduction' ? '.surah-info-screen' : '.reader-page-slide-viewport';
  await expect(page.locator(owner)).toBeVisible();
  await expect.poll(() => page.locator(owner).evaluate(node => {
    const transform=getComputedStyle(node).transform;
    if(transform==='none')return true;
    const matrix=new DOMMatrix(transform);return Math.abs(matrix.m41)<.01&&Math.abs(matrix.m42)<.01;
  })).toBe(true);
  await expect.poll(() => page.locator('.screen-shell').evaluateAll(nodes => nodes.length <= 1 && nodes.every(node => {
    const transform = getComputedStyle(node).transform;
    if (transform === 'none') return true;
    const matrix = new DOMMatrix(transform);
    return Math.abs(matrix.m41) < .01 && Math.abs(matrix.m42) < .01;
  }))).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity));
  const overflow = await page.evaluate(() => {
    const visible = el => {const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    return [...document.querySelectorAll('main,section,article,header,input,textarea,[role="tablist"]')].filter(visible).filter(el => {const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(el=>el.className);
  });
  expect(overflow, name+' should fit the viewport').toEqual([]);
  console.log('Capturing',name);
  await info.attach(name, {body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  console.log('Captured',name);
  if (axe) {
    const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(result.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})), name).toEqual([]);
  }
}
for (const theme of ['light','dark']) for (const width of [320,375,390,430,768]) {
  test(`${theme} ${width}px pages, lesson and keyboard controls`, async ({page},info) => {
    test.setTimeout(180000);
    await page.setViewportSize({width,height:844});
    await page.addInitScript(theme => localStorage.setItem('quran-app-theme',theme),theme);
    await home(page); await seedLocalRecords(page); await home(page);
    console.log('Opening Home');
    await healthy(page,'Home',info,width===390);
    for (const screen of ['Index','Library','Search','Settings']) {
      await home(page);
      await page.getByRole('button',{name:screen,exact:true}).click();
      await expect(page.getByRole('heading',{name:screen,exact:true})).toBeVisible();
      await healthy(page,screen,info,width===390);
      if (screen==='Index') {
        await page.locator('.index-expand-button').first().click();
        await expect(page.locator('.index-quarter-btn')).toHaveCount(4);
        await healthy(page,'Index quarters',info,width===390);
        await page.getByRole('tab',{name:'Surahs',exact:true}).click();
        await page.getByRole('button',{name:/Expand Al-Fatihah/}).click();
        await healthy(page,'Index expanded',info,width===390);
        const preview=await page.locator('.index-surah-introduction-preview').first().evaluate(el=>({size:getComputedStyle(el).fontSize,font:getComputedStyle(el).fontFamily,leading:getComputedStyle(el).lineHeight}));
        await page.getByRole('button',{name:'Read more',exact:true}).click();
        const full=page.locator('.surah-info-html');await expect(full).toBeVisible();
        expect(await full.evaluate(el=>({size:getComputedStyle(el).fontSize,font:getComputedStyle(el).fontFamily,leading:getComputedStyle(el).lineHeight}))).toEqual(preview);
        await healthy(page,'Surah introduction',info,width===390);
      }
      if (screen==='Search') {
        await page.getByRole('searchbox',{name:'Search the Quran'}).fill('zzzznotfoundaudit');
        await expect(page.getByText('No matching Surah or ayah found.')).toBeVisible();
        await page.getByRole('searchbox',{name:'Search the Quran'}).fill('2:255');
        await expect(page.locator('.search-result-card').first()).toBeVisible();
        await healthy(page,'Search results',info,width===390);
      }
      if (screen==='Settings') {
        await page.getByRole('button',{name:/Help and guide/i}).click();
        await expect(page.getByRole('heading',{name:'Help & Guide',exact:true})).toBeVisible();
        await healthy(page,'Help',info,width===390);
        await page.locator('.help-section-trigger').first().click();
        await healthy(page,'Help disclosure',info,false);
      }
    }
    await home(page);
    await page.getByRole('button',{name:/Begin reflecting|Continue lesson|Explore & revisit/i}).click();
    await healthy(page,'Reflect lessons',info,width===390);
    await page.getByRole('tab',{name:'Progress',exact:true}).click();
    const period=page.getByRole('button',{name:/^Progress period:/});
    await period.focus(); await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option',{name:'All time',exact:true})).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('option',{name:'This week',exact:true})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(period).toBeFocused(); await expect(period).toContainText('This week');
    await healthy(page,'Reflect progress',info,width===390);
    await page.getByRole('tab',{name:'Lessons',exact:true}).click();
    await page.getByRole('button',{name:/^QA saved lesson/}).click();
    await expect(page.locator('#reflect-imagine')).toHaveValue('QA persistence note');
    await healthy(page,'Reflect lesson',info,width===390);
    await page.setViewportSize({width,height:500});
    const answer=page.locator('#reflect-imagine');
    await answer.fill(`Keyboard note ${width} ${theme}`);
    await expect(answer).toBeFocused(); await expect(answer).toBeInViewport();
    await page.setViewportSize({width,height:844});
    await healthy(page,'Reflect edited answer',info,false);
    await home(page); await page.getByRole('button',{name:/Continue Reading/i}).click();
    await expect(page.locator('.reader-page').first()).toBeVisible();
    await healthy(page,'Reader',info,width===390);
    await expect.poll(() => page.locator('.reader-page').first().evaluate(el => getComputedStyle(el).gridTemplateRows.split(' ').length)).toBe(16);
  });
}

async function swipe(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const rect=await locator.boundingBox();
  const session=await page.context().newCDPSession(page);
  const y=rect.y+rect.height/2, start=rect.x+rect.width*.75;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
  for(let i=1;i<=8;i++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start-i*12,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await session.detach();
}
async function neutralSwipe(page, wrapper, surface, remove) {
  await swipe(page,surface);
  await expect(wrapper).toHaveClass(/is-swiped/);
  await expect(wrapper).toHaveAttribute('data-revealed','true');
  await expect(wrapper).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  // The foreground intentionally becomes opaque while revealing the red
  // stationary ::before layer. The action button itself stays transparent.
  const expectedOpaque=await surface.evaluate(el=>{
    const probe=document.createElement('span');
    probe.style.backgroundColor='var(--theme-surface-solid)';
    el.append(probe);
    const color=getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  await expect(surface).toHaveCSS('background-color',expectedOpaque);
  await expect(remove).toBeVisible();
  await expect(remove).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  expect(await wrapper.evaluate(el=>getComputedStyle(el,'::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
}
for(const theme of ['light','dark']) test(`Swipe exposure and lesson source surfaces ${theme}`,async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(theme=>{localStorage.setItem('quran-app-theme',theme);localStorage.setItem('quran-app-favorite-surahs','[1]');},theme);
  await home(page);await seedLocalRecords(page);await home(page);
  await neutralSwipe(page,page.locator('.home-favorite-swipe').first(),page.locator('.home-favorite-row').first(),page.locator('.home-favorite-delete').first());
  await page.locator('.home-favorite-delete').first().click();
  await expect(page.locator('.home-favorite-swipe')).toHaveCount(0);
  await page.getByRole('button',{name:'Library',exact:true}).click();
  for(const tab of ['Bookmarks','Highlights']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const wrapper=page.locator('.tab-card').first();
    await neutralSwipe(page,wrapper,wrapper.locator('.tab-card-surface'),wrapper.locator('.tab-card-remove'));
    await wrapper.locator('.tab-card-remove').click();
    await expect(page.locator('.tab-card')).toHaveCount(0);
  }
  await home(page);await page.getByRole('button',{name:/Begin reflecting|Continue lesson|Explore & revisit/i}).click();
  const wrapper=page.locator('.tab-card').first();
  await neutralSwipe(page,wrapper,wrapper.locator('.tab-card-surface'),wrapper.locator('.tab-card-remove'));
  await wrapper.locator('.tab-card-remove').click();
  const dialog=page.getByRole('alertdialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Cancel'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button',{name:'Remove',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:/^QA saved lesson/}).click();
  const passageColor=await page.locator('.reflect-passage-section').evaluate(el=>{
    const probe=document.createElement('span');
    probe.style.backgroundColor='var(--ui-card-bg)';
    el.append(probe);
    const color=getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  await expect(page.locator('.reflect-passage-section')).toHaveCSS('background-color',passageColor);
  await expect(page.locator('.reflect-ayah-body').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Expand Surah Introduction',exact:true}).click();
  await expect(page.locator('.reflect-surah-info-html')).toBeVisible();
  await expect(page.locator('.reflect-surah-info-html')).toHaveCSS('-webkit-line-clamp','none');
  await expect(page.getByRole('button',{name:/^(Read more|Show less)$/})).toHaveCount(0);
});

test('new lesson saves questions, themes, reflection and completed review',async({page})=>{
  test.setTimeout(120000);await home(page);
  await page.getByRole('button',{name:/Begin reflecting|Continue lesson|Explore & revisit/i}).click();
  await page.getByRole('button',{name:'New lesson',exact:true}).click();
  await expect(page.getByText('3 ayahs selected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Create Lesson',exact:true}).click();
  await expect(page.locator('#reflect-lesson-title')).toBeVisible({timeout:60000});
  await expect(page.locator('[data-reflect-ayah]')).toHaveCount(3);
  await page.locator('#reflect-lesson-title').fill('Created during independent audit');
  const keyword=page.locator('[data-keyword-key]').first();
  await expect(keyword).toBeVisible();await keyword.click();await expect(keyword).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Back from Reflect',exact:true}).click();
  await page.getByRole('button',{name:/^Created during independent audit/}).click();
  await expect(page.locator('[data-keyword-key]').first()).toHaveAttribute('aria-pressed','true');
  const populatedAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(populatedAudit.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('button',{name:'Add Question',exact:true}).click();
  await page.getByRole('textbox',{name:'New question',exact:true}).fill('How can I practice gratitude today?');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await page.getByRole('textbox',{name:'Answer question',exact:true}).fill('Recognize the blessings in the passage.');
  const themeButton=page.getByRole('button',{name:'Add Theme',exact:true});await themeButton.click();
  const sheet=page.getByRole('dialog',{name:'Edit themes',exact:true});await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);await expect(themeButton).toBeFocused();
  await themeButton.click();
  await sheet.locator('.reflect-theme-picker-heading').first().click();
  await sheet.getByRole('button',{name:'Select main theme only',exact:true}).click();
  await sheet.getByRole('button',{name:'Done',exact:true}).click();
  await expect(sheet).toHaveCount(0);
  await page.locator('#reflect-learning-summary').fill('Read carefully and give thanks.');
  await page.locator('#reflect-commitment').fill('Practice gratitude each evening.');
  await page.getByRole('button',{name:'Mark as finished',exact:true}).click();
  await expect(page.getByRole('radio',{name:"I'm practicing it",exact:true})).toBeVisible();
  await page.getByRole('radio',{name:"I'm practicing it",exact:true}).check();
  await page.getByRole('button',{name:'Back from Reflect',exact:true}).click();

  await page.getByRole('tab',{name:'Discover',exact:true}).click();
  await expect(page.locator('.reflect-keyword-link')).toHaveCount(1);
  await page.getByRole('tab',{name:'Themes',exact:true}).click();
  const mainTheme=page.locator('.reflect-theme-heading').first();
  if(await mainTheme.getAttribute('aria-expanded')!=='true')await mainTheme.click();
  await page.getByRole('button',{name:/^Other Studies/}).click();
  await expect(page.locator('.reflect-theme-study')).toHaveCount(1);
  await page.getByRole('tablist',{name:'Reflect sections',exact:true}).getByRole('tab',{name:'My Reflect'}).click();
  await page.getByRole('tab',{name:'Questions',exact:true}).click();
  const question=page.locator('.reflect-question-card').first();
  await neutralSwipe(page,question,question.locator('.tab-card-surface'),question.locator('.tab-card-remove'));
  await question.locator('.tab-card-remove').click();await expect(page.locator('.reflect-question-card')).toHaveCount(0);
  await page.getByRole('tab',{name:'Progress',exact:true}).click();
  await expect(page.getByText('Practice gratitude each evening.',{exact:true})).toBeVisible();
  await page.reload();await expect(page.locator('#root')).not.toBeEmpty();
  const record=await page.evaluate(async()=>{
    const database=await new Promise(resolve=>{const request=indexedDB.open('quranFluentLocal');request.onsuccess=()=>resolve(request.result);});
    return new Promise(resolve=>{const request=database.transaction('tadabburLessons').objectStore('tadabburLessons').getAll();request.onsuccess=()=>{database.close();resolve(request.result.find(row=>row.title==='Created during independent audit'));};});
  });
  expect(record.status).toBe('completed');expect(record.answers.tadabbur.commitment).toBe('Practice gratitude each evening.');expect(record.commitmentReview.status).toBe('practicing');
});
