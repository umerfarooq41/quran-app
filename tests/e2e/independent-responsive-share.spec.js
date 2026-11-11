import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { wordEvent } from './fixtures/reader-ui.js';

async function capture(page, info, name, selector = '.share-quran-screen') {
  await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.locator(selector).evaluate(root=>{
    const nodes=[root,...root.querySelectorAll('section,article,input,textarea,nav')];
    return nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);}).map(el=>el.className);
  });
  expect(overflow,name).toEqual([]);
  if(page.viewportSize().width===390) {
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),name).toEqual([]);
  }
  await info.attach(name,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
}
for(const theme of ['light','dark']) for(const width of [320,375,390,430,768]) test(`Share controls ${theme} ${width}px`,async({page},info)=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height:844});
  await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.getByRole('button',{name:/Continue Reading/}).click();
  await page.evaluate(()=>document.fonts.ready);await wordEvent(page,'contextmenu');
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Share Quran',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Image',exact:true}).click();
  await expect(page.locator('.quran-share-generated-image')).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Share Quran media settings'});
  // The baseline exposes these three tabs; sizing controls live in Text.
  for(const name of ['Audio','Background','Text']) {
    await nav.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.share-media-settings-card')).toBeVisible();
    await capture(page,info,name);
  }
  const translation=page.getByRole('switch',{name:'Include translation'});
  const state=await translation.getAttribute('aria-checked');
  await translation.click();await expect(translation).toHaveAttribute('aria-checked',state==='true'?'false':'true');
  await page.getByRole('button',{name:'Video',exact:true}).click();
  await expect(page.locator('.share-video-preview-stage')).toBeVisible();
  await expect(page.getByRole('button',{name:'Fullscreen preview',exact:true})).toBeVisible();
  await capture(page,info,'Video preview');
  await page.evaluate(()=>sessionStorage.clear());await page.goto('/?discovery-audit');
  await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.getByRole('button',{name:/Begin reflecting|Continue lesson|Explore & revisit/}).click();
  await page.getByRole('tab',{name:'Discover',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved Keywords',exact:true})).toBeVisible();
  await capture(page,info,'Discover keywords','.reflect-screen');
  await page.getByRole('tab',{name:'Themes',exact:true}).click();
  const themeHeader=page.locator('.reflect-theme-heading').first();await themeHeader.click();
  await expect(themeHeader).toHaveAttribute('aria-expanded','true');
  await page.locator('.reflect-subtheme-heading').first().click();
  await expect(page.getByText('No saved studies yet.',{exact:true})).toBeVisible();
  await capture(page,info,'Discover themes','.reflect-screen');
});
