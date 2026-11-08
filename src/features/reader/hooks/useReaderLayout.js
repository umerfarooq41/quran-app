import { useEffect, useState } from 'react';

// A portrait page stays proportional in a spread. Small landscape phones and
// short windows retain the established single-page renderer.
export function resolveReaderLayout(width, height, preference = 'auto') {
  const spreadWidth = Math.min(576, (height - 84) * 0.64, (width - 48) / 2);
  const canSpread = width > height && width >= 900 && spreadWidth >= 360;
  const spread = preference !== 'single' && canSpread;
  return { spread, pageWidth: spread ? spreadWidth : null, pageHeight: spread ? spreadWidth / 0.64 : null };
}

export function readerSpreadStart(page) {
  return Math.floor((page - 1) / 2) * 2 + 1;
}

export function useReaderLayout(preference) {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return resolveReaderLayout(size.width, size.height, preference);
}
