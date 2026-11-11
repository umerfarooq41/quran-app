import { SwipeActions } from '../../../components/common/SwipeActions';
import React from 'react';
import { BookOpen, MoreVertical, Trash2 } from 'lucide-react';
import { Empty } from '../../../components/common/AppChrome';
import { getSurah } from '../../../lib/quran';
import { studyDisplayTitle } from '../reflectPresentation';

/** Saved lessons list, preserving the Library swipe-to-remove pattern. */
export default function StudiesTab({ lessons, swipedStudy, setSwipedStudy, setPendingDelete, studyMenu, setStudyMenu, setActive, setMode, flushAnswers }) {
  return <>

        <div className="flex items-center justify-between"><h2 className="font-semibold">Lessons</h2><span className="text-xs text-slate-500">{lessons.length} saved</span></div>
        {lessons.length ? <div className="tabs-list">{lessons.map((lesson) => {
          const isSwiped = swipedStudy === lesson.id;
          const keywordCount = lesson.keywords?.length || 0;
          const questionCount = lesson.studyQuestions?.length || 0;
          return <SwipeActions key={lesson.id} className="tab-card" open={isSwiped} onOpenChange={open => setSwipedStudy(open ? lesson.id : null)}>
            <button type="button" className="tab-card-remove" onClick={() => { setPendingDelete(lesson.id); setSwipedStudy(null); }}><Trash2 size={19}/>Remove</button>
            <div className="tab-card-surface"
              onClick={e => { if (e.target.closest("button")) return; if (isSwiped) { setSwipedStudy(null); return; } setStudyMenu(null); setActive(lesson); setMode("lesson"); }}>
              <div className="reflect-study-card-inner">
                <div className="reflect-study-card-heading">
                  <button type="button" className="reflect-study-open" onClick={() => { if(isSwiped){setSwipedStudy(null);return;}flushAnswers();setActive(lesson);setMode("lesson"); }}>
                    <BookOpen size={19} aria-hidden="true" />
                    <span className="min-w-0 text-left"><span className="block truncate font-semibold">{studyDisplayTitle(lesson)}</span>{lesson.title?.trim() && <span className="block text-xs font-normal reflect-muted-text">{lesson.surahName || getSurah(lesson.surahNumber)?.name} · Ayahs {lesson.startAyah}–{lesson.endAyah}</span>}</span>
                  </button>
                  <button type="button" className="reflect-study-menu-trigger" aria-label="Lesson options" aria-expanded={studyMenu===lesson.id} onClick={() => setStudyMenu(current => current===lesson.id ? null : lesson.id)}><MoreVertical size={21}/></button>
                </div>
                {studyMenu===lesson.id && <div className="reflect-study-menu"><button type="button" onClick={() => {setPendingDelete(lesson.id);setStudyMenu(null);}}><Trash2 size={16}/>Remove lesson</button></div>}
                <div className="reflect-study-summary">
                  <span className="tab-type">{lesson.status === "completed" ? "Completed" : "In progress"}</span>
                  <span className="reflect-study-card-meta">{keywordCount} keywords · {questionCount} questions</span>
                </div>
                <p className="tab-saved-date">Saved: {new Date(lesson.updatedAt || lesson.createdAt).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"})}</p>
              </div>
            </div>
          </SwipeActions>;
        })}</div> : <Empty text="Your saved lessons will appear here."/>}
  </>;
}
