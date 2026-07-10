import { useEffect, useState } from 'react';

const ORIENTATION_QUERY = '(orientation: landscape)';
const COARSE_POINTER_QUERY = '(pointer: coarse)';
const NO_HOVER_QUERY = '(hover: none)';

function readReaderLandscapeState() {
  if (typeof window === 'undefined') return false;

  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const orientationMatches = window.matchMedia?.(ORIENTATION_QUERY).matches
    ?? viewportWidth > viewportHeight;

  if (!orientationMatches && viewportWidth <= viewportHeight) return false;

  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const hasCoarsePointer = window.matchMedia?.(COARSE_POINTER_QUERY).matches || false;
  const hasNoHover = window.matchMedia?.(NO_HOVER_QUERY).matches || false;
  const hasCompactLandscapeViewport = viewportHeight <= 760;

  // Touch devices use the native landscape Reader. The compact-height
  // fallback also makes Chrome device emulation and resized local testing
  // activate the same layout even when pointer media features are inaccurate.
  return hasTouch || hasCoarsePointer || hasNoHover || hasCompactLandscapeViewport;
}

export function useReaderLandscape() {
  const [isLandscape, setIsLandscape] = useState(readReaderLandscapeState);

  useEffect(() => {
    const orientationQuery = window.matchMedia?.(ORIENTATION_QUERY);
    const coarsePointerQuery = window.matchMedia?.(COARSE_POINTER_QUERY);
    const noHoverQuery = window.matchMedia?.(NO_HOVER_QUERY);
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setIsLandscape(readReaderLandscapeState());
      });
    };

    update();
    orientationQuery?.addEventListener?.('change', update);
    coarsePointerQuery?.addEventListener?.('change', update);
    noHoverQuery?.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.screen?.orientation?.addEventListener?.('change', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(frame);
      orientationQuery?.removeEventListener?.('change', update);
      coarsePointerQuery?.removeEventListener?.('change', update);
      noHoverQuery?.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.screen?.orientation?.removeEventListener?.('change', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return isLandscape;
}
