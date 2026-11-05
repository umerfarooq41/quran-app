import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFLECT_MIN_AYAHS,
  REFLECT_MAX_AYAHS,
  getReflectRangeCount,
  isValidReflectRange,
} from '../src/features/reflect/reflectRules.js';

test('Reflect passage limits remain 3 to 15 Ayahs', () => {
  assert.equal(REFLECT_MIN_AYAHS, 3);
  assert.equal(REFLECT_MAX_AYAHS, 15);
});

test('accepts the minimum and maximum passage lengths', () => {
  assert.equal(isValidReflectRange(1, 3, 10), true);
  assert.equal(isValidReflectRange(1, 15, 20), true);
});

test('accepts valid numeric-string inputs consistently', () => {
  assert.equal(isValidReflectRange('2', '4', '10'), true);
});

test('rejects passages shorter or longer than the allowed range', () => {
  assert.equal(isValidReflectRange(1, 2, 20), false);
  assert.equal(isValidReflectRange(0, 0, 20), false);
  assert.equal(isValidReflectRange(1, 16, 20), false);
});

test('rejects reversed, invalid, fractional, and out-of-Surah selections', () => {
  assert.equal(isValidReflectRange(5, 3, 20), false);
  assert.equal(isValidReflectRange(0, 3, 20), false);
  assert.equal(isValidReflectRange(8, 10, 9), false);
  assert.equal(isValidReflectRange('x', 3, 20), false);
  assert.equal(isValidReflectRange(1.5, 4, 20), false);
  assert.equal(isValidReflectRange(1, 4, 0), false);
});

test('counts selected Ayahs inclusively', () => {
  assert.equal(getReflectRangeCount(4, 6), 3);
  assert.equal(getReflectRangeCount(4, 18), 15);
});

test('returns zero for non-integer range endpoints', () => {
  assert.equal(getReflectRangeCount('x', 4), 0);
  assert.equal(getReflectRangeCount(1.2, 4), 0);
});

test('returns a negative count for reversed endpoints, which validation rejects', () => {
  assert.equal(getReflectRangeCount(5, 3), -1);
  assert.equal(isValidReflectRange(5, 3, 20), false);
});
