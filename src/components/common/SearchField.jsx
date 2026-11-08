import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

export function SearchField({ value, onChange, label, placeholder, autoFocus = false }) {
  const input = useRef(null);
  return <div className="app-search-field" role="search">
    <Search size={19} aria-hidden="true" />
    <input ref={input} type="search" enterKeyHint="search" value={value} onChange={event => onChange(event.target.value)} aria-label={label} placeholder={placeholder} autoFocus={autoFocus} />
    {value && <button type="button" onClick={() => { onChange(''); input.current?.focus(); }} aria-label={`Clear ${label.toLowerCase()}`}><X size={17} aria-hidden="true" /></button>}
  </div>;
}
