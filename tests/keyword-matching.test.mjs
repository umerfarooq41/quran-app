import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabicForKeyword, findMatchingMeaning } from '../src/features/reflect/keywordMatching.js';

test('IndoPak Urdu yeh matches Arabic yeh without changing the displayed word', () => {
  const quranUrdu = 'الرَّحِیْمِ';
  const saved = 'الرَّحِيمِ';
  assert.equal(normalizeArabicForKeyword(quranUrdu), normalizeArabicForKeyword(saved));
  const words = [
    { id:'1:3:1', arabic:'الرَّحْمٰنِ', meaning:'جو بہت مہربان' },
    { id:'1:3:2', arabic:quranUrdu, meaning:'بار بار رحم فرمانے والا ہے' },
  ];
  assert.equal(findMatchingMeaning(words, {location:'1:3:2',arabic:saved,key:'3:1'}), 'بار بار رحم فرمانے والا ہے');
  assert.equal(quranUrdu, 'الرَّحِیْمِ');
});

test('Repeated words must not borrow an unrelated translation', () => {
  const words = [
    { id:'2:5:1', arabic:'مِنْ', meaning:'سے' },
    { id:'2:5:4', arabic:'مِنْ', meaning:'میں سے' },
  ];
  assert.equal(findMatchingMeaning(words, {arabic:'مِنْ'}), null);
  assert.equal(findMatchingMeaning(words, {arabic:'مِنْ',location:'2:5:4'}), 'میں سے');
});
