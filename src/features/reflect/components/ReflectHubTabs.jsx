import React from 'react';

/** Shared tab semantics and styling used by the Reflect library. */
export default function ReflectHubTabs({ tabs, active, onChange, className = '', label }) {
  return <div className={`library-tabs share-like-segment ${className}`} role="tablist" aria-label={label}>
    {tabs.map(tab => <button key={tab} type="button" role="tab" aria-selected={active === tab} onClick={() => onChange(tab)} className={active === tab ? 'is-active' : ''}>{tab}</button>)}
  </div>;
}
