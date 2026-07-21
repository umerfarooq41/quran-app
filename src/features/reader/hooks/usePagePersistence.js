import { useEffect } from 'react';
import { saveLastRead } from '../../../lib/db';

export function usePagePersistence({ page, pageData, lastReadTarget, setLastReadTarget }) {
  useEffect(() => {
    const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
    const exactTarget = Number(lastReadTarget?.page) === Number(page)
      && lastReadTarget?.surahNumber
      && lastReadTarget?.ayahNumber
      ? lastReadTarget
      : null;

    const target = exactTarget || (first
      ? { page, surahNumber: first.surahNumber, ayahNumber: first.ayahStart }
      : { page });

    if (!exactTarget && first) setLastReadTarget(target);

    saveLastRead(target).catch(() => {
      // Keep reading available even when persistence is temporarily unavailable.
    });
  }, [page, pageData.lines, lastReadTarget, setLastReadTarget]);
}
