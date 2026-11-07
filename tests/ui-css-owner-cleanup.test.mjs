import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readStyle = (name) => readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');

test('Mobile chrome uses reader theme tokens without hardcoded light paper', async () => {
  const mobile = await readStyle('mobile-first');
  assert.match(mobile, /background: linear-gradient\(180deg, var\(--reader-bg\)/);
  assert.doesNotMatch(mobile, /background(?:-color)?: #fffaf1\s*!important/);
  assert.match(mobile, /\.index-surah-read-more\s*\{[^}]*color: var\(--theme-text\)/s);
});

test('Theme and Reader CSS preserve content and layout ownership', async () => {
  const [theme,reader,mobile] = await Promise.all(['theme','reader','mobile-first'].map(readStyle));
  assert.match(theme,/--reader-bg:/);
  assert.match(reader,/\.share-video-fullscreen-shell/);
  assert.match(reader,/\.share-video-preview-stage/);
  assert.match(mobile,/data-app-landscape-lock='counterclockwise'/);
});
