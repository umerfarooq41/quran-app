import React from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { getSurah } from '../../../lib/quran';
import { reflectCardClass as card, reflectFieldClass as field, studyDisplayTitle } from '../reflectPresentation';
import { getReflectProgress } from '../reflectProgress';

/** Progress dashboard and commitment review. */
export default function ProgressTab({ lessons, progressPeriod, setProgressPeriod, progressCommitment, setProgressCommitment, saveCommitmentReview, openProgressLesson, setHubTab }) {
  const { filtered, completed, percentage, ayahCount, questions, answered, commitments, recent } = getReflectProgress(lessons, progressPeriod);
          return <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Study Progress</h2>
              <select aria-label="Progress period" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700" value={progressPeriod} onChange={e=>setProgressPeriod(e.target.value)}>
                <option value="all">All time</option><option value="month">This month</option><option value="week">This week</option>
              </select>
            </div>
            <section className={card}>
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-xs text-slate-500">Studies completed</p><p className="mt-1 text-2xl font-semibold text-slate-900">{completed.length} <span className="text-sm font-normal text-slate-500">of {filtered.length}</span></p><p className="mt-1 text-xs text-slate-500">{filtered.length - completed.length} in progress</p></div>
                <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full" style={{background: 'conic-gradient(#2d6e5e '+percentage+'%, #e2e8f0 0)'}}>
                  <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white text-base font-semibold text-slate-800">{percentage}%</div>
                </div>
              </div>
            </section>
            <div className="grid grid-cols-3 gap-2">
              {[{value:ayahCount,label:'Ayahs studied'},{value:answered,label:'Answered'},{value:questions.length-answered,label:'Open questions'}].map(item=><div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/85 px-2 py-3 text-center shadow-sm"><p className="text-xl font-semibold text-slate-900">{item.value}</p><p className="mt-1 text-[11px] leading-tight text-slate-500">{item.label}</p></div>)}
            </div>
            <section className={card}>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Continue &amp; Revisit</h3><span className="text-xs text-slate-500">{commitments.length} commitments</span></div>
              {commitments.length ? <div className="mt-3 space-y-2">{commitments.map(lesson => {
                const open = progressCommitment === lesson.id;
                const commitment = lesson.answers?.tadabbur?.commitment || lesson.answers?.tadabbur?.plan;
                return <div key={lesson.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <button type="button" className="flex w-full items-start justify-between gap-2 text-left" aria-expanded={open} onClick={()=>setProgressCommitment(open?null:lesson.id)}>
                    <span className="min-w-0"><span className="block text-xs text-[#2d6e5e]">{lesson.surahName || getSurah(lesson.surahNumber)?.name || 'Surah '+lesson.surahNumber} · {lesson.startAyah}–{lesson.endAyah}</span><span className="mt-2 block whitespace-pre-wrap text-sm text-slate-800">{commitment}</span></span><ChevronDown size={17} className={'mt-1 shrink-0 text-slate-500 transition-transform '+(open?'rotate-180':'')}/>
                  </button>
                  {open && <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold">How is your commitment going?</p>
                    {[['practicing',"I'm practicing it"],['working',"I'm working towards it"],['not-yet',"I haven't started yet"]].map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name={'progress-review-'+lesson.id} checked={(lesson.commitmentReview?.status==='done'?'practicing':lesson.commitmentReview?.status==='progress'?'working':lesson.commitmentReview?.status)===value} onChange={()=>saveCommitmentReview(lesson,{status:value})}/>{label}</label>)}
                    <textarea className={field} rows={2} aria-label="Commitment review notes" placeholder="What have you noticed? (optional)" value={lesson.commitmentReview?.notes || ''} onChange={e=>saveCommitmentReview(lesson,{notes:e.target.value})}/>
                    <button type="button" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#2d6e5e]" onClick={()=>openProgressLesson(lesson)}>Open Lesson →</button>
                  </div>}
                </div>;
              })}</div> : <p className="mt-3 text-sm text-slate-500">Commitments from completed studies will appear here.</p>}
            </section>
            <section className={card}>
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Recent Studies</h3><button type="button" className="text-xs font-semibold text-[#2d6e5e]" onClick={()=>{setHubTab('Studies');setProgressCommitment(null);}}>View all →</button></div>
              {recent.length ? <div className="mt-2 divide-y divide-slate-100">{recent.map(lesson=><button key={lesson.id} type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={()=>openProgressLesson(lesson)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#2d6e5e]">{lesson.status==='completed'?'✓':<BookOpen size={17}/>}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{studyDisplayTitle(lesson)}</span><span className="mt-0.5 block text-xs text-slate-500">{lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah} · {lesson.status==='completed'?'Completed':'In progress'}</span></span>
                <span className="text-slate-400" aria-hidden="true">›</span>
              </button>)}</div> : <p className="mt-3 text-sm text-slate-500">No studies in this period.</p>}
            </section>
          </div>;
}
