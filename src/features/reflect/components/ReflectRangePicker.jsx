import React from 'react';
import { AppOptionPicker } from '../../../components/common/Dropdown';

export default function ReflectRangePicker({label,value,options,onSelect}) {
  return <div className="reflect-range-field">
    <span className="reflect-range-label">{label}</span>
    <AppOptionPicker label={label} value={value} options={options} onSelect={next => onSelect(Number(next))}/>
  </div>;
}
