import { useRef } from 'react';

const SLIDE_START_THRESHOLD = 12;
const PAGE_TURN_THRESHOLD = 70;

export function useReaderGestures({
  page,
  goPage,
  onSlideMove,
  onSlideEnd,
  onSlideCancel,
}) {
  const touchStart = useRef(null);

  function handleTouchStart(event) {
    if (event.target.closest('[data-reader-ui]')) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      sliding: false,
    };
  }

  function handleTouchMove(event) {
    if (!touchStart.current) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (!touchStart.current.sliding) {
      if (Math.abs(deltaX) < SLIDE_START_THRESHOLD || !horizontalIntent) return;
      touchStart.current.sliding = true;
    }

    onSlideMove?.(deltaX);

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event) {
    if (!touchStart.current) return;

    const delta = event.changedTouches[0].clientX - touchStart.current.x;
    const committed = Math.abs(delta) > PAGE_TURN_THRESHOLD;

    if (touchStart.current.sliding) {
      const handled = onSlideEnd?.({ deltaX: delta, committed });
      touchStart.current = null;

      if (committed && handled !== true) {
        goPage(delta > 0 ? page + 1 : page - 1);
      }

      return;
    }

    if (committed) {
      const handled = onSlideEnd?.({ deltaX: delta, committed });
      touchStart.current = null;

      if (handled === true) return;

      goPage(delta > 0 ? page + 1 : page - 1);
      return;
    }

    touchStart.current = null;
  }

  function handleTouchCancel() {
    if (touchStart.current?.sliding) onSlideCancel?.();
    touchStart.current = null;
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
