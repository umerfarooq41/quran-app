import test from 'node:test';
import assert from 'node:assert/strict';
import { getReflectRangeCount, isValidReflectRange } from '../src/features/reflect/reflectRules.js';

test('accepts the minimum and maximum passage lengths', () => {
  assert.equal(isValidReflectRange(1, 3, 10), true);
  assert.equal(isValidReflectRange(1, 15, 20), true);
});

test('rejects passages shorter or longer than the allowed range', () => {
  assert.equal(isValidReflectRange(1, 2, 20), false);
  assert.equal(isValidReflectRange(1, 16, 20), false);
});

test('rejects reversed, invalid, and out-of-Surah selections', () => {
  assert.equal(isValidReflectRange(5, 3, 20), false);
  assert.equal(isValidReflectRange(0, 3, 20), false);
  assert.equal(isValidReflectRange(8, 10, 9), false);
  assert.equal(isValidReflectRange('x', 3, 20), false);
});

test('counts the selected range inclusively', () => {
  assert.equal(getReflectRangeCount(4, 6), 3);
  assert.equal(getReflectRangeCount(4, 18), 15);
});
