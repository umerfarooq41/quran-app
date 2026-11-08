import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Shared scrollable dropdown for app selections. Uses semantic picker tokens. */
export function AppOptionPicker({ label, value, options, onSelect, className = '' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const selected = options.find(option => String(option.value) === String(value));
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const closeEscape = event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [open]);
  useEffect(() => {
    if (open) {
      focusSelectedOption(root.current);
    }
  }, [open]);
  return <div ref={root} className={'app-option-picker ' + className}>
    <button ref={trigger} type="button" className="app-option-trigger" aria-label={`${label}: ${selected?.label ?? String(value)}`} aria-haspopup="listbox" aria-controls={open ? menuId : undefined} aria-expanded={open} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }} onClick={() => setOpen(previous => !previous)}>
      <span className="truncate">{selected?.label ?? String(value)}</span>
      <ChevronDown size={19} aria-hidden="true" className={open ? 'app-option-chevron is-open' : 'app-option-chevron'}/>
    </button>
    {open && <div id={menuId} className="app-option-menu" role="listbox" aria-label={label} onKeyDown={event => handleListboxKeyDown(event, close)}>
      {options.map(option => {
        const active = String(option.value) === String(value);
        return <button key={option.value} type="button" role="option" tabIndex={active ? 0 : -1} aria-selected={active} className={'app-option-item' + (active ? ' is-selected' : '')}
          onClick={() => { onSelect(option.value); close(); }}>
          <span>{option.label}</span>{active && <Check size={17} aria-hidden="true"/>}
        </button>;
      })}
    </div>}
  </div>;
}

/** Shared keyboard behavior for compact and avatar/viewport-aware listboxes. */
export function focusSelectedOption(root) {
  const option = root?.querySelector('[aria-selected="true"]') || root?.querySelector('[role="option"]');
  option?.focus();
  option?.scrollIntoView({ block: 'nearest' });
}

export function handleListboxKeyDown(event, onDismiss) {
  const items = [...event.currentTarget.querySelectorAll('[role="option"]')];
  const index = items.indexOf(document.activeElement);
  let next;
  if (event.key === 'ArrowDown') next = (index + 1) % items.length;
  if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = items.length - 1;
  if (next !== undefined) { event.preventDefault(); items[next]?.focus(); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDismiss(); }
  if (event.key === 'Tab') onDismiss();
}
