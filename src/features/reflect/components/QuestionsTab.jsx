import React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { reflectCardClass as card, reflectFieldClass as field } from '../reflectPresentation';
import ReflectHubTabs from './ReflectHubTabs';

/** Search, filter, expand and navigate saved study questions. */
export default function QuestionsTab({ lessons, questionFilter, setQuestionFilter, questionSearch, setQuestionSearch, questionExpanded, setQuestionExpanded, questionSwiped, setQuestionSwiped, questionTouch, removeQuestion, setQuestionJump, setActive, setMode }) {
  return (() => {
          const all=lessons.flatMap(lesson=>(lesson.studyQuestions||[]).map(q=>({...q,lesson})));
          const visible=all.filter(q=>(questionFilter==='All'||(questionFilter==='Answered'?!!q.answer?.trim():!q.answer?.trim()))&&(q.text+' '+(q.lesson.title||'')+' '+q.lesson.surahName).toLowerCase().includes(questionSearch.toLowerCase()));
          return <div className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">My Questions</h2><span className="text-xs text-slate-500">{all.length} saved</span></div>
            <input className={field} aria-label="Search questions" placeholder="Search questions…" value={questionSearch} onChange={e=>setQuestionSearch(e.target.value)}/>
            <div className="library-tabs share-like-segment" role="tablist">{['All','Open','Answered'].map(t=><button key={t} type="button" role="tab" aria-selected={questionFilter===t} className={questionFilter===t?'is-active':''} onClick={()=>setQuestionFilter(t)}>{t}</button>)}</div>
            {visible.length?visible.map(q=>{
              const key=q.lesson.id+':'+q.id,expanded=questionExpanded===key,swiped=questionSwiped===key;
              return <div key={key} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm" onTouchStart={e=>{questionTouch.current={key,x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{const t=questionTouch.current;if(!t||t.key!==key)return;const dx=e.changedTouches[0].clientX-t.x,dy=e.changedTouches[0].clientY-t.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3){setQuestionSwiped(dx<0?key:null);setQuestionExpanded(null);}questionTouch.current=null;}}>
                {swiped&&<div className="flex justify-end bg-rose-50 px-3 py-2"><button type="button" className="flex items-center gap-1 text-sm text-rose-700" onClick={()=>removeQuestion(q.lesson,q.id)}><Trash2 size={15}/> Remove</button></div>}
                <div className="flex items-stretch"><button type="button" className="min-w-0 flex-1 px-4 py-3 text-left" onClick={()=>{if(swiped){setQuestionSwiped(null);return;}setQuestionJump({lessonId:q.lesson.id,questionId:q.id});setActive(q.lesson);setMode('lesson');}}>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{q.lesson.surahName} · {q.lesson.surahNumber}:{q.lesson.startAyah}–{q.lesson.endAyah}</span><span className={q.answer?.trim()?'text-emerald-700':''}>{q.answer?.trim()?'Answered':'Open'}</span></div>
                  <p className="mt-2 text-sm font-medium">{q.text}</p><p className="mt-2 truncate text-xs text-slate-500">{q.lesson.title||q.lesson.surahName}</p>
                </button><button type="button" aria-label={expanded?'Hide answer':'Show answer'} aria-expanded={expanded} className="shrink-0 px-3 text-slate-500" onClick={()=>{setQuestionExpanded(expanded?null:key);setQuestionSwiped(null);}}><ChevronDown size={18} className={expanded?'rotate-180':''}/></button></div>
                {expanded&&<div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm">{q.answer?.trim()||'Not answered yet. Open the lesson to write your answer.'}</div>}
              </div>;
            }):<div className={card}><p className="text-sm text-slate-500">{all.length?'No matching questions.':'No questions saved yet.'}</p></div>}
          </div>;
        })();
}
