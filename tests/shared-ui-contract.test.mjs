import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load = (name) => readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');
test('Index, Library and Reflect share a column-aware segmented control', async () => {
  const [shared, reflect, index] = await Promise.all([load('shared-surfaces'), load('reflect'), load('index')]);
  assert.match(shared, /repeat\(var\(--ui-segment-columns, 2\), minmax\(0, 1fr\)\)/);
  // Reflect has two main tabs, three My Reflect sub-tabs, and two Discover sub-tabs.
  assert.match(reflect, /\.reflect-screen \.reflect-tabs\s*\{\s*--ui-segment-columns:\s*2/);
  assert.match(reflect, /\.reflect-screen \.reflect-subtabs\s*\{\s*--ui-segment-columns:\s*3/);
  assert.match(reflect, /\.reflect-screen \.reflect-subtabs:has\(> button:nth-child\(2\):last-child\)\s*\{\s*--ui-segment-columns:\s*2/);
  assert.doesNotMatch(index, /\.share-like-segment\s*\{/);
  assert.match(shared, /button:not\(\.is-active\)/);
});
test('Reflect lesson fields and question cards use shared surface roles', async () => {
  const [shared, tabs] = await Promise.all([load('reflect'), load('tabs')]);
  for (const cls of ['reflect-question-card .tab-card-surface','reflect-question-answer','reflect-lesson-answer','reflect-lesson-title-input']) assert.ok(shared.includes(cls));
  assert.doesNotMatch(tabs, /background:\s*color-mix\(in srgb, var\(--accent-color[^\n]+white\)/);
});
test('Search, Help and Settings cards rely on the shared surface definition', async () => {
  const [shared,settings,search,help] = await Promise.all([load('shared-surfaces'),load('settings'),load('search'),load('help')]);
  for (const cls of ['search-result-card','settings-card','help-section']) assert.ok(shared.includes('.'+cls));
  for (const [cls,css] of [['settings-card',settings],['search-result-card',search],['help-section',help]]) {
    const escaped=cls.replace(/-/g,'\\-');
    const block=css.match(new RegExp('\\.'+escaped+'\\s*\\{([^}]+)\\}'))?.[1] || '';
    // Component-owned declarations may explicitly reference the shared card token,
    // but cannot introduce another hardcoded surface color.
    const backgrounds = [...block.matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/g)].map(match => match[1].trim());
    for (const background of backgrounds) assert.match(background, /^var\(--ui-card-bg\)$/);
  }
});
