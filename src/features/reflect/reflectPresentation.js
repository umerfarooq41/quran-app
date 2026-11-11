import { getSurah } from '../../lib/quran';

/** Presentation-only defaults shared by Reflect screens and panels. */
export const reflectCardClass = 'reflect-panel rounded-2xl border p-4 shadow-sm';
export const reflectActionClass = 'rounded-xl bg-[#2d6e5e] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
export const reflectFieldClass = 'reflect-field w-full rounded-xl border px-3 py-3 text-sm outline-none';
export const studyDisplayTitle = (lesson) => lesson.title?.trim() || `${lesson.surahName || getSurah(lesson.surahNumber)?.name || 'Surah ' + lesson.surahNumber} ${lesson.surahNumber}:${lesson.startAyah}–${lesson.endAyah}`;
export const DEFAULT_THEMES = {
  'Faith & Theology': ['Tawheed', 'Attributes of Allah', 'Hereafter', 'The Unseen'],
  'Prophets & History': ['Stories of the Prophets', 'Past Nations', 'Trials & Resilience'],
  'Worship & Ethics': ['Prayer & Worship', 'Justice', 'Family & Relationships', 'Honesty'],
  'Heart Purification': ['Patience', 'Gratitude', 'Repentance & Hope', 'Trust in Allah', 'Humility'],
  'Paradise & Hell': ['Paradise', 'Hellfire', 'Accountability'],
};
export const assignmentsFor = (studyThemes = {}) => {
  if (Array.isArray(studyThemes.assignments)) return studyThemes.assignments;
  return studyThemes.main ? [{ main: studyThemes.main, sub: studyThemes.sub || [] }] : [];
};
