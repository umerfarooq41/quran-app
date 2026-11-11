import React from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, CircleHelp } from 'lucide-react';
import { AppOptionPicker } from '../../../components/common/Dropdown';
import { getSurah } from '../../../lib/quran';
import { reflectCardClass as card, reflectFieldClass as field, studyDisplayTitle } from '../reflectPresentation';
import { getReflectProgress } from '../reflectProgress';

/** Progress dashboard and commitment review. */
export default function ProgressTab({ lessons, progressPeriod, setProgressPeriod, progressCommitment, setProgressCommitment, saveCommitmentReview, openProgressLesson, setHubTab }) {
  const { filtered, completed, percentage, ayahCount, questions, answered, commitments, recent } = getReflectProgress(lessons, progressPeriod);
  const activities = [
    { label: 'Ayahs explored', detail: 'Across your Reflect lessons', value: ayahCount, Icon: BookOpen },
    { label: 'Questions answered', detail: "Questions you've found answers to", value: answered, Icon: CheckCircle2 },
    { label: 'Open questions', detail: "Questions you're still exploring", value: questions.length - answered, Icon: CircleHelp },
  ];
          return <div className="reflect-progress space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Lesson Progress</h2>
              <AppOptionPicker label="Progress period" className="reflect-progress-period" value={progressPeriod} onSelect={setProgressPeriod} options={[{value:'all',label:'All time'},{value:'month',label:'This month'},{value:'week',label:'This week'}]}/>
            </div>
            <section className={card}>
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-xs reflect-muted">Lessons completed</p><p className="mt-1 text-2xl font-semibold">{completed.length} <span className="text-sm font-normal text-slate-500">of {filtered.length}</span></p><p className="mt-1 text-xs text-slate-500">{filtered.length - completed.length} in progress</p></div>
                <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full" style={{background: 'conic-gradient(var(--theme-accent, #2d6e5e) '+percentage+'%, var(--theme-border, #e2e8f0) 0)'}}>
                  <div className="reflect-progress-ring-inner flex h-[62px] w-[62px] items-center justify-center rounded-full text-base font-semibold">{percentage}%</div>
                </div>
              </div>
            </section>
            <section className={card + ' reflect-activity-card'}>
              <h3 className="reflect-activity-title">Reflection Activity</h3>
              <div className="reflect-activity-list">
                {activities.map(({ label, detail, value, Icon }) => (
                  <div key={label} className="reflect-activity-row">
                    <span className="reflect-activity-icon"><Icon size={21} aria-hidden="true" /></span>
                    <span className="reflect-activity-copy">
                      <span className="reflect-activity-label">{label}</span>
                      <span className="reflect-activity-detail">{detail}</span>
                    </span>
                    <strong className="reflect-activity-value">{value}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className={card}>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Continue &amp; Revisit</h3><span className="text-xs text-slate-500">{commitments.length} {commitments.length === 1 ? 'commitment' : 'commitments'}</span></div>
              {commitments.length ? <div className="mt-3 space-y-2">{commitments.map(lesson => {
                const open = progressCommitment === lesson.id;
                const commitment = lesson.answers?.tadabbur?.commitment || lesson.answers?.tadabbur?.plan;
                return <div key={lesson.id} className="reflect-progress-commitment rounded-xl p-3">
                  <button type="button" className="flex w-full items-start justify-between gap-2 text-left" aria-expanded={open} onClick={()=>setProgressCommitment(open?null:lesson.id)}>
                    <span className="min-w-0"><span className="block text-xs text-[#2d6e5e]">{lesson.surahName || getSurah(lesson.surahNumber)?.name || 'Surah '+lesson.surahNumber} · {lesson.startAyah}–{lesson.endAyah}</span><span className="mt-2 block whitespace-pre-wrap text-sm text-slate-800">{commitment}</span></span><ChevronDown size={17} className={'mt-1 shrink-0 text-slate-500 transition-transform '+(open?'rotate-180':'')}/>
                  </button>
                  {open && <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold">How is your commitment going?</p>
                    {[['practicing',"I'm practicing it"],['working',"I'm working towards it"],['not-yet',"I haven't started yet"]].map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name={'progress-review-'+lesson.id} checked={(lesson.commitmentReview?.status==='done'?'practicing':lesson.commitmentReview?.status==='progress'?'working':lesson.commitmentReview?.status)===value} onChange={()=>saveCommitmentReview(lesson,{status:value})}/>{label}</label>)}
                    <textarea className={field} rows={2} aria-label="Commitment review notes" placeholder="What have you noticed? (optional)" value={lesson.commitmentReview?.notes || ''} onChange={e=>saveCommitmentReview(lesson,{notes:e.target.value})}/>
                    <button type="button" className="reflect-secondary-button inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold" onClick={()=>openProgressLesson(lesson)}>Open Lesson →</button>
                  </div>}
                </div>;
              })}</div> : <p className="mt-3 text-sm text-slate-500">Commitments you make while reflecting will appear here.</p>}
            </section>
            <section className={card}>
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Recent Lessons</h3><button type="button" className="reflect-progress-view-all" onClick={()=>{setHubTab('Lessons');setProgressCommitment(null);}}>View all <ChevronRight size={16} aria-hidden="true" /></button></div>
              {recent.length ? <div className="mt-2 reflect-progress-recent">{recent.map(lesson=><button key={lesson.id} type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={()=>openProgressLesson(lesson)}>
                <BookOpen className="reflect-recent-book" size={19} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{studyDisplayTitle(lesson)}</span><span className="mt-0.5 block text-xs text-slate-500">{lesson.status==='completed'?'Completed':'In progress'}</span></span>
                <ChevronRight className="reflect-recent-chevron" size={18} aria-hidden="true" />
              </button>)}</div> : <p className="mt-3 text-sm text-slate-500">No lessons in this period.</p>}
            </section>
          </div>;
}
