import { SwipeActions } from '../../../components/common/SwipeActions';
import { SearchField } from '../../../components/common/SearchField';
import React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { reflectCardClass as card } from '../reflectPresentation';
import ReflectHubTabs from './ReflectHubTabs';

/** Search, filter, expand and navigate saved study questions. */
export default function QuestionsTab({ lessons, questionFilter, setQuestionFilter, questionSearch, setQuestionSearch, questionExpanded, setQuestionExpanded, questionSwiped, setQuestionSwiped, removeQuestion, setQuestionJump, setActive, setMode }) {
  return (() => {
          const all=lessons.flatMap(lesson=>(lesson.studyQuestions||[]).map(q=>({...q,lesson})));
          const visible=all.filter(q=>(questionFilter==='All'||(questionFilter==='Answered'?!!q.answer?.trim():!q.answer?.trim()))&&(q.text+' '+(q.lesson.title||'')+' '+q.lesson.surahName).toLowerCase().includes(questionSearch.toLowerCase()));
          return <div className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">My Questions</h2><span className="text-xs text-slate-500">{all.length} saved</span></div>
            <SearchField label="Search questions" placeholder="Search questions…" value={questionSearch} onChange={setQuestionSearch}/>
            <ReflectHubTabs tabs={['All', 'Open', 'Answered']} active={questionFilter} onChange={setQuestionFilter} className="reflect-question-tabs" label="Question status" />
            {visible.length?visible.map(q=>{
              const key=q.lesson.id+':'+q.id,expanded=questionExpanded===key,swiped=questionSwiped===key;
              return <SwipeActions key={key} className="tab-card reflect-question-card" open={swiped} onOpenChange={open => { setQuestionSwiped(open ? key : null); setQuestionExpanded(null); }}>
                <button type="button" className="tab-card-remove" onClick={()=>removeQuestion(q.lesson,q.id)}><Trash2 size={17}/>Remove</button>
                <div className="tab-card-surface flex items-stretch"><button type="button" className="min-w-0 flex-1 px-4 py-3 text-left" onClick={()=>{if(swiped){setQuestionSwiped(null);return;}setQuestionJump({lessonId:q.lesson.id,questionId:q.id});setActive(q.lesson);setMode('lesson');}}>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{q.lesson.surahName} · {q.lesson.surahNumber}:{q.lesson.startAyah}–{q.lesson.endAyah}</span><span className={q.answer?.trim()?'text-emerald-700':''}>{q.answer?.trim()?'Answered':'Open'}</span></div>
                  <p className="mt-2 text-sm font-medium">{q.text}</p><p className="mt-2 truncate text-xs text-slate-500">{q.lesson.title||q.lesson.surahName}</p>
                </button><button type="button" aria-label={expanded?'Hide answer':'Show answer'} aria-expanded={expanded} className="shrink-0 px-3 text-slate-500 reflect-question-expand" onClick={()=>{setQuestionExpanded(expanded?null:key);setQuestionSwiped(null);}}><ChevronDown size={18} className={expanded?'rotate-180':''}/></button></div>
                {expanded&&<div className="reflect-question-answer border-t px-4 py-3 text-sm">{q.answer?.trim()||'Not answered yet. Open the lesson to write your answer.'}</div>}
              </SwipeActions>;
            }):<div className={card}><p className="text-sm text-slate-500">{all.length?'No matching questions.':'No questions saved yet.'}</p></div>}
          </div>;
        })();
}
