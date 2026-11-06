import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Shared, scrollable picker for study passage and progress filters. */
export function AppOptionPicker({ label, value, options, onSelect, className = '' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const selected = options.find(option => String(option.value) === String(value));
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const closeEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [open]);
  useEffect(() => {
    if (open) root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open]);
  return <div ref={root} className={'app-option-picker ' + className}>
    <button type="button" className="app-option-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>
      <span className="truncate">{selected?.label ?? String(value)}</span>
      <ChevronDown size={19} aria-hidden="true" className={open ? 'app-option-chevron is-open' : 'app-option-chevron'}/>
    </button>
    {open && <div className="app-option-menu" role="listbox" aria-label={label}>
      {options.map(option => {
        const active = String(option.value) === String(value);
        return <button key={option.value} type="button" role="option" aria-selected={active} className={'app-option-item' + (active ? ' is-selected' : '')}
          onClick={() => { onSelect(option.value); setOpen(false); }}>
          <span>{option.label}</span>{active && <Check size={17} aria-hidden="true"/>}
        </button>;
      })}
    </div>}
  </div>;
}
export default function ReflectRangePicker({label,value,options,onSelect}) {
  return <div className="reflect-range-field">
    <span className="reflect-range-label">{label}</span>
    <AppOptionPicker label={label} value={value} options={options} onSelect={next => onSelect(Number(next))}/>
  </div>;
}
