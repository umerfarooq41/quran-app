import { useEffect } from 'react';
import { saveLastRead } from '../../../lib/db';

export function usePagePersistence({ page, pageData, debounceMs = 0 }) {
  useEffect(() => {
    const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
    const persist = () => saveLastRead({
      page,
      surahNumber: first?.surahNumber,
      ayahNumber: first?.ayahStart,
    });

    if (!debounceMs) {
      persist();
      return undefined;
    }

    const timer = window.setTimeout(persist, debounceMs);
    return () => window.clearTimeout(timer);
  }, [page, pageData.lines, debounceMs]);
}
