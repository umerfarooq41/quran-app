import { useEffect, useRef } from 'react';

const SLIDE_START_THRESHOLD = 12;
const PAGE_TURN_THRESHOLD = 70;
const LONG_PRESS_GUARD_MS = 360;

export function useReaderGestures({
  page,
  goPage,
  onSlideMove,
  onSlideEnd,
  onSlideCancel,
}) {
  const touchStart = useRef(null);
  const pointerStart = useRef(null);
  const pointerListeners = useRef(null);

  useEffect(() => () => removePointerListeners(), []);

  function removePointerListeners() {
    const listeners = pointerListeners.current;
    if (!listeners) return;

    window.removeEventListener('pointermove', listeners.move);
    window.removeEventListener('pointerup', listeners.end);
    window.removeEventListener('pointercancel', listeners.cancel);
    pointerListeners.current = null;
  }

  function shouldIgnoreGesture(event) {
    const target = event.target;
    if (!(target instanceof Element)) return true;
    if (target.closest('[data-reader-ui]')) return true;
    return !target.closest('.reader-page-slide-viewport');
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 1 || shouldIgnoreGesture(event)) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: Date.now(),
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
      if (Date.now() - touchStart.current.startedAt > LONG_PRESS_GUARD_MS) {
        touchStart.current = null;
        return;
      }
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

  function handlePointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary || shouldIgnoreGesture(event)) {
      pointerStart.current = null;
      removePointerListeners();
      return;
    }

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: Date.now(),
      sliding: false,
    };

    const move = (moveEvent) => handlePointerMove(moveEvent);
    const end = (endEvent) => handlePointerEnd(endEvent);
    const cancel = (cancelEvent) => handlePointerCancel(cancelEvent);
    pointerListeners.current = { move, end, cancel };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
  }

  function handlePointerMove(event) {
    const start = pointerStart.current;
    if (!start || event.pointerId !== start.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (!start.sliding) {
      if (Date.now() - start.startedAt > LONG_PRESS_GUARD_MS) {
        pointerStart.current = null;
        removePointerListeners();
        return;
      }
      if (Math.abs(deltaX) < SLIDE_START_THRESHOLD || !horizontalIntent) return;
      start.sliding = true;
    }

    onSlideMove?.(deltaX);

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  function handlePointerEnd(event) {
    const start = pointerStart.current;
    if (!start || event.pointerId !== start.pointerId) return;

    const delta = event.clientX - start.x;
    const committed = Math.abs(delta) > PAGE_TURN_THRESHOLD;

    if (start.sliding) {
      const handled = onSlideEnd?.({ deltaX: delta, committed });
      pointerStart.current = null;
      removePointerListeners();

      if (committed && handled !== true) {
        goPage(delta > 0 ? page + 1 : page - 1);
      }
      return;
    }

    pointerStart.current = null;
    removePointerListeners();
  }

  function handlePointerCancel(event) {
    const start = pointerStart.current;
    if (!start || event.pointerId !== start.pointerId) return;

    if (start.sliding) onSlideCancel?.();
    pointerStart.current = null;
    removePointerListeners();
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handlePointerDown,
  };
}
