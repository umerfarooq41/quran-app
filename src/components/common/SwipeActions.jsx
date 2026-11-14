import React, { useLayoutEffect, useRef } from 'react';

const ACTION_WIDTH = 92;

/** One animated offset drives the foreground and reveal; the outer card owns corner clipping. */
export function SwipeActions({ as: Element = 'article', open, onOpenChange, className = '', children, ...props }) {
  const nodeRef = useRef(null);
  const gesture = useRef(null);
  const offset = useRef(open ? ACTION_WIDTH : 0);
  const frame = useRef(0);
  const suppressClick = useRef(false);

  function paint(value) {
    const node = nodeRef.current;
    if (!node) return;
    offset.current = value;
    node.style.setProperty('--swipe-offset', `${value}px`);
    node.dataset.revealed = value > 0 ? 'true' : 'false';
  }

  function settle(target) {
    cancelAnimationFrame(frame.current);
    const initial = offset.current, started = performance.now();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
    const tick = now => {
      const progress = duration ? Math.min(1, (now - started) / duration) : 1;
      paint(initial + (target - initial) * (1 - (1 - progress) ** 3));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  useLayoutEffect(() => {
    settle(open ? ACTION_WIDTH : 0);
    return () => cancelAnimationFrame(frame.current);
  }, [open]);

  return <Element {...props} ref={nodeRef} className={`ui-swipe-actions ${className} ${open ? 'is-swiped' : ''}`}
    onPointerDown={event => {
      suppressClick.current = false;
      if (event.button !== 0 || !event.isPrimary || event.target.closest('.tab-card-remove,.home-favorite-delete,input,textarea')) return;
      cancelAnimationFrame(frame.current);
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: offset.current, dragging: false };
    }}
    onPointerMove={event => {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!start.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; settle(open ? ACTION_WIDTH : 0); return; }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        start.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      paint(Math.max(0, Math.min(ACTION_WIDTH, start.initial - dx)));
    }}
    onPointerUp={event => {
      const start = gesture.current;
      gesture.current = null;
      if (!start || start.id !== event.pointerId) return;
      // Some browsers coalesce a fast drag into pointerup without delivering
      // the last pointermove. Complete it using the final pointer position.
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const horizontal = Math.abs(dx) >= 10 && Math.abs(dx) >= Math.abs(dy) * 1.3;
      if (!start.dragging && !horizontal) {
        settle(open ? ACTION_WIDTH : 0);
        return;
      }
      if (horizontal) paint(Math.max(0, Math.min(ACTION_WIDTH, start.initial - dx)));
      suppressClick.current = true;
      const next = offset.current >= ACTION_WIDTH / 2;
      onOpenChange(next);
      settle(next ? ACTION_WIDTH : 0);
    }}
    onPointerCancel={() => { gesture.current = null; settle(open ? ACTION_WIDTH : 0); }}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
      if (open && !event.target.closest('.tab-card-remove,.home-favorite-delete')) { onOpenChange(false); event.preventDefault(); event.stopPropagation(); }
    }}
  >{children}</Element>;
}
