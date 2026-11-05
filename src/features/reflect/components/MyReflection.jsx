import React from 'react';
import { ChevronDown } from 'lucide-react';
import { reflectCardClass as card, reflectFieldClass as field } from '../reflectPresentation';

/** Guided reflection with indexed prompts and keyboard-friendly editing. */
export default function MyReflection({ active, finalQuestions, reflectionOpen, setReflectionOpen, reflectionIndex, setReflectionIndex, saveAnswer, flushAnswers }) {
  return (
        <section className={card}>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={reflectionOpen} aria-controls="reflect-my-reflection" onClick={()=>setReflectionOpen(open=>!open)}>
            <span><span className="block font-semibold">My Reflection</span><span className="mt-1 block text-xs text-slate-500">{(active.answers?.final||[]).filter(answer=>String(answer||'').trim()).length} of {finalQuestions.length} answered</span></span>
            <ChevronDown size={20} aria-hidden="true" className={reflectionOpen?'rotate-180 transition-transform':'transition-transform'}/>
          </button>
          {reflectionOpen && <div id="reflect-my-reflection" className="reflect-lesson-divider mt-3 border-t pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Question {Math.min(reflectionIndex,finalQuestions.length-1)+1} of {finalQuestions.length}</span>
              <div className="flex items-center gap-2" aria-label="Reflection question navigation">
                {finalQuestions.map((q,i)=><button key={i} type="button" aria-label={'Go to reflection question '+(i+1)} aria-current={reflectionIndex===i?'step':undefined} onClick={()=>setReflectionIndex(i)} className={'h-2.5 w-2.5 rounded-full '+(reflectionIndex===i?'bg-[#2d6e5e]':String(active.answers?.final?.[i]||'').trim()?'bg-emerald-200':'bg-slate-200')}/>)}
              </div>
            </div>
            <label htmlFor="reflect-focused-answer" className="mt-4 block text-sm font-semibold">{finalQuestions[reflectionIndex]}</label>
            <textarea id="reflect-focused-answer" className={field+' mt-3 min-h-28'} rows={4} placeholder="Write your reflection…" value={active.answers?.final?.[reflectionIndex]||''} onChange={e=>saveAnswer('final',reflectionIndex,e.target.value)} onBlur={flushAnswers}/>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={reflectionIndex===0} onClick={()=>setReflectionIndex(i=>Math.max(0,i-1))}>‹ Previous</button>
              <button type="button" className="rounded-xl bg-[#2d6e5e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={reflectionIndex===finalQuestions.length-1} onClick={()=>setReflectionIndex(i=>Math.min(finalQuestions.length-1,i+1))}>Next ›</button>
            </div>
          </div>}
        </section>
  );
}
