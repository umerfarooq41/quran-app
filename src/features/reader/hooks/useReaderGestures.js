import { useRef } from 'react';

export function useReaderGestures({ page, goPage }) {
  const touchStart = useRef(null);

  function handleTouchStart(event) {
    if (event.target.closest('[data-reader-ui]')) {
      touchStart.current = null;
      return;
    }

    touchStart.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (!touchStart.current) return;

    const delta = event.changedTouches[0].clientX - touchStart.current;

    if (Math.abs(delta) > 70) {
      goPage(delta > 0 ? page + 1 : page - 1);
    }

    touchStart.current = null;
  }

  return {
    handleTouchStart,
    handleTouchEnd,
  };
}
