import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Passage range selector. State and validation belong to the owning screen. */
export default function ReflectRangePicker({label,value,display,options,open,onToggle,onSelect}) {
  return <div className="reflect-range-field">
    <span className="reflect-range-label">{label}</span>
    <button type="button" className="reflect-range-trigger" aria-expanded={open} aria-label={label+': '+(display||value)} onClick={onToggle}>
      <span>{display || value}</span><ChevronDown size={18} aria-hidden="true"/>
    </button>
    {open && <div className="reflect-range-options" role="listbox" aria-label={label}>
      {options.map(option=><button key={option.value} type="button" role="option" aria-selected={Number(value)===option.value}
        className={Number(value)===option.value?'is-selected':''} onClick={()=>onSelect(option.value)}>
        {option.label}{Number(value)===option.value && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}

