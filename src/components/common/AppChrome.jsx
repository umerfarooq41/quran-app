import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { panel, iconButton } from './ui';

export function Shell({ children }) {
  return <main className="min-h-dvh overflow-hidden bg-fluent px-4 pb-28 pt-5 text-slate-900 sm:px-6">{children}</main>;
}

export function Screen({ children, className = '' }) {
  return <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`mx-auto max-w-5xl ${className}`}>{children}</motion.section>;
}

export function NavIcon({ icon: Icon, active, onClick }) {
  return <button className={`mx-auto grid h-11 w-11 place-items-center rounded-2xl ${active ? 'bg-sky-600 text-white' : 'text-slate-600'}`} onClick={onClick}><Icon size={20} /></button>;
}

export function Header({ title, back = 'home' }) {
  const { setView } = useAppStore();
  return <div className="flex items-center gap-3 pt-2"><button className={iconButton} onClick={() => setView(back)}><ArrowLeft size={20} /></button><h1 className="text-3xl font-semibold">{title}</h1></div>;
}

export function Segment({ value, setValue, options }) {
  return <div className={`${panel} grid grid-cols-2 p-1`}>{options.map(([id, label]) => <button key={id} className={`rounded-[22px] px-4 py-3 font-semibold ${value === id ? 'bg-sky-600 text-white shadow' : 'text-slate-600'}`} onClick={() => setValue(id)}>{label}</button>)}</div>;
}

export function Empty({ text }) {
  return <div className={`${panel} p-8 text-center text-slate-500`}>{text}</div>;
}
