import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for(const theme of ['light','dark']) test(`Settings keyboard controls, About and restored Translation ${theme}`,async({page},info)=>{
  test.setTimeout(60000);
  await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Al Quran'})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const picker=page.getByRole('button',{name:/^Audio reciter:/});
  await picker.focus();await page.keyboard.press('ArrowDown');
  const list=page.getByRole('listbox',{name:'Audio reciter',exact:true});await expect(list).toBeVisible();
  await expect(list.locator('[aria-selected="true"]')).toBeFocused();
  await page.keyboard.press('End');await expect(list.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Escape');await expect(picker).toBeFocused();
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  const reset=page.getByRole('button',{name:'Reset settings',exact:true});await reset.click();
  const dialog=page.getByRole('alertdialog',{name:'Reset settings?',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Reset',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(reset).toBeFocused();
  await page.getByRole('button',{name:/About Al Quran/}).click();
  await expect(page.getByRole('heading',{name:'About',exact:true})).toBeVisible();
  await page.locator('.about-section-trigger').first().click();
  await page.evaluate(()=>document.fonts.ready);
  let results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await info.attach('About '+theme,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  // This retained route is reached through navigation restoration, not a new UI entry point.
  await page.evaluate(()=>sessionStorage.setItem('quran-app-navigation-snapshot-v1',JSON.stringify({view:'tafsir',page:1,viewHistory:['home','reader'],tafsirTarget:{surahNumber:1,ayahNumber:2,page:1,reference:'1:2'}})));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Translation',exact:true})).toBeVisible();
  await expect(page.locator('.tafsir-card')).toBeVisible();
  await expect(page.locator('.tafsir-translation-text')).not.toBeEmpty();
  results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await info.attach('Full Translation '+theme,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
});
