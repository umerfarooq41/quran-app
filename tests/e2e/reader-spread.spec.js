import { test, expect } from '@playwright/test';

const leaves = page => page.locator('.reader-page-slide-current .reader-page-leaf');
async function open(page, width=1180, height=820, theme='light') {
  await page.setViewportSize({width,height});
  await page.addInitScript(theme => localStorage.setItem('quran-app-theme', theme), theme);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.getByRole('button',{name:/Continue Reading/}).click();
  await expect(leaves(page).first()).toBeVisible();
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.evaluate(()=>document.fonts.ready);
}
async function numbers(page) {return leaves(page).evaluateAll(els=>els.map(el=>Number(el.dataset.readerPage)));}
async function chrome(page) {await page.locator('[data-reader-toggle-zone]').first().click({force:true});}

for(const theme of ['light','dark']) {
  test(`adaptive spread preserves RTL pages, metadata and active page on rotation ${theme}`,async({page},info)=>{
    await open(page,1180,820,theme);
    await expect.poll(()=>numbers(page)).toEqual([1,2]);
    const rects=await leaves(page).evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,rows:el.querySelectorAll('[data-quran-line]').length,header:el.querySelector('.reader-passive-header').textContent,footer:el.querySelector('.reader-footer-meta').textContent};}));
    expect(rects[0].x).toBeGreaterThan(rects[1].x);
    for(const rect of rects){expect(rect.width/rect.height).toBeCloseTo(.64,3);expect(rect.rows).toBe(16);expect(rect.header).not.toBe('');expect(rect.footer).not.toBe('');}
    await page.keyboard.press('ArrowLeft');await expect.poll(()=>numbers(page)).toEqual([3,4]);
    await expect(page.locator('.reader-page-slide-viewport')).not.toHaveClass(/is-transitioning/);
    await page.setViewportSize({width:820,height:1180});await expect.poll(()=>numbers(page)).toEqual([3]);
    await page.keyboard.press('ArrowLeft');await expect.poll(()=>numbers(page)).toEqual([4]);
    await page.setViewportSize({width:1180,height:820});await expect.poll(()=>numbers(page)).toEqual([3,4]);
    await page.setViewportSize({width:844,height:390});await expect.poll(()=>numbers(page)).toEqual([4]);
    await page.setViewportSize({width:1180,height:820});await expect.poll(()=>numbers(page)).toEqual([3,4]);
    await info.attach(`spread-${theme}`,{body:await page.screenshot({path:info.outputPath(`reader-${theme}.png`)}),contentType:'image/png'});
  });
  test(`central controls and persisted single-page preference ${theme}`,async({page},info)=>{
    await open(page,1365,900,theme);await chrome(page);
    const toolbar=await page.locator('.reader-topbar').boundingBox();expect(toolbar.width).toBe(1365);
    await expect.poll(async()=>{const box=await page.locator('.reader-bottom-controls').boundingBox();return Math.abs(box.y+box.height/2-450);}).toBeLessThan(1);
    await page.getByRole('button',{name:'Reader layout: Auto',exact:true}).click();
    await page.keyboard.press('ArrowLeft');await expect.poll(()=>numbers(page)).toEqual([1,2]);
    await page.getByRole('option',{name:'Single page',exact:true}).click();
    await expect.poll(()=>numbers(page)).toEqual([1]);
    await page.getByRole('button',{name:'Next page',exact:true}).click();await expect.poll(()=>numbers(page)).toEqual([2]);
    await page.reload();await expect(leaves(page).first()).toBeVisible({timeout:20000});await expect.poll(()=>numbers(page)).toEqual([2]);await chrome(page);
    await page.getByRole('button',{name:'Reader layout: Single page',exact:true}).click();
    await page.getByRole('option',{name:'Two pages',exact:true}).click();await expect.poll(()=>numbers(page)).toEqual([1,2]);
    await chrome(page);
    const word=leaves(page).nth(1).locator('.quran-word').first();await word.click();
    const translation=page.locator('.ayah-translation-card');await expect(translation).toBeVisible();
    await page.setViewportSize({width:820,height:1180});await expect.poll(()=>numbers(page)).toEqual([2]);
    await page.setViewportSize({width:1365,height:900});await expect.poll(()=>numbers(page)).toEqual([1,2]);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    const box=await translation.boundingBox();expect(box.x+box.width/2).toBeCloseTo(1365/2,0);
    await info.attach(`central-translation-${theme}`,{body:await page.screenshot({path:info.outputPath(`reader-${theme}.png`)}),contentType:'image/png'});
  });
}

test('mouse margin drag advances a spread and short drag returns without navigation',async({page})=>{
  await open(page);const box=await leaves(page).first().boundingBox();
  const x=box.x+5,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:4});await page.mouse.up();
  await expect(page.locator('.reader-page-slide-viewport')).not.toHaveClass(/is-settling/);expect(await numbers(page)).toEqual([1,2]);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+150,y,{steps:6});await page.mouse.up();
  await expect.poll(()=>numbers(page)).toEqual([3,4]);
  await page.keyboard.press('ArrowRight');await expect.poll(()=>numbers(page)).toEqual([1,2]);
});

test('touch swipe advances spread and reduced motion changes pages immediately',async({page})=>{
  await open(page);const client=await page.context().newCDPSession(page);const box=await leaves(page).first().boundingBox();
  const x=box.x+5,y=box.y+box.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let dx=20;dx<=160;dx+=20) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>numbers(page)).toEqual([3,4]);
  await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('ArrowLeft');
  await expect.poll(()=>numbers(page)).toEqual([5,6]);await expect(page.locator('.reader-page-slide-viewport')).not.toHaveClass(/is-transitioning|is-settling/);
});

test('small portrait controls fit and the page slider opens the exact last page without wrapping',async({page},info)=>{
  await open(page,320,844);await chrome(page);
  for(const width of [320,375,390,430,768]) {
    await page.setViewportSize({width,height:width===768?1024:844});
    await expect.poll(()=>numbers(page)).toEqual([1]);
    const outside=await page.locator('.reader-topbar button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth;}).map(el=>el.getAttribute('aria-label')));
    expect(outside).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1180,height:820});await expect.poll(()=>numbers(page)).toEqual([1,2]);
  await page.getByRole('slider').press('End');await expect.poll(()=>numbers(page)).toEqual([547,548]);
  await expect(page.getByRole('button',{name:'Next spread',exact:true})).toBeDisabled();
  await page.setViewportSize({width:820,height:1180});await expect.poll(()=>numbers(page)).toEqual([548]);
  await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
  await info.attach('Last page portrait',{body:await page.screenshot(),contentType:'image/png'});
});

for (const device of [{name:'tablet',width:1180,height:820,request:'unlock'},{name:'phone',width:390,height:844,request:'portrait'}]) {
  test(`installed-app orientation policy permits ${device.name} layout`,async({page})=>{
    await page.addInitScript(({width,height})=>{
      window.__readerOrientationCalls=[];
      Object.defineProperty(screen,'width',{configurable:true,value:width});
      Object.defineProperty(screen,'height',{configurable:true,value:height});
      Object.defineProperty(screen,'orientation',{configurable:true,value:{angle:0,lock:async value=>window.__readerOrientationCalls.push(value),unlock:()=>window.__readerOrientationCalls.push('unlock')}});
    },device);
    await open(page,device.width,device.height);
    await expect.poll(()=>page.evaluate(()=>window.__readerOrientationCalls)).toContain(device.request);
    await expect(page.locator('html')).toHaveAttribute('data-app-landscape-lock','none');
    await expect.poll(()=>numbers(page)).toEqual(device.name==='tablet'?[1,2]:[1]);
    const manifest=await (await page.request.get('/manifest.json')).json();expect(manifest.orientation).toBe('any');
  });
}
