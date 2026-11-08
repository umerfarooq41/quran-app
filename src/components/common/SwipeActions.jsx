import React, { useLayoutEffect, useRef } from 'react';

const ACTION_WIDTH = 92;

/** One animated offset drives the foreground and the curved reveal mask. */
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
    const width = node.clientWidth, height = node.clientHeight;
    const radius = Math.min(parseFloat(getComputedStyle(node).borderTopRightRadius) || 0, height / 2);
    const edge = width - value;
    // Complement of the translated foreground's trailing rounded edge.
    // The outer container supplies the other (stationary) rounded boundary.
    const path = value === 0 ? 'M 0 0 Z' : `M ${edge-radius} 0 H ${width} V ${height} H ${edge-radius} A ${radius} ${radius} 0 0 0 ${edge} ${height-radius} V ${radius} A ${radius} ${radius} 0 0 0 ${edge-radius} 0 Z`;
    node.style.setProperty('--swipe-offset', `${value}px`);
    node.style.setProperty('--swipe-reveal', `path('${path}')`);
    node.style.setProperty('--swipe-opacity', Math.min(1, value / 24));
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
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => paint(offset.current));
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, []);

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
    onPointerUp={() => {
      const start = gesture.current;
      gesture.current = null;
      if (!start?.dragging) { settle(open ? ACTION_WIDTH : 0); return; }
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
