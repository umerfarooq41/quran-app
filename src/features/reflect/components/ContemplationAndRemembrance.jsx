import React from 'react';
import { ChevronDown } from 'lucide-react';
import { reflectCardClass as card, reflectFieldClass as field } from '../reflectPresentation';

/** Personal contemplation and remembrance prompts. */
export default function ContemplationAndRemembrance({ active, contemplationOpen, setContemplationOpen, contemplationIndex, setContemplationIndex, remembranceOpen, setRemembranceOpen, remembranceIndex, setRemembranceIndex, saveTadabburField, flushAnswers }) {
  return (
    <>
        {[
          {title:'Contemplation',arabic:'Tadabbur',open:contemplationOpen,setOpen:setContemplationOpen,index:contemplationIndex,setIndex:setContemplationIndex,items:[
            {key:'imagine',label:'Imagine & Feel',prompt:'What scene, warning, or promise in these ayahs should I pause and contemplate?',placeholder:'Describe what you imagine or feel…'},
            {key:'evaluate',label:'Evaluate',prompt:'What do these ayahs reveal about my attitudes, choices, or actions?',placeholder:'Write your personal evaluation…'},
          ]},
          {title:'Remembrance',arabic:'Tadhakkur',open:remembranceOpen,setOpen:setRemembranceOpen,index:remembranceIndex,setIndex:setRemembranceIndex,items:[
            {key:'reminder',label:'Personal Reminder',prompt:'What guidance from these ayahs do I want to keep in my heart and remember?',placeholder:'Write a reminder to yourself…'},
            {key:'dua',label:'My Dua',prompt:'What would I like to ask Allah after reflecting on these ayahs?',placeholder:'Write your dua…'},
          ]},
        ].map(group=><section key={group.title} className={card}>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={group.open} onClick={()=>group.setOpen(value=>!value)}>
            <span><span className="block font-semibold">{group.title}</span><span className="mt-1 block text-xs text-slate-500">{group.arabic} · {group.items.filter(item=>String(active.answers?.tadabbur?.[item.key]||'').trim()).length} of {group.items.length} answered</span></span>
            <ChevronDown size={20} aria-hidden="true" className={group.open?'rotate-180 transition-transform':'transition-transform'}/>
          </button>
          {group.open&&<div className="reflect-lesson-divider">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Prompt {group.index+1} of {group.items.length}</span>
              <div className="flex items-center gap-2" aria-label={group.title+' prompt navigation'}>
                {group.items.map((item,i)=><button key={item.key} type="button" aria-label={'Go to '+item.label} aria-current={group.index===i?'step':undefined} onClick={()=>group.setIndex(i)} className={'h-2.5 w-2.5 rounded-full '+(group.index===i?'bg-[var(--ui-primary)]':String(active.answers?.tadabbur?.[item.key]||'').trim()?'bg-emerald-200':'bg-slate-200')}/>)}
              </div>
            </div>
            <label htmlFor={'reflect-'+group.items[group.index].key} className="mt-4 block text-sm font-semibold">{group.items[group.index].label}</label>
            <p className="mt-1 text-sm text-slate-600">{group.items[group.index].prompt}</p>
            <textarea id={'reflect-'+group.items[group.index].key} className={field+' mt-3 min-h-28'} rows={4} placeholder={group.items[group.index].placeholder} value={active.answers?.tadabbur?.[group.items[group.index].key]||''} onChange={event=>saveTadabburField(group.items[group.index].key,event.target.value)} onBlur={flushAnswers}/>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" className="reflect-secondary-button rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={group.index===0} onClick={()=>group.setIndex(i=>Math.max(0,i-1))}>‹ Previous</button>
              <button type="button" className="rounded-xl bg-[var(--ui-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={group.index===group.items.length-1} onClick={()=>group.setIndex(i=>Math.min(group.items.length-1,i+1))}>Next ›</button>
            </div>
          </div>}
        </section>)}
    </>
  );
}
