import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSurahTimeline,
  findAyahAtTime,
  findAyahTiming,
  findWordAtTime,
} from '../src/lib/fullSurahAudio.js';

test('buildSurahTimeline keeps valid ayahs in chronological order', () => {
  const timeline = buildSurahTimeline({
    '1:2': {
      timestamp_from: 1200,
      timestamp_to: 2200,
      segments: [[1, 1200, 1600], [2, 1600, 2200]],
    },
    '1:1': {
      timestamp_from: 0,
      timestamp_to: 1000,
      segments: [[1, 0, 400], [2, 400, 1000]],
    },
    '2:1': {
      timestamp_from: 2200,
      timestamp_to: 3000,
      segments: [[1, 2200, 3000]],
    },
    '1:3': {
      timestamp_from: 900,
      timestamp_to: 800,
      segments: [],
    },
  }, 1);

  assert.deepEqual(timeline.map((ayah) => ayah.verseKey), ['1:1', '1:2']);
  assert.deepEqual(timeline[0].wordSegments.map((word) => word.position), [1, 2]);
});

test('findAyahAtTime respects starts, ends, gaps and Surah boundaries', () => {
  const timeline = buildSurahTimeline({
    '1:1': { timestamp_from: 0, timestamp_to: 1000, segments: [] },
    '1:2': { timestamp_from: 1200, timestamp_to: 2200, segments: [] },
  }, 1);

  assert.equal(findAyahAtTime(timeline, -1), null);
  assert.equal(findAyahAtTime(timeline, 0)?.ayahNumber, 1);
  assert.equal(findAyahAtTime(timeline, 999)?.ayahNumber, 1);
  assert.equal(findAyahAtTime(timeline, 1000), null);
  assert.equal(findAyahAtTime(timeline, 1100), null);
  assert.equal(findAyahAtTime(timeline, 1200)?.ayahNumber, 2);
  assert.equal(findAyahAtTime(timeline, 2200), null);
  assert.equal(findAyahTiming(timeline, 2)?.startMs, 1200);
  assert.equal(findAyahTiming(timeline, 3), null);
});

test('findWordAtTime highlights the active word without leaking across long pauses', () => {
  const timeline = buildSurahTimeline({
    '1:1': {
      timestamp_from: 0,
      timestamp_to: 1500,
      segments: [
        [1, 0, 450],
        [2, 500, 900],
        [3, 1200, 1450],
      ],
    },
  }, 1);
  const ayah = findAyahTiming(timeline, 1);

  assert.equal(findWordAtTime(ayah, 0)?.position, 1);
  assert.equal(findWordAtTime(ayah, 499)?.position, 1);
  assert.equal(findWordAtTime(ayah, 500)?.position, 2);
  assert.equal(findWordAtTime(ayah, 1050), null);
  assert.equal(findWordAtTime(ayah, 1200)?.position, 3);
  assert.equal(findWordAtTime(ayah, 1500), null);
});

test('invalid timing input produces no timeline or active word', () => {
  assert.deepEqual(buildSurahTimeline(null, 1), []);
  assert.deepEqual(buildSurahTimeline({ '1:1': { timestamp_from: -1, timestamp_to: 0 } }, 1), []);
  assert.deepEqual(buildSurahTimeline({ '1:1': { timestamp_from: 0, timestamp_to: 10 } }, 0), []);
  assert.equal(findWordAtTime(null, 0), null);
});
