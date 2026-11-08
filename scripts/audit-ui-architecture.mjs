#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'espree';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import valueParser from 'postcss-value-parser';
import { audit } from './audit-ui-css.mjs';

const files = fs.readdirSync('src', { recursive: true }).map(file => path.join('src', file));
const graph = new Map();
const missing = [];
const classText = [];
const inlineStyleOwners = [];
const utilityColorCandidates = [];
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) value.forEach(item => walk(item, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function resolve(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const target = path.normalize(path.join(path.dirname(from), specifier));
  const found = ['', '.js', '.jsx', '.json', '.css', '/index.js', '/index.jsx'].map(suffix => target + suffix).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!found) missing.push({ from, specifier });
  return found;
}
for (const file of files.filter(file => /\.(jsx?|css)$/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = [];
  if (file.endsWith('.css')) {
    postcss.parse(source).walkAtRules('import', rule => {
      const target = valueParser(rule.params).nodes.find(node => node.type === 'string')?.value;
      if (target) imports.push(target);
    });
  } else {
    walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module', loc: true, ecmaFeatures: { jsx: true } }), node => {
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) imports.push(node.source.value);
      if (node.type === 'ImportExpression' && node.source.type === 'Literal') imports.push(node.source.value);
      if (node.type === 'JSXAttribute' && node.name?.name === 'style') inlineStyleOwners.push({file,line:node.loc.start.line});
      if (node.type === 'Literal' && typeof node.value === 'string') {
        classText.push(node.value);
        for (const match of node.value.matchAll(/(?:bg|text|border)-\[(#[\da-fA-F]{3,8})\]/g)) utilityColorCandidates.push({file,line:node.loc.start.line,color:match[1],utility:match[0]});
      }
      if (node.type === 'TemplateElement') classText.push(node.value.raw);
    });
  }
  graph.set(file, imports.map(specifier => resolve(file, specifier)).filter(Boolean));
}
const active = new Set();
function visit(file) { if (active.has(file)) return; active.add(file); (graph.get(file) || []).forEach(visit); }
visit('src/main.jsx');
const css = files.filter(file => file.endsWith('.css'));
const tokens = new Map();
const literals = new Map();
const unusedCandidates = [];
const repeatedThemeAncestors = [];
const specificityCandidates = [];
const breakpoints = new Map();
const referencedClasses = classText.join('\n');
for (const file of css) {
  const root = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
  root.walkAtRules('media', rule => {
    const list = breakpoints.get(rule.params) || []; list.push({ file, line: rule.source.start.line }); breakpoints.set(rule.params, list);
  });
  root.walkDecls(declaration => {
    const location = { file, line: declaration.source.start.line, value: declaration.value };
    if (declaration.prop.startsWith('--')) { const list = tokens.get(declaration.prop) || []; list.push(location); tokens.set(declaration.prop, list); }
    if (/color|background|font-size|padding|margin|gap|radius/.test(declaration.prop)) {
      const key = `${declaration.prop}: ${declaration.value}`;
      const list = literals.get(key) || []; list.push(location); literals.set(key, list);
    }
  });
  root.walkRules(rule => {
    selectorParser(selectors => selectors.each(selector => {
      let ids = 0, classes = 0;
      const absent = [];
      selector.walkIds(() => ids++);
      selector.walkAttributes(() => classes++);
      selector.walkPseudos(node => { if (![':where', ':is', ':not', ':has'].includes(node.value)) classes++; });
      selector.walkClasses(node => {
        classes++;
        if (!referencedClasses.includes(node.value) && !referencedClasses.includes(node.value.replace(/-[^-]+$/, '-'))) absent.push(node.value);
      });
      const location = { file, line: rule.source.start.line, selector: selector.toString() };
      if (absent.length) unusedCandidates.push({ ...location, absent });
      if (ids || classes > 4) specificityCandidates.push({ ...location, ids, classAttributePseudoNodes: classes });
      if ((selector.toString().match(/\[data-theme/g) || []).length > 1) repeatedThemeAncestors.push(location);
    })).processSync(rule.selector);
  });
}
const result = {
  ...audit(),
  dependencyGraph: Object.fromEntries(graph),
  inactiveStylesheets: css.filter(file => !active.has(file)), missingImports: missing,
  retiredDependencies: [...graph].flatMap(([from, targets]) => targets.filter(target => /mobile-first|index-refined|ui-polish/.test(target)).map(target => ({ from, target }))),
  inlineStyleOwners, utilityColorCandidates,
  tokenDefinitions: Object.fromEntries(tokens), repeatedStyleValues: Object.fromEntries([...literals].filter(([, entries]) => entries.length > 1)),
  responsiveContexts: Object.fromEntries(breakpoints), repeatedThemeAncestors, specificityCandidates, unusedCandidates,
  limitations: 'Literal-class absence is a review candidate, not proof of dead CSS. Specificity counts are structural candidates, not Selectors Level 4 scores. Repeated semantic token values and media contexts can be deliberate. Import graph covers static and literal dynamic local imports.'
};
console.log(JSON.stringify(result, null, 2));
