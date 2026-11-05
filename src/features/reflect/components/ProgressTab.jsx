import React from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { getSurah } from '../../../lib/quran';
import { reflectCardClass as card, reflectFieldClass as field, studyDisplayTitle } from '../reflectPresentation';
import { getReflectProgress } from '../reflectProgress';

/** Progress metrics, commitment reviews and recent study navigation. */
export default function ProgressTab({ lessons, progressPeriod, setProgressPeriod, progressCommitment, setProgressCommitment, saveCommitmentReview, openProgressLesson, setHubTab }) {
  return (() => {
          const now = new Date();
          const start = new Date(now);
          if (progressPeriod === 'week') { start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0,0,0,0); }
          if (progressPeriod === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
          const filtered = progressPeriod === 'all' ? lessons : lessons.filter(l => {
            const date = new Date(l.updatedAt || l.createdAt || 0);
            return !Number.isNaN(date.getTime()) && date >= start && date <= now;
          });
          const completed = filtered.filter(l => l.status === 'completed');
          const percentage = filtered.length ? Math.round(completed.length / filtered.length * 100) : 0;
          const ayahKeys = new Set(filtered.flatMap(l => Array.from({length: Math.max(0, (Number(l.endAyah) || 0) - (Number(l.startAyah) || 0) + 1)}, (_,i) => l.surahNumber + ':' + (Number(l.startAyah) + i))));
          const questions = filtered.flatMap(l => l.studyQuestions || []);
          const answered = questions.filter(q => !!String(q.answer || '').trim()).length;
          const commitments = completed.filter(l => String(l.answers?.tadabbur?.commitment || l.answers?.tadabbur?.plan || '').trim());
          const recent = [...filtered].sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0,3);
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
        })()}
        <StudiesTab lessons={lessons} swipedStudy={swipedStudy} setSwipedStudy={setSwipedStudy} swipeStart={swipeStart} setPendingDelete={setPendingDelete} studyMenu={studyMenu} setStudyMenu={setStudyMenu} setActive={setActive} setMode={setMode} flushAnswers={flushAnswers} />
              </>}

      {pendingDelete !== null && <DeleteLessonDialog onCancel={() => setPendingDelete(null)} onConfirm={async () => { const id = pendingDelete; setPendingDelete(null); await removeLesson(id); }} />}

      {mode === 'new' && <>

        <PassageSelector surah={surah} surahNumber={surahNumber} setSurahNumber={setSurahNumber} startAyah={startAyah} setStartAyah={setStartAyah} endAyah={endAyah} setEndAyah={setEndAyah} ayahs={ayahs} selected={selected} count={count} validRange={validRange} rangePicker={rangePicker} setRangePicker={setRangePicker} />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="button" className={action+' w-full'} disabled={busy || !validRange || selected.length!==count} onClick={createStudy}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Preparing study…</span> : 'Start Reflect study'}
        </button>
      </>}

      {mode === 'lesson' && active && <>
        <LessonIntroduction active={active} saveStudyMeta={saveStudyMeta} guidanceOpen={guidanceOpen} setGuidanceOpen={setGuidanceOpen} introOpen={introOpen} setIntroOpen={setIntroOpen} displayedIntroLanguage={displayedIntroLanguage} setIntroLanguage={setIntroLanguage} surahIntro={surahIntro} />
        <LessonReader active={active} verses={verses} translationOption={translationOption} showWordByWord={showWordByWord} wordLanguage={wordLanguage} toggleKeyword={toggleKeyword} expandedTafsir={expandedTafsir} setExpandedTafsir={setExpandedTafsir} />
        <MyReflection active={active} finalQuestions={finalQuestions} reflectionOpen={reflectionOpen} setReflectionOpen={setReflectionOpen} reflectionIndex={reflectionIndex} setReflectionIndex={setReflectionIndex} saveAnswer={saveAnswer} flushAnswers={flushAnswers} />
        <ContemplationAndRemembrance active={active} contemplationOpen={contemplationOpen} setContemplationOpen={setContemplationOpen} contemplationIndex={contemplationIndex} setContemplationIndex={setContemplationIndex} remembranceOpen={remembranceOpen} setRemembranceOpen={setRemembranceOpen} remembranceIndex={remembranceIndex} setRemembranceIndex={setRemembranceIndex} saveTadabburField={saveTadabburField} flushAnswers={flushAnswers} />
        <LessonQuestions active={active} questionAdd={questionAdd} setQuestionAdd={setQuestionAdd} questionEdit={questionEdit} setQuestionEdit={setQuestionEdit} questionIndex={questionIndex} setQuestionIndex={setQuestionIndex} questionMenu={questionMenu} setQuestionMenu={setQuestionMenu} questionDraft={questionDraft} setQuestionDraft={setQuestionDraft} newQuestion={newQuestion} setNewQuestion={setNewQuestion} saveStudyMeta={saveStudyMeta} removeQuestion={removeQuestion} />
        <section className={card}>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Themes</h3><button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-[#2d6e5e]" onClick={openThemeSheet}><Plus size={15}/> Add Theme</button></div>
          {assignmentsFor(active.studyThemes).length === 0 ? <button type="button" className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-500" onClick={openThemeSheet}><span>No themes added yet</span><small>Tap Add Theme to organize this study</small></button> : <div className="mt-3 space-y-3">{assignmentsFor(active.studyThemes).map((item,index) => <div key={item.main}>{index > 0 && <div className="mb-3 border-t border-slate-100"/>}<p className="text-sm font-semibold">{item.main}</p>{item.sub?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.sub.map(sub => <span key={sub} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{sub}</span>)}</div>}</div>)}</div>}
        </section>
        {themeSheet && <ThemeEditorSheet themeCreation={themeCreation} setThemeCreation={setThemeCreation} setThemeSheet={setThemeSheet} newThemeName={newThemeName} setNewThemeName={setNewThemeName} createTheme={createTheme} themeSearch={themeSearch} setThemeSearch={setThemeSearch} themeGroups={themeGroups} expandedTheme={expandedTheme} setExpandedTheme={setExpandedTheme} draftThemes={draftThemes} toggleThemeSub={toggleThemeSub} toggleThemeMain={toggleThemeMain} finishThemeEditing={finishThemeEditing} />}
        <FinishAndRevisit active={active} saveTadabburField={saveTadabburField} saveStudyMeta={saveStudyMeta} flushAnswers={flushAnswers} />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {active.status !== 'completed' && <button type="button" className={action+' w-full'} disabled={busy} onClick={finishLesson}>{busy ? 'Saving…' : 'Mark as finished'}</button>}
        {active.status === 'completed' && <p role="status" className="text-sm text-emerald-700">Lesson completed</p>}
        <button type="button" className={action+' w-full'} onClick={()=>{ void returnToStudies(); }}>Back to {lessonOrigin === 'Progress' ? 'Progress' : 'studies'}</button>
      </>}
      </div>
    </Screen>
  );
}

           const {filtered, completed, percentage, ayahCount, questions, answered, commitments, recent} = getReflectProgress(lessons, progressPeriod);;
}
