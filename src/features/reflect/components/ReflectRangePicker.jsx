import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Native mobile picker: scrolls the complete Surah/ayah list without clipping inside cards. */
export default function ReflectRangePicker({label,value,display,options,onSelect}) {
  return <label className="reflect-range-field">
    <span className="reflect-range-label">{label}</span>
    <span className="reflect-range-native-wrap">
      <select className="reflect-range-native" value={value} aria-label={label}
        onChange={event => onSelect(Number(event.target.value))}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={19} aria-hidden="true" className="reflect-range-native-chevron" />
    </span>
  </label>;
}
