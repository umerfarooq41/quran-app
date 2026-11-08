import React, { useRef } from 'react';

/** A shared pointer gesture; the action moves into only the revealed strip.
 * Vertical gestures keep native scrolling and never commit a delete. */
export function SwipeActions({ as: Element = 'article', open, onOpenChange, className = '', children, ...props }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const reset = node => { node.style.removeProperty('--swipe-offset'); node.classList.remove('is-swiping'); };
  return <Element {...props} className={`ui-swipe-actions ${className} ${open ? 'is-swiped' : ''}`}
    onPointerDown={event => {
      if (event.button !== 0 || event.target.closest('.tab-card-remove,.home-favorite-delete,input,textarea')) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: open ? 92 : 0, dragging: false };
    }}
    onPointerMove={event => {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!start.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return; }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        start.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('is-swiping');
      }
      event.preventDefault();
      start.offset = Math.max(0, Math.min(92, start.initial - dx));
      event.currentTarget.style.setProperty('--swipe-offset', `${start.offset}px`);
    }}
    onPointerUp={event => {
      const start = gesture.current;
      gesture.current = null;
      if (!start?.dragging) return;
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 400);
      onOpenChange(start.offset >= 46);
      reset(event.currentTarget);
    }}
    onPointerCancel={event => { gesture.current = null; reset(event.currentTarget); }}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
      if (open && !event.target.closest('.tab-card-remove,.home-favorite-delete')) { onOpenChange(false); event.preventDefault(); event.stopPropagation(); }
    }}
  >{children}</Element>;
}
