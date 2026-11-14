import { test, expect } from '@playwright/test';
import { openReader, mockRecitation, pauseRecitation, wordEvent } from './fixtures/reader-ui.js';

for (const [width,height,count] of [[390,844,1],[844,390,1],[768,1024,1],[1024,768,2],[1280,800,2],[1440,900,2]]) {
  test(`automatic Reader layout ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await openReader(page);
    await expect(page.locator('.reader-page-slide-current .reader-page-leaf')).toHaveCount(count);
    await page.locator('[data-reader-toggle-zone]').first().click({force:true});
    await expect(page.getByRole('button',{name:/Reader layout/})).toHaveCount(0);
    await expect(page.locator('.reader-topbar').getByRole('button')).toHaveCount(4);
    await expect(page.getByRole('button',{name:'Search',exact:true})).toBeVisible();
  });
}

for (const theme of ['light','dark']) {
  test(`Settings listboxes escape glass cards and stay inside viewport ${theme}`, async ({page}) => {
    await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
    await page.goto('/');
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    for (const label of ['Translator','Audio reciter']) {
      const trigger=page.getByRole('button',{name:new RegExp(`^${label}:`)});
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger.locator('..')).toHaveCSS('border-top-width','0px');
      const scroll=page.locator('.app-scroll-content');
      const before=await scroll.evaluate(el=>el.scrollTop);
      await trigger.click();
      await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBe(before);
      const menu=page.getByRole('listbox',{name:label,exact:true});
      await expect(menu).toBeVisible();
      expect(await menu.evaluate(el=>el.matches(':popover-open'))).toBe(true);
      const box=await menu.boundingBox(), viewport=page.viewportSize();
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      const color=await menu.evaluate(el=>getComputedStyle(el).backgroundColor);
      expect(color).not.toMatch(/rgba\(.+, 0\.\d+\)/);
      await page.keyboard.press('End');await page.keyboard.press('Enter');
      await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
      await trigger.click();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
    }
    await expect(page.getByText('Page layout',{exact:true})).toHaveCount(0);
  });
  test(`Search uses keyboard submit and a clear control ${theme}`,async({page})=>{
    await page.addInitScript(theme=>localStorage.setItem('quran-app-theme',theme),theme);
    await page.goto('/');await page.getByRole('button',{name:'Search',exact:true}).click();
    const input=page.getByRole('searchbox',{name:'Search the Quran'});
    await input.fill('2:255');await input.press('Enter');
    await expect(page.locator('.search-result-card').first()).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toHaveCount(0);
    await page.getByRole('button',{name:'Clear search the quran'}).click();await expect(input).toHaveValue('');
  });
}

test('holding an ayah opens actions even when Reader chrome is visible',async({page})=>{
  await openReader(page);
  const chrome=page.locator('.reader-topbar-visible');
  if (!await chrome.isVisible()) await page.locator('[data-reader-toggle-zone]').first().click({force:true});
  await expect(chrome).toBeVisible();
  const word=page.locator('.reader-page-slide-current .quran-line-ayah:not([aria-hidden="true"]) .quran-word[data-verse-key]').first();
  await expect(word).toBeVisible();
  const box=await word.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await expect(page.getByRole('toolbar',{name:'Ayah actions'})).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('toolbar',{name:'Ayah actions'})).toBeVisible();
});

test('touch hold opens ayah actions without requiring a contextmenu',async({page})=>{
  await openReader(page);
  const word=page.locator('.reader-page-slide-current .quran-line-ayah:not([aria-hidden="true"]) .quran-word[data-verse-key]').first();
  await expect(word).toBeVisible();
  const rect=await word.boundingBox();
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  const client=await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await page.waitForTimeout(520);
  await expect(page.getByRole('toolbar',{name:'Ayah actions'})).toBeVisible();
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
});

test('compact audio reciter picker preserves controls and elapsed/total labels',async({page})=>{
  await mockRecitation(page);await openReader(page);
  await page.locator('[data-reader-toggle-zone]').first().click({force:true});
  await page.locator('.reader-listen-pill').click();await pauseRecitation(page);
  const trigger=page.getByRole('button',{name:/^Reciters:/});
  await expect(trigger).toHaveCSS('border-top-width','0px');
  await trigger.click();await expect(page.getByRole('listbox',{name:'Reciters',exact:true})).toBeVisible();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByRole('listbox',{name:'Reciters',exact:true})).toHaveCount(0);
  await pauseRecitation(page,false);
  await expect(page.locator('[aria-label="Elapsed time"]')).toHaveText('0:00');
  await expect(page.locator('[aria-label="Total duration"]')).not.toHaveText('0:00');
  await expect(page.getByRole('slider',{name:'Audio progress'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
});

test('Share selectors close after selection without reopening a controlled menu',async({page})=>{
  await openReader(page);await wordEvent(page,'contextmenu');
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Share Quran',exact:true})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Share Quran media settings'});
  await nav.getByRole('button',{name:'Audio',exact:true}).click();
  for(const label of ['Surah','From','To']) {
    const trigger=page.getByRole('button',{name:new RegExp(`^${label}:`)});
    await trigger.scrollIntoViewIfNeeded();await trigger.click();
    const menu=page.getByRole('listbox',{name:label,exact:true});
    await expect(menu).toBeVisible();
    await menu.getByRole('option').nth(1).click();
    await expect(menu).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Video',exact:true}).click();
  await nav.getByRole('button',{name:'Audio',exact:true}).click();
  await page.getByRole('button',{name:/^Share reciter:/}).click();
  const reciters=page.getByRole('listbox',{name:'Share reciter',exact:true});
  await reciters.getByRole('option').nth(1).click();
  await expect(reciters).toHaveCount(0);

});


/* Palette surface regression: verify the semantic aliases actually reach cards.
   This guards against reintroducing fixed light colors on secondary screens. */
test('all palettes preserve card surfaces in light and dark Settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const card = page.locator('.settings-card').first();
  await expect(card).toBeVisible();

  for (const theme of ['light', 'dark']) {
    for (const palette of ['green', 'blue', 'burgundy', 'charcoal']) {
      const values = await page.evaluate(({ theme, palette }) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.palette = palette;
        const root = getComputedStyle(document.documentElement);
        const computedCard = getComputedStyle(document.querySelector('.settings-card'));
        return {
          surface: root.getPropertyValue('--surface-card').trim(),
          base: root.getPropertyValue('--surface-base').trim(),
          alias: root.getPropertyValue('--ui-card-bg').trim(),
          actual: computedCard.backgroundColor,
        };
      }, { theme, palette });

      expect(values.alias, `${theme}/${palette} card alias`).toBe(values.surface);
      expect(values.actual, `${theme}/${palette} rendered card`).toBe(
        values.surface.startsWith('#') ? hexToRgb(values.surface) : values.surface
      );
      expect(values.base).not.toBe(values.surface);
    }
  }
  await expect(page.getByText('Auto follows your device theme', { exact: true })).toHaveCount(0);
});

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const expanded = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const numeric = Number.parseInt(expanded, 16);
  return `rgb(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255})`;
}


test('Share Quran settings surfaces follow all eight palettes without recoloring preview', async ({ page }) => {
  await openReader(page);
  await wordEvent(page, 'contextmenu');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const settings = page.locator('.share-media-settings-card');
  const tabs = page.locator('.share-media-tabs');
  const modes = page.locator('.share-media-mode-switch');
  const preview = page.locator('.share-media-live-preview');
  await expect(settings).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect(modes).toBeVisible();
  await expect(preview).toBeVisible();

  for (const theme of ['light', 'dark']) {
    for (const palette of ['green', 'blue', 'burgundy', 'charcoal']) {
      const colors = await page.evaluate(({ theme, palette }) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.palette = palette;
        const style = element => getComputedStyle(document.querySelector(element));
        const root = getComputedStyle(document.documentElement);
        return {
          card: root.getPropertyValue('--surface-card').trim(),
          settings: style('.share-media-settings-card').backgroundColor,
          tabs: style('.share-media-tabs').backgroundColor,
          modes: style('.share-media-mode-switch').backgroundColor,
          selectedMode: style('.share-media-mode-switch button.is-active').backgroundColor,
          selectedFill: root.getPropertyValue('--ui-interactive-fill').trim(),
          preview: style('.share-media-live-preview').backgroundColor,
        };
      }, { theme, palette });
      const expected = colors.card.startsWith('#') ? hexToRgb(colors.card) : colors.card;
      expect(colors.settings, `${theme}/${palette} Share settings card`).toBe(expected);
      expect(colors.tabs, `${theme}/${palette} Share tabs surface`).toBe(expected);
      expect(colors.modes, `${theme}/${palette} Share mode surface`).toBe(expected);
      expect(colors.selectedMode, `${theme}/${palette} active media type`).toBe(
        colors.selectedFill.startsWith('#') ? hexToRgb(colors.selectedFill) : colors.selectedFill
      );
      expect(colors.preview, 'export preview retains its own background').not.toBe(expected);
    }
  }
});
