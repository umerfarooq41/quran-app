import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Index base styles inherit shared theme colors', async () => {
  const css = await readFile(new URL('../src/styles/index.css', import.meta.url), 'utf8');
  for (const selector of ['.index-replica-shell', '.index-card', '.index-surah-text strong']) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
  assert.match(css, /var\(--theme-text/);
  assert.match(css, /var\(--theme-muted/);
  assert.match(css, /var\(--ui-card-bg/);
  assert.doesNotMatch(css, /color:\s*#(?:111315|17181b|08090a|101113)\b/);
});
