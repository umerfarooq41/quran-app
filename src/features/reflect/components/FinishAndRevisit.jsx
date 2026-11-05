import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { reflectCardClass as card, reflectFieldClass as field } from '../reflectPresentation';

/** Final learning summary, editable commitment, and post-completion review. */
export default function FinishAndRevisit({ active, saveTadabburField, saveStudyMeta, flushAnswers }) {
  const [expanded, setExpanded] = useState(true);
  return (
        <section className={card}>
          <button type="button" className="reflect-section-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><span className="font-semibold">Finish &amp; Revisit</span><ChevronDown size={20} className={`reflect-section-chevron ${expanded?"is-open":""}`}/></button>
          {expanded&&<>
          <div className="reflect-finish-content mt-3">
            <p className="reflect-secondary-action text-xs font-semibold">{active.surahName || 'Surah '+active.surahNumber} · {active.startAyah}–{active.endAyah}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label htmlFor="reflect-learning-summary" className="text-sm font-semibold">What I Learned</label>
              <button type="button" className="reflect-secondary-action text-xs font-semibold disabled:opacity-40" disabled={!String(active.answers?.final?.[1]||'').trim()} onClick={()=>saveTadabburField('learningSummary',active.answers.final[1])}>Use My Reflection</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Summarize the most important lesson in your own words.</p>
            <textarea id="reflect-learning-summary" className={field+' mt-2 min-h-[88px] resize-y'} rows={3} placeholder="The main lesson I learned is…" value={active.answers?.tadabbur?.learningSummary||''} onChange={e=>saveTadabburField('learningSummary',e.target.value)} onBlur={flushAnswers}/>
            <label htmlFor="reflect-commitment" className="mt-4 block text-sm font-semibold">My Commitment</label>
            <textarea id="reflect-commitment" className={field+' mt-2 min-h-[88px] resize-y'} rows={3} placeholder="One action I will take is…" value={active.answers?.tadabbur?.commitment ?? active.answers?.tadabbur?.plan ?? ''} onChange={e=>saveTadabburField('commitment',e.target.value)} onBlur={flushAnswers}/>
          </div>
          {active.status === 'completed' && <div className="mt-4"><p className="text-sm font-semibold">How is your commitment going?</p>{[['practicing',"I'm practicing it"],['working',"I'm working towards it"],['not-yet',"I haven't started yet"]].map(([value,label])=><label key={value} className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="commitment-review" checked={(active.commitmentReview?.status==='done'?'practicing':active.commitmentReview?.status==='progress'?'working':active.commitmentReview?.status) === value} onChange={()=>saveStudyMeta({commitmentReview:{...active.commitmentReview,status:value}})}/>{label}</label>)}<textarea className={field+' mt-3'} rows={2} aria-label="Commitment review notes" placeholder="What did I notice? (optional)" value={active.commitmentReview?.notes || ''} onChange={e=>saveStudyMeta({commitmentReview:{...active.commitmentReview,notes:e.target.value}})}/></div>}
          </>}
        </section>
  );
}
