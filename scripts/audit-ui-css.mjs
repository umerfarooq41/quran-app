#!/usr/bin/env node
// Read-only baseline for the coordinated UI migration. Run: node scripts/audit-ui-css.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('src');
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await walk(full);
    else if (item.isFile() && full.endsWith('.css')) files.push(full);
  }
}
await walk(root);
const selectorLocations = new Map();
const summary = [];
for (const file of files.sort()) {
  const css = await readFile(file, 'utf8');
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...clean.matchAll(/(?:^|})\s*([^{}]+)\s*\{/g)]
    .map(m => m[1].trim())
    .filter(s => s && !s.startsWith('@') && !s.includes('}'));
  for (const selector of selectors) {
    const normalized = selector.replace(/\s+/g, ' ');
    const locations = selectorLocations.get(normalized) ?? [];
    locations.push(path.relative('.', file));
    selectorLocations.set(normalized, locations);
  }
  summary.push({
    file: path.relative('.', file),
    important: (clean.match(/!important\b/g) ?? []).length,
    hardcodedHex: (clean.match(/#[\da-fA-F]{3,8}\b/g) ?? []).length,
    fontSizes: (clean.match(/font-size\s*:/g) ?? []).length,
    rules: selectors.length
  });
}
const totals = Object.fromEntries(['important','hardcodedHex','fontSizes','rules']
  .map(key => [key, summary.reduce((n, row) => n + row[key], 0)]));
const duplicates = [...selectorLocations.entries()]
  .filter(([, locations]) => locations.length > 1)
  .map(([selector, locations]) => ({ selector, count: locations.length, files: [...new Set(locations)] }))
  .sort((a, b) => b.count - a.count);
console.log(JSON.stringify({
  note: 'Static baseline only. Repeated selectors can be intentional (media queries, themes); review before removal.',
  cssFiles: files.length, totals, duplicateSelectors: duplicates.length,
  files: summary.sort((a,b) => b.important - a.important),
  topDuplicateSelectors: duplicates.slice(0, 100)
}, null, 2));
