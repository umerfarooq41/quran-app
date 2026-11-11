import React from 'react';
import { getSurah } from '../../../lib/quran';

/** Theme discovery's compact study link. */
export default function ThemeStudyButton({ lesson, onOpen }) {
  return <button type="button" className="reflect-theme-study" onClick={() => onOpen(lesson)}>
    <strong>{lesson.surahName || getSurah(lesson.surahNumber)?.name} {lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah}</strong>
    <small>{lesson.status === 'completed' ? 'Completed' : 'In progress'}</small>
  </button>;
}
