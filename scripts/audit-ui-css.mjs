#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

export function audit(directory = 'src') {
  const files = fs.readdirSync(directory, { recursive: true }).filter(p => p.endsWith('.css')).sort().map(p => path.join(directory, p));
  const occurrences = new Map();
  const declarations = new Map();
  const duplicateDeclarations = [];
  const summary = [];
  const contexts = node => {
    const result = [];
    for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') result.unshift(`@${p.name} ${p.params}`);
    return result.join(' > ');
  };
  for (const file of files) {
    const root = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
    const row = { file, rules: 0, declarations: 0, important: 0, hardcodedHex: 0, fontSizes: 0 };
    root.walkRules(rule => {
      row.rules++;
      const context = contexts(rule);
      for (const selector of rule.selectors) {
        const key = `${context}\n${selector.trim()}`;
        const entries = occurrences.get(key) || [];
        entries.push({ file, line: rule.source.start.line });
        occurrences.set(key, entries);
        for (const d of rule.nodes.filter(n => n.type === 'decl')) {
          const propertyKey = `${key}\n${d.prop}`;
          const values = declarations.get(propertyKey) || [];
          values.push({ value: d.value, important: Boolean(d.important), file, line: d.source.start.line });
          declarations.set(propertyKey, values);
        }
      }
      const seen = new Map();
      rule.each(d => {
        if (d.type !== 'decl') return;
        const key = `${d.prop}:${d.value}:${Boolean(d.important)}`;
        if (seen.has(key)) duplicateDeclarations.push({ file, selector: rule.selector, context, property: d.prop, line: d.source.start.line });
        seen.set(key, d);
      });
    });
    root.walkDecls(d => {
      row.declarations++;
      if (d.important) row.important++;
      row.hardcodedHex += (d.value.match(/#[\da-f]{3,8}\b/gi) || []).length;
      if (d.prop === 'font-size') row.fontSizes++;
    });
    summary.push(row);
  }
  const conflicts = [...declarations].filter(([, values]) => new Set(values.map(v => `${v.value}!${v.important}`)).size > 1).map(([key, values]) => {
    const parts = key.split('\n'); return { context: parts[0], selector: parts[1], property: parts[2], values };
  });
  const ownership = [...occurrences].filter(([, entries]) => new Set(entries.map(e => e.file)).size > 1).map(([key, locations]) => ({ key, locations }));
  const duplicateSelectors = [...occurrences].filter(([, entries]) => entries.length > 1).map(([key, locations]) => ({ key, locations }));
  return { note: 'PostCSS AST audit. Conflicts are candidates, including intentional fallbacks and theme/state rules; absence from static source is not proof a selector is obsolete.', cssFiles: files.length, totals: Object.fromEntries(['rules','declarations','important','hardcodedHex','fontSizes'].map(key => [key, summary.reduce((n,r) => n+r[key],0)])), files: summary, crossFileOwnership: ownership, conflictingDeclarations: conflicts, duplicateDeclarations, duplicateSelectors };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) console.log(JSON.stringify(audit(), null, 2));
