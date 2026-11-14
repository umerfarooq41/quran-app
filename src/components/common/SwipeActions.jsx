import React, { useEffect, useLayoutEffect, useRef } from 'react';

const ACTION_WIDTH = 92;
const ACTION_SELECTOR = '.tab-card-remove,.home-favorite-delete,input,textarea';

/**
 * A single physical offset drives both the opaque moving card and red reveal.
 * Track the gesture at document level so motion remains continuous when the
 * pointer leaves a rounded card or the browser retargets its pointer events.
 */
export function SwipeActions({ as: Element = 'article', open, onOpenChange, className = '', children, ...props }) {
  const nodeRef = useRef(null);
  const offsetRef = useRef(open ? ACTION_WIDTH : 0);
  const frameRef = useRef(0);
  const gestureRef = useRef(null);
  const clearListenersRef = useRef(null);
  const suppressClickRef = useRef(false);
  const openRef = useRef(open);
  const changeRef = useRef(onOpenChange);
  openRef.current = open;
  changeRef.current = onOpenChange;

  function paint(value) {
    const node = nodeRef.current;
    if (!node) return;
    const bounded = Math.max(0, Math.min(ACTION_WIDTH, value));
    offsetRef.current = bounded;
    node.style.setProperty('--swipe-offset', `${bounded}px`);
    node.dataset.revealed = bounded > 0 ? 'true' : 'false';
  }

  function settle(target) {
    cancelAnimationFrame(frameRef.current);
    const initial = offsetRef.current;
    const started = performance.now();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
    const tick = now => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      paint(initial + (target - initial) * (1 - (1 - progress) ** 3));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  useLayoutEffect(() => {
    if (!gestureRef.current) settle(open ? ACTION_WIDTH : 0);
  }, [open]);

  useEffect(() => () => {
    clearListenersRef.current?.();
    cancelAnimationFrame(frameRef.current);
  }, []);

  function onPointerDown(event) {
    if ((event.pointerType === 'mouse' && event.button !== 0) || !event.isPrimary
        || event.target.closest(ACTION_SELECTOR)) return;
    clearListenersRef.current?.();
    cancelAnimationFrame(frameRef.current);
    suppressClickRef.current = false;
    const start = {
      id: event.pointerId,
      x: event.clientX, y: event.clientY,
      initial: offsetRef.current,
      dragging: false,
    };
    gestureRef.current = start;

    function move(pointer) {
      if (gestureRef.current !== start || pointer.pointerId !== start.id) return;
      const dx = pointer.clientX - start.x;
      const dy = pointer.clientY - start.y;
      if (!start.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          finishListeners();
          gestureRef.current = null;
          settle(openRef.current ? ACTION_WIDTH : 0);
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        start.dragging = true;
      }
      if (pointer.cancelable) pointer.preventDefault();
      paint(start.initial - dx);
    }

    function finishListeners() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', cancel);
      if (clearListenersRef.current === finishListeners) clearListenersRef.current = null;
    }

    function release(pointer) {
      if (pointer.pointerId !== start.id) return;
      const dx = pointer.clientX - start.x;
      const dy = pointer.clientY - start.y;
      const horizontal = Math.abs(dx) >= 10 && Math.abs(dx) >= Math.abs(dy) * 1.3;
      finishListeners();
      gestureRef.current = null;
      if (!start.dragging && !horizontal) {
        settle(openRef.current ? ACTION_WIDTH : 0);
        return;
      }
      if (horizontal) paint(start.initial - dx);
      suppressClickRef.current = true;
      const next = offsetRef.current >= ACTION_WIDTH / 2;
      if (next !== openRef.current) changeRef.current(next);
      settle(next ? ACTION_WIDTH : 0);
    }

    function cancel(pointer) {
      if (pointer.pointerId !== start.id) return;
      finishListeners();
      gestureRef.current = null;
      settle(openRef.current ? ACTION_WIDTH : 0);
    }

    clearListenersRef.current = finishListeners;
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', cancel);
  }

  function onClickCapture(event) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (openRef.current && !event.target.closest('.tab-card-remove,.home-favorite-delete')) {
      changeRef.current(false);
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return <Element {...props} ref={nodeRef}
    className={`ui-swipe-actions ${className} ${open ? 'is-swiped' : ''}`}
    onPointerDownCapture={onPointerDown}
    onClickCapture={onClickCapture}
  >{children}</Element>;
}
