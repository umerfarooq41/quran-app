import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** One viewport-aware listbox. Native top-layer rendering escapes card clipping
 * and stacking contexts while preserving the DOM/focus ownership of sheets. */
export function AppOptionPicker({ label, value, options, onSelect, className = '', description, compact = false, settingsStyle = false, iconOnly = false, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = next => { setLocalOpen(next); onOpenChange?.(next); };
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const menuId = useId();
  const descriptionId = useId();
  const selected = options.find(option => String(option.value) === String(value)) || options[0];
  const close = (restore = true) => { setOpen(false); if (restore) trigger.current?.focus({ preventScroll: true }); };

  useLayoutEffect(() => {
    if (!open || !menu.current) return undefined;
    const panel = menu.current;
    panel.showPopover?.();
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 8;
      const topEdge = (viewport?.offsetTop || 0) + 8;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
      const below = Math.max(0, bottomEdge - rect.bottom - 6);
      const above = Math.max(0, rect.top - topEdge - 6);
      const up = below < Math.min(300, options.length * 52 + 14) && above > below;
      const maxHeight = Math.min(340, up ? above : below);
      const width = Math.min(Math.max(rect.width, settingsStyle ? 320 : 180), rightEdge - leftEdge);
      Object.assign(panel.style, { width: `${width}px`, maxHeight: `${maxHeight}px`, left: `${Math.max(leftEdge, Math.min(rect.left, rightEdge - width))}px`, top: `${up ? Math.max(topEdge, rect.top - 6 - Math.min(panel.scrollHeight, maxHeight)) : rect.bottom + 6}px` });
    };
    position();
    focusSelectedOption(panel);
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      panel.hidePopover?.();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open, options.length, settingsStyle]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);

  return <div ref={root} className={`app-option-picker ${compact ? 'app-option-picker-compact' : ''} ${settingsStyle ? 'app-option-picker-settings' : ''} ${className}`}>
    <button ref={trigger} type="button" className="app-option-trigger" aria-label={`${label}: ${selected?.label ?? String(value)}`} aria-describedby={description ? descriptionId : undefined} aria-haspopup="listbox" aria-controls={open ? menuId : undefined} aria-expanded={open} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }} onClick={() => setOpen(!open)}>
      {!iconOnly && selected?.avatar && <img className="app-option-avatar" src={selected.avatar} alt="" />}
      {!iconOnly && <span className="app-option-label">{selected?.label ?? String(value)}</span>}
      <ChevronDown size={19} aria-hidden="true" className={open ? 'app-option-chevron is-open' : 'app-option-chevron'}/>
    </button>
    {description && <small id={descriptionId} className="app-option-description">{description}</small>}
    {open && <div ref={menu} id={menuId} popover="manual" data-reader-ui className={`app-option-menu ${settingsStyle ? "app-option-menu-settings" : ""}`} role="listbox" aria-label={label} onKeyDown={event => handleListboxKeyDown(event, () => close(false))}>
      {options.map(option => {
        const active = String(option.value) === String(value);
        return <button key={option.value} type="button" role="option" tabIndex={active ? 0 : -1} aria-selected={active} className={'app-option-item' + (active ? ' is-selected' : '')} onClick={() => { onSelect(option.value); close(); }}>
          {option.avatar && <img className="app-option-avatar" src={option.avatar} alt="" />}
          <span className="app-option-label">{option.label}</span>{active && <Check size={17} aria-hidden="true"/>}
        </button>;
      })}
    </div>}
  </div>;
}

export function focusSelectedOption(root) {
  const option = root?.querySelector('[aria-selected="true"]') || root?.querySelector('[role="option"]');
  option?.focus({ preventScroll: true });
  scrollOptionIntoView(root, option);
}

function scrollOptionIntoView(menu, option) {
  if (!menu || !option) return;
  const item = option.getBoundingClientRect(), panel = menu.getBoundingClientRect();
  if (item.top < panel.top + 6) menu.scrollTop += item.top - panel.top - 6;
  else if (item.bottom > panel.bottom - 6) menu.scrollTop += item.bottom - panel.bottom + 6;
}

export function handleListboxKeyDown(event, onDismiss) {
  const items = [...event.currentTarget.querySelectorAll('[role="option"]')];
  const index = items.indexOf(document.activeElement);
  let next;
  if (event.key === 'ArrowDown') next = (index + 1) % items.length;
  if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = items.length - 1;
  if (next !== undefined) { event.preventDefault(); items[next]?.focus({ preventScroll: true }); scrollOptionIntoView(event.currentTarget, items[next]); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDismiss(); }
  if (event.key === 'Tab') onDismiss();
}
