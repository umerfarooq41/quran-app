import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Info, Loader2, Plus, MoreVertical, Trash2, X } from 'lucide-react';
import { Screen, Empty, Header } from '../components/common/AppChrome';
import ReflectRangePicker from '../features/reflect/components/ReflectRangePicker';
import renderReflectTranslation from '../features/reflect/components/ReflectTranslation';
import ReflectHubTabs from '../features/reflect/components/ReflectHubTabs';
import DeleteLessonDialog from '../features/reflect/components/DeleteLessonDialog';
import FinishAndRevisit from '../features/reflect/components/FinishAndRevisit';
import MyReflection from '../features/reflect/components/MyReflection';
import ThemeEditorSheet from '../features/reflect/components/ThemeEditorSheet';
import PassageSelector from '../features/reflect/components/PassageSelector';
import LessonReader from '../features/reflect/components/LessonReader';
import LessonIntroduction from '../features/reflect/components/LessonIntroduction';
import ContemplationAndRemembrance from '../features/reflect/components/ContemplationAndRemembrance';
import LessonQuestions from '../features/reflect/components/LessonQuestions';
import StudiesTab from '../features/reflect/components/StudiesTab';
import ProgressTab from '../features/reflect/components/ProgressTab';
import QuestionsTab from '../features/reflect/components/QuestionsTab';
import ThemeStudyButton from '../features/reflect/components/ThemeStudyButton';
import { getReflectProgress } from '../features/reflect/reflectProgress';
import { reflectCardClass as card, reflectActionClass as action, reflectFieldClass as field, studyDisplayTitle, DEFAULT_THEMES, assignmentsFor } from '../features/reflect/reflectPresentation';
import { useAppStore } from '../store/useAppStore';
import { getSurah, getSurahAyahs, getSurahInfo } from '../lib/quran';
import { sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { getTranslationOption } from '../lib/translations';
import { db, getTadabburLessons, updateTadabburLesson, deleteTadabburLesson, saveReflectKeywords } from '../lib/db';
import { useReflectAutosave } from '../hooks/useReflectAutosave';
import {
  createTadabburLesson,
  REFLECT_FINAL_QUESTIONS,
} from '../services/tadabbur/createTadabburLesson';
import { getReflectRangeCount, isValidReflectRange } from '../features/reflect/reflectRules';

export default function ReflectScreen() {
  const goBack = useAppStore((s) => s.goBack);
  const target = useAppStore((s) => s.reflectTarget);
  const settings = useAppStore((s) => s.settings);
  const [lessons, setLessons] = useState([]);
  const [mode, setMode] = useState(target?.surahNumber ? 'new' : 'hub');
  const [surahNumber, setSurahNumber] = useState(Number(target?.surahNumber) || 1);
  const [startAyah, setStartAyah] = useState(Number(target?.startAyah) || 1);
  const [endAyah, setEndAyah] = useState(Math.min(15, Number(target?.startAyah || 1) + 2));
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [studyMenu, setStudyMenu] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [rangePicker, setRangePicker] = useState(null);
  const [introLanguage, setIntroLanguage] = useState(null);
  const [error, setError] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [reflectionOpen,setReflectionOpen]=useState(true);
  const [reflectionIndex,setReflectionIndex]=useState(0);
  const [contemplationOpen,setContemplationOpen]=useState(true);
  const [contemplationIndex,setContemplationIndex]=useState(0);
  const [remembranceOpen,setRemembranceOpen]=useState(true);
  const [remembranceIndex,setRemembranceIndex]=useState(0);
  const [questionIndex,setQuestionIndex]=useState(0);
  const [questionJump,setQuestionJump]=useState(null);
  const [questionAdd,setQuestionAdd]=useState(false);
  const [questionEdit,setQuestionEdit]=useState(false);
  const [questionDraft,setQuestionDraft]=useState('');
  const [questionMenu,setQuestionMenu]=useState(false);
  const [questionSearch,setQuestionSearch]=useState('');
  const [questionFilter,setQuestionFilter]=useState('All');
  const [questionExpanded,setQuestionExpanded]=useState(null);
  const [questionSwiped,setQuestionSwiped]=useState(null);
  const questionTouch=useRef(null);
  const [themeGroups, setThemeGroups] = useState(DEFAULT_THEMES);
  const [themeSheet, setThemeSheet] = useState(false);
  const [themeSearch, setThemeSearch] = useState('');
  const [themeCreation, setThemeCreation] = useState(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [draftThemes, setDraftThemes] = useState([]);
  const [hubTab, setHubTab] = useState('Studies');
  const [lessonOrigin, setLessonOrigin] = useState(null);
  const [progressPeriod, setProgressPeriod] = useState('all');
  const [progressCommitment, setProgressCommitment] = useState(null);
  const [discoverTab, setDiscoverTab] = useState('Keywords');
  const [expandedTheme, setExpandedTheme] = useState(null);
  const [expandedSubtheme, setExpandedSubtheme] = useState(null);
  const [keywordJump, setKeywordJump] = useState(null);
  const lessonScrollRef = useRef(null);
  const [swipedStudy, setSwipedStudy] = useState(null);
  const [expandedTafsir, setExpandedTafsir] = useState({});
  const swipeStart = useRef(null);
  const { saveQueue, flushAnswers, queueAnswer } = useReflectAutosave(setError);

  const surah = getSurah(surahNumber);
  const ayahs = useMemo(() => getSurahAyahs(surahNumber), [surahNumber]);
  const count = getReflectRangeCount(startAyah, endAyah);
  const validRange = isValidReflectRange(startAyah, endAyah, ayahs.length);
  const selected = ayahs.filter((a) => a.ayahNumber >= startAyah && a.ayahNumber <= endAyah);

  async function refresh() {
    setLessons(await getTadabburLessons());
  }

  useEffect(() => {
    refresh().catch(() => setError('Unable to load saved Reflect studies.'));
  }, []);

  function beginNew() {
    setActive(null);
    setError('');
    setRangePicker(null);
    setMode('new');
    if (!target?.surahNumber) {
      setSurahNumber(1);
      setStartAyah(1);
      setEndAyah(3);
    }
  }

  async function createStudy() {
    if (!validRange || selected.length !== count) return;
    setBusy(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 75000);
      let lesson;
      try {
        lesson = await createTadabburLesson({
          surahNumber, startAyah, endAyah, settings, signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      await refresh();
      setActive(lesson);
      setMode('lesson');
    } catch (e) {
      setError(e.name === 'AbortError'
        ? 'Study creation was cancelled or timed out. Please try again.'
        : (e.message || 'Unable to create this study.'));
    } finally {
      setBusy(false);
    }
  }

  function saveAnswer(group, index, value) {
    if (!active) return;
    setActive((current) => {
      if (!current || current.id !== active.id) return current;
      const values = [...(current.answers?.[group] || [])];
      values[index] = value;
      return { ...current, answers: { ...current.answers, [group]: values } };
    });
    queueAnswer(active.id, group, index, value);
  }

  function saveTadabburField(name, value) {
    if (!active) return;
    const lessonId = active.id;
    setActive((current) => current?.id === lessonId ? {
      ...current,
      answers: {
        ...current.answers,
        tadabbur: { ...current.answers?.tadabbur, [name]: value },
      },
    } : current);
    setLessons(rows => rows.map(row => row.id === lessonId ? {...row, answers:{...row.answers,tadabbur:{...row.answers?.tadabbur,[name]:value}}} : row));
    queueAnswer(lessonId, 'tadabbur', name, value);
  }

  async function toggleKeyword(ayahNumber, word, index) {
    if (!active) return;
    const lessonId = active.id;
    const key = ayahNumber + ':' + index;
    const current = Array.isArray(active.keywords) ? active.keywords : [];
    const keywords = current.some((item) => item.key === key)
      ? current.filter((item) => item.key !== key)
      : [...current, {
          key,
          ayahNumber,
          arabic: word.arabic || '',
          meaning: word.meaning || '',
        }];
    setActive((lesson) => lesson?.id === lessonId ? { ...lesson, keywords } : lesson);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveReflectKeywords(lessonId, keywords))
      .catch(() => setError('Unable to save selected keywords.'));
    // Keyword changes persist immediately; finishing the lesson is not required.
    await saveQueue.current;
  }

  async function returnToStudies() {
    await flushAnswers();
    await saveQueue.current.catch(() => {});
    try {
      await refresh();
    } catch {
      setError('Unable to refresh saved studies.');
    }
    setHubTab(lessonOrigin || 'Studies');
    setLessonOrigin(null);
    setActive(null);
    setMode('hub');
  }

  useEffect(() => {
    let mounted = true;
    db.settings.get('reflect-theme-catalog').then(row => {
      if (mounted && row?.themes) setThemeGroups({...DEFAULT_THEMES, ...row.themes});
    }).catch(() => setError('Unable to load saved themes.'));
    return () => { mounted = false; };
  }, []);

  function openThemeSheet() {
    setDraftThemes(assignmentsFor(active?.studyThemes).map(item => ({main:item.main, sub:[...(item.sub || [])]})));
    setThemeSearch('');
    setThemeCreation(null);
    setThemeSheet(true);
  }
  function toggleThemeMain(main) {
    setDraftThemes(old => old.some(item => item.main === main) ? old.filter(item => item.main !== main) : [...old,{main,sub:[]}]);
  }
  function toggleThemeSub(main, sub) {
    setDraftThemes(old => {
      const entry = old.find(item => item.main === main);
      if (!entry) return [...old,{main,sub:[sub]}];
      const next = entry.sub.includes(sub) ? entry.sub.filter(value => value !== sub) : [...entry.sub,sub];
      return old.map(item => item.main === main ? {...item,sub:next} : item);
    });
  }
  async function createTheme() {
    const value = newThemeName.trim();
    if (!value || !themeCreation) return;
    const {type, parent} = themeCreation;
    if (type === 'main' ? Object.keys(themeGroups).some(main => main.toLowerCase() === value.toLowerCase()) : (themeGroups[parent] || []).some(sub => sub.toLowerCase() === value.toLowerCase())) {
      setError('That theme already exists.');
      return;
    }
    const updated = type === 'main' ? {...themeGroups,[value]:[]} : {...themeGroups,[parent]:[...themeGroups[parent],value]};
    try {
      await db.settings.put({id:'reflect-theme-catalog',themes:updated});
      setThemeGroups(updated);
      if (type === 'main') {
        setDraftThemes(old => [...old,{main:value,sub:[]}]);
        setExpandedTheme(value);
      } else {
        toggleThemeSub(parent,value);
        setExpandedTheme(parent);
      }
      setThemeCreation(null);
      setNewThemeName('');
      setThemeSearch('');
    } catch {
      setError('Unable to save new theme.');
    }
  }
  function finishThemeEditing() {
    saveStudyMeta({studyThemes:{...active.studyThemes,assignments:draftThemes}});
    setThemeSheet(false);
  }

  function openProgressLesson(lesson) {
    setLessonOrigin('Progress');
    setActive(lesson);
    setMode('lesson');
  }

  function saveCommitmentReview(lesson, patch) {
    const commitmentReview = {...(lesson.commitmentReview || {}), ...patch};
    setLessons(rows => rows.map(row => row.id === lesson.id ? {...row, commitmentReview} : row));
    setActive(current => current?.id === lesson.id ? {...current, commitmentReview} : current);
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => updateTadabburLesson(lesson.id, {commitmentReview})).catch(() => setError('Unable to save commitment review.'));
  }

  function saveStudyMeta(patch) {
    if (!active) return;
    const id = active.id;
    setActive(current => current?.id === id ? {...current, ...patch} : current);
    setLessons(rows=>rows.map(l=>l.id===id?{...l,...patch}:l));
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => updateTadabburLesson(id, patch)).catch(() => setError('Unable to save study details.'));
  }

  function removeQuestion(lesson,id) {
    const studyQuestions=(lesson.studyQuestions||[]).filter(q=>q.id!==id);
    setLessons(rows=>rows.map(l=>l.id===lesson.id?{...l,studyQuestions}:l));
    setActive(l=>l?.id===lesson.id?{...l,studyQuestions}:l);
    saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>updateTadabburLesson(lesson.id,{studyQuestions})).catch(()=>setError('Unable to remove question.'));
    setQuestionSwiped(null);setQuestionExpanded(null);
  }
  useEffect(()=>{
    if(mode!=='lesson'||!questionJump||active?.id!==questionJump.lessonId)return;
    const i=(active.studyQuestions||[]).findIndex(q=>q.id===questionJump.questionId);
    if(i>=0){setQuestionIndex(i);setQuestionEdit(false);lessonScrollRef.current?.querySelector('[data-reflect-questions]')?.scrollIntoView({behavior:'smooth',block:'center'});}
    setQuestionJump(null);
  },[mode,active?.id,questionJump]);

  async function finishLesson() {
    if (!active || busy) return;
    await flushAnswers();
    await saveQueue.current;
    setBusy(true);
    setError('');
    try {
      const updated = await updateTadabburLesson(active.id, { status: 'completed', completedAt: active.completedAt || Date.now() });
      if (!updated) throw new Error('Study not found.');
      setActive(updated);
      await refresh();
    } catch (cause) {
      setError(cause?.message || 'Unable to finish lesson.');
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson(id) {
    await flushAnswers();
    await deleteTadabburLesson(id);
    setLessons((rows) => rows.filter((row) => row.id !== id));
    if (active?.id === id) {
      setActive(null);
      setMode('hub');
    }
  }

  useEffect(() => {
    if (mode !== 'lesson' || !keywordJump || active?.id !== keywordJump.lessonId) return;
    const container = lessonScrollRef.current;
    const ayah = container?.querySelector('[data-reflect-ayah="' + keywordJump.ayahNumber + '"]');
    if (!ayah) return;
    const selected = ayah.querySelector('[data-keyword-key="' + keywordJump.key + '"]');
    const target = selected || ayah;
    target.scrollIntoView({behavior: 'smooth', block: 'center'});
    setKeywordJump(null);
  }, [mode, active?.id, keywordJump]);

  const verses = active?.sourceSnapshot?.verses || [];
  const finalQuestions = REFLECT_FINAL_QUESTIONS;
  const translationOption = getTranslationOption(active?.sourceSnapshot?.translationId || settings.translation);
  const wordLanguage = settings.wordByWordLanguage || 'en';
  const showWordByWord = Boolean(settings.wordByWordTranslation);
  const preferredIntroLanguage = String(translationOption.language || 'En').toLowerCase() === 'ur' ? 'ur' : 'en';
  const displayedIntroLanguage = introLanguage || preferredIntroLanguage;
  const surahIntro = useMemo(() => {
    if (!active?.surahNumber) return '';
    return sanitizeSurahHtml(getSurahInfo(active.surahNumber, displayedIntroLanguage)?.text || '');
  }, [active?.surahNumber, displayedIntroLanguage]);


  return (
    <Screen className="tabs-screen app-page-shell bg-fluent reflect-screen">
      <div className="app-fixed-header">
        <Header
          title={mode === 'hub' ? 'Reflect' : mode === 'new' ? 'Select Passage' : 'Study'}
          onBack={() => { if (mode === 'hub') { void flushAnswers(); goBack(); } else { void returnToStudies(); } }}
          backLabel="Back from Reflect"
        />
        {mode === 'hub' && <button type="button" onClick={beginNew} className="reflect-header-add" aria-label="New study"><Plus size={22}/></button>}
      </div>
      <div className="app-scroll-content reflect-content" ref={lessonScrollRef}>
      {mode === 'hub' && <>
        <ReflectHubTabs tabs={['Studies', 'Questions', 'Discover', 'Progress']} active={hubTab} onChange={setHubTab} className="reflect-tabs" label="Reflect library" />
        <QuestionsTab lessons={lessons} questionFilter={questionFilter} setQuestionFilter={setQuestionFilter} questionSearch={questionSearch} setQuestionSearch={setQuestionSearch} questionExpanded={questionExpanded} setQuestionExpanded={setQuestionExpanded} questionSwiped={questionSwiped} setQuestionSwiped={setQuestionSwiped} questionTouch={questionTouch} removeQuestion={removeQuestion} setQuestionJump={setQuestionJump} setActive={setActive} setMode={setMode} />
        {hubTab === 'Discover' && <div className="reflect-discover">
          <ReflectHubTabs tabs={['Keywords', 'Themes']} active={discoverTab} onChange={setDiscoverTab} className="reflect-discover-tabs" label="Discover sections" />

          {discoverTab === 'Keywords' && (() => {
            const saved = lessons.flatMap(lesson => (lesson.keywords || []).filter(word => (word.arabic || '').trim()).map((word,index) => ({
              ...word, lesson, index, ref: lesson.surahNumber + ':' + word.ayahNumber,
            })));
            return <div className="reflect-discover-content">
              <div className="reflect-discover-heading"><h2>Saved Keywords</h2><span>{saved.length} saved</span></div>
              {saved.length ? <div className="reflect-keyword-list">{saved.map(word =>
                <button type="button" key={word.lesson.id + ':' + (word.key ?? word.ayahNumber + ':' + word.index)}
                  className="reflect-keyword-card reflect-keyword-link" onClick={() => {setKeywordJump({lessonId:word.lesson.id,ayahNumber:word.ayahNumber,key:word.key || ''});setActive(word.lesson);setMode('lesson');}}>
                  <div className="reflect-keyword-row"><span>{word.meaning}</span><span lang="ar" dir="rtl" className="reflect-keyword-arabic">{word.arabic}</span></div>
                  <div className="reflect-keyword-refs"><span>{word.lesson.surahName || getSurah(word.lesson.surahNumber)?.name} {word.ref}</span><ChevronDown size={15} className="reflect-keyword-arrow" aria-hidden="true"/></div>
                </button>)}</div> : <Empty text="Tap words in a Reflect lesson to save them here."/>}
            </div>;
          })()}
          {discoverTab === 'Themes' && <div className="reflect-discover-content">
            <div className="reflect-discover-heading"><h2>Qur'anic Themes</h2><span>{Object.keys(themeGroups).length} main themes</span></div>
            {Object.entries(themeGroups).map(([main,subs]) => {
              const mainLessons = lessons.filter(lesson => assignmentsFor(lesson.studyThemes).some(item => item.main === main));
              const directLessons = mainLessons.filter(lesson => {
                const assignment = assignmentsFor(lesson.studyThemes).find(item => item.main === main);
                return assignment && !(assignment.sub || []).length;
              });
              const isOpen = expandedTheme === main;
              return <section key={main} className="reflect-theme-group">
                <button type="button" className="reflect-theme-heading" aria-expanded={isOpen} onClick={() => {setExpandedTheme(isOpen?null:main);setExpandedSubtheme(null);}}>
                  <span><strong>{main}</strong><small>{mainLessons.length} {mainLessons.length === 1 ? 'study' : 'studies'}</small></span>
                  <ChevronDown size={19} className={isOpen?'reflect-theme-chevron is-open':'reflect-theme-chevron'} aria-hidden="true"/>
                </button>
                {isOpen && <div className="reflect-theme-children">
                  {subs.map(sub => {
                    const matched = mainLessons.filter(lesson => assignmentsFor(lesson.studyThemes).some(item => item.main === main && (item.sub || []).includes(sub)));
                    const subKey = main+':'+sub;
                    const subOpen = expandedSubtheme === subKey;
                    return <div key={sub} className="reflect-subtheme">
                      <button type="button" className="reflect-subtheme-heading" aria-expanded={subOpen} onClick={() => setExpandedSubtheme(subOpen?null:subKey)}>
                        <span>{sub}</span><span className="reflect-subtheme-count">{matched.length}</span>
                        <ChevronDown size={16} className={subOpen?'reflect-theme-chevron is-open':'reflect-theme-chevron'} aria-hidden="true"/>
                      </button>
                      {subOpen && <div className="reflect-theme-studies">{matched.length ? matched.map(lesson => <ThemeStudyButton key={lesson.id} lesson={lesson} onOpen={lesson => {setActive(lesson);setMode('lesson');}} />) : <p className="reflect-theme-empty">No saved studies yet.</p>}</div>}
                    </div>;
                  })}
                  {directLessons.length > 0 && <div className="reflect-subtheme">
                    <button type="button" className="reflect-subtheme-heading" aria-expanded={expandedSubtheme === main+':other'} onClick={() => setExpandedSubtheme(expandedSubtheme === main+':other'?null:main+':other')}>
                      <span>Other Studies</span><span className="reflect-subtheme-count">{directLessons.length}</span>
                      <ChevronDown size={16} className={expandedSubtheme === main+':other'?'reflect-theme-chevron is-open':'reflect-theme-chevron'} aria-hidden="true"/>
                    </button>
                    {expandedSubtheme === main+':other' && <div className="reflect-theme-studies">{directLessons.map(lesson => <ThemeStudyButton key={lesson.id} lesson={lesson} onOpen={lesson => {setActive(lesson);setMode('lesson');}} />)}</div>}
                  </div>}
                </div>}
              </section>;
            })}
          </div>}

        </div>}
        <ProgressTab lessons={lessons} progressPeriod={progressPeriod} setProgressPeriod={setProgressPeriod} progressCommitment={progressCommitment} setProgressCommitment={setProgressCommitment} saveCommitmentReview={saveCommitmentReview} openProgressLesson={openProgressLesson} setHubTab={setHubTab} />
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

           const {filtered, completed, percentage, ayahCount, questions, answered, commitments, recent} = getReflectProgress(lessons, progressPeriod);

