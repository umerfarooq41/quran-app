import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { panel } from './ui';

export function Shell({ children }) {
  return <main className="app-shell min-h-dvh overflow-x-hidden bg-fluent px-3 pb-5 pt-3 text-slate-900 sm:px-5 sm:pb-8 sm:pt-5">{children}</main>;
}

export function Screen({ children, className = '' }) {
  const navDirection = useAppStore((state) => state.navDirection);
  const variants = {
    forward: { initial: { opacity: 0, x: 34 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 } },
    back: { initial: { opacity: 0, x: -34 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 28 } },
    modal: { initial: { opacity: 0, y: 46 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 36 } },
  };
  const v = variants[navDirection] || variants.forward;
  return (
    <motion.section
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className={`screen-shell mx-auto max-w-5xl ${className}`}
    >
      {children}
    </motion.section>
  );
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

export function Header({ title, back = 'home', onBack }) {
  const goBack = useAppStore((state) => state.goBack);

  function handleBack() {
    if (typeof onBack === 'function') return onBack();
    goBack(back);
  }
  return (
    <div className="app-header">
      <BackButton onClick={handleBack} />
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
