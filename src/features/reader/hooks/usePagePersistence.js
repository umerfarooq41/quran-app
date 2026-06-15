import { useEffect } from 'react';
import { saveLastRead } from '../../../lib/db';

export function usePagePersistence({ page, pageData }) {
  useEffect(() => {
    const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);

    saveLastRead({
      page,
      surahNumber: first?.surahNumber,
      ayahNumber: first?.ayahStart,
    });
  }, [page, pageData.lines]);
}
