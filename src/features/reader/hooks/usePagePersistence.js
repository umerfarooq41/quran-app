import { useEffect } from 'react';
import { saveLastRead } from '../../../lib/db';

export function usePagePersistence({ page, pageData, lastReadTarget, setLastReadTarget }) {
  useEffect(() => {
    const exactTarget = Number(lastReadTarget?.page) === Number(page)
      && lastReadTarget?.surahNumber
      && lastReadTarget?.ayahNumber
      ? lastReadTarget
      : null;

    // Merely viewing/turning to a page does not prove which ayah the reader
    // reached. Persist the page alone unless an ayah-level action already
    // supplied an exact target for this page.
    const target = exactTarget
      ? {
          page,
          surahNumber: Number(exactTarget.surahNumber),
          ayahNumber: Number(exactTarget.ayahNumber),
        }
      : { page };

    saveLastRead(target).catch(() => {
      // Keep reading available even when persistence is temporarily unavailable.
    });
  }, [page, pageData.lines, lastReadTarget, setLastReadTarget]);
}
