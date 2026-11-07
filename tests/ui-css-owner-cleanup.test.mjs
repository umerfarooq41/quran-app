import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import postcss from 'postcss';
const read = name => fs.readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');

test('Theme contains semantic tokens, not screen or component overrides', async () => {
  const root = postcss.parse(await read('theme'));
  root.walkRules(rule => {
    assert.match(rule.selector, /^:root/);
    rule.walkDecls(d => assert.ok(d.prop.startsWith('--'), `${rule.selector}: ${d.prop}`));
  });
  assert.match(root.toString(), /--reader-bg:/);
});

test('Retired cascade layers are no longer imported', async () => {
  const main = await fs.readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  for (const name of ['mobile-first','ui-polish','index-refined']) assert.ok(!main.includes(`/styles/${name}.css`));
  assert.ok(main.includes('/styles/reflect.css'));
});

test('Responsive chrome and protected Share states live in their owners', async () => {
  const [reader,app,index,mushaf] = await Promise.all(['share','app','index','mushaf'].map(read));
  assert.match(mushaf, /background: var\(--reader-bg/);
  assert.match(reader, /\.share-video-fullscreen-shell/);
  assert.match(reader, /\.share-video-preview-stage/);
  assert.match(app, /data-app-landscape-lock='counterclockwise'/);
  assert.match(index, /\.index-surah-read-more\s*\{[^}]*color: var\(--theme-text\)/s);
});

test('Ordinary screen owners use the normal cascade; protected renderers own exceptions', async () => {
  for (const name of ['app','base','help','home','index','reflect','search','settings','shared-surfaces','tabs','tafsir','theme','tokens']) {
    const root = postcss.parse(await read(name));
    root.walkDecls(d => assert.ok(!d.important, `${name}: ${d.prop}`));
  }
});
