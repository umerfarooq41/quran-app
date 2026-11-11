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

  function handlePointerDown(event) {
    if (event.button !== 0 || !event.isPrimary || shouldIgnoreGesture(event)) {
      pointerStart.current = null;
      removePointerListeners();
      return;
    }

    removePointerListeners();
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
      if (Math.abs(deltaY) > SLIDE_START_THRESHOLD && !horizontalIntent) {
        pointerStart.current = null;
        removePointerListeners();
        return;
      }
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
    handlePointerDown,
  };
}
