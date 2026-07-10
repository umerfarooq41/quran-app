import { useEffect, useState } from 'react';

const READER_LANDSCAPE_QUERY = '(orientation: landscape) and (hover: none) and (pointer: coarse)';

export function useReaderLandscape() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(READER_LANDSCAPE_QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const query = window.matchMedia(READER_LANDSCAPE_QUERY);
    const update = () => setIsLandscape(query.matches);

    update();
    query.addEventListener?.('change', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      query.removeEventListener?.('change', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);


  return isLandscape;
}
