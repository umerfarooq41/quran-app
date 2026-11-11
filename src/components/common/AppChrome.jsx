import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { panel } from './ui';

export function Shell({ children }) {
  return <main className="app-shell min-h-dvh overflow-x-hidden bg-fluent px-3 pb-5 pt-3 text-slate-900 sm:px-5 sm:pb-8 sm:pt-5">{children}</main>;
}

export function Screen({ children, className = '' }) {
  // The app navigation layer owns horizontal movement. Do not animate the
  // content a second time or shift text while a page is sliding.
  return <section className={`screen-shell mx-auto max-w-5xl ${className}`}>{children}</section>;
}

export function NavIcon({ icon: Icon, active, onClick }) {
  return (
    <button className={`nav-icon-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon-active-bg" aria-hidden="true" />
      <Icon size={20} className="relative z-10" />
    </button>
  );
}

export function BackButton({
  onClick,
  label = 'Back',
  className = '',
}) {
  return (
    <button
      type="button"
      className={`shared-back-button ${className}`}
      onClick={onClick}
      aria-label={label}
    >
      <ArrowLeft size={18} strokeWidth={2.2} />
    </button>
  );
}

export function Header({ title, back = 'home', onBack, backLabel = 'Back' }) {
  const goBack = useAppStore((state) => state.goBack);

  function handleBack() {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    goBack(back);
  }

  return (
    <div className="app-header">
      <BackButton onClick={handleBack} label={backLabel} />
      <h1 className="app-header-title">{title}</h1>
      <span className="app-header-spacer" aria-hidden="true" />
    </div>
  );
}

export function Segment({ value, setValue, options }) {
  return <div className={`${panel} app-segment grid grid-cols-2 p-1`}>{options.map(([id, label]) => <button key={id} className={`rounded-[18px] px-3 py-2.5 text-sm font-semibold transition-all sm:rounded-[22px] sm:px-4 sm:py-3 sm:text-base ${value === id ? 'bg-[#2d6e5e] text-white shadow' : 'text-slate-600'}`} onClick={() => setValue(id)}>{label}</button>)}</div>;
}

export function Empty({ text }) {
  return <div className={`${panel} app-empty p-5 text-center text-sm text-slate-500 sm:p-8 sm:text-base`}>{text}</div>;
}
