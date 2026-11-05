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
        {hubTab === 'Questions' && (() => {
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
        })()}
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
        {hubTab === 'Progress' && (() => {
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
        {hubTab === 'Studies' && <>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Studies</h2><span className="text-xs text-slate-500">{lessons.length} saved</span></div>
        {lessons.length ? <div className="tabs-list">{lessons.map((lesson) => {
          const isSwiped = swipedStudy === lesson.id;
          const keywordCount = lesson.keywords?.length || 0;
          const questionCount = lesson.studyQuestions?.length || 0;
          return <article key={lesson.id} className={'tab-card ' + (isSwiped ? 'is-swiped' : '')}>
            <button type="button" className="tab-card-remove" onClick={() => { setPendingDelete(lesson.id); setSwipedStudy(null); }}><Trash2 size={19}/>Remove</button>
            <div className="tab-card-surface"
              onClick={e => { if (e.target.closest("button")) return; if (isSwiped) { setSwipedStudy(null); return; } setStudyMenu(null); setActive(lesson); setMode("lesson"); }}
              onTouchStart={e => {const t=e.touches[0]; swipeStart.current=t?{x:t.clientX,y:t.clientY,id:lesson.id}:null;}}
              onTouchEnd={e => {const t=e.changedTouches[0],start=swipeStart.current;swipeStart.current=null;if(!t||!start||start.id!==lesson.id)return;const dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy))setSwipedStudy(dx<0?lesson.id:null);}}>
              <div className="reflect-study-card-inner">
                <div className="reflect-study-card-heading">
                  <button type="button" className="reflect-study-open" onClick={() => { if(isSwiped){setSwipedStudy(null);return;}flushAnswers();setActive(lesson);setMode("lesson"); }}>
                    <BookOpen size={19} aria-hidden="true" />
                    <span className="min-w-0 text-left"><span className="block truncate font-semibold">{studyDisplayTitle(lesson)}</span><span className="block text-xs font-normal text-slate-500">{lesson.surahName || getSurah(lesson.surahNumber)?.name} · Ayahs {lesson.startAyah}–{lesson.endAyah}</span></span>
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
          </article>;
        })}</div> : <Empty text="Your saved Reflect studies will appear here."/>}</>}
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
        <div className={card + " reflect-study-summary"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="reflect-lesson-title" className="block text-xs font-semibold text-slate-600">Lesson Title</label>
              <input id="reflect-lesson-title" className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-900 outline-none focus:border-[#2d6e5e]" value={active.title || ''} placeholder="Give your study a title" onChange={e=>saveStudyMeta({title:e.target.value})} />
              <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">{active.surahName || getSurah(active.surahNumber)?.name || ("Surah " + active.surahNumber)}</h2>
              <p className="mt-1 text-base font-semibold text-[#2d6e5e]">{active.surahNumber}:{active.startAyah}–{active.endAyah}</p>
            </div>
            <button type="button" className="reflect-guidance-trigger" aria-label="Reading guidance" aria-expanded={guidanceOpen} aria-controls="reflect-reading-guidance" onClick={() => setGuidanceOpen(value => !value)}><Info size={21} aria-hidden="true"/></button>
          </div>
          {active.sourceSnapshot?.translationName && <div className="reflect-study-translation"><BookOpen size={15} aria-hidden="true"/><span>{active.sourceSnapshot.translationName}</span></div>}
          {guidanceOpen && <div id="reflect-reading-guidance" className="reflect-guidance-panel">
            <h3 className="text-sm font-semibold">Reading Guidance</h3>
            <p className="mt-1 text-xs text-slate-500">Study the selected passage before recording personal reflections.</p>
            {[
              ['Read attentively', 'Read or listen slowly and repeat ayahs worth considering.'],
              ['Understand the words', 'Read the translation and word-by-word meanings; select keywords above.'],
              ['Study the explanation', 'Consult available Tafsir and consider the audience, context and surrounding ayahs.'],
              ['Consider the message', 'Notice teachings, commands, warnings and promises actually present in the passage.'],
            ].map(([heading, detail], i) => <div key={heading} className="mt-3 border-t border-slate-100 pt-3"><p className="text-sm font-semibold">{i + 1}. {heading}</p><p className="mt-1 text-sm text-slate-600">{detail}</p></div>)}
            <p className="mt-3 text-xs text-slate-500">Passage-specific explanations are shown only when supported by the selected source.</p>
          </div>}
        </div>

        <section className={card}>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={introOpen} aria-controls="reflect-surah-introduction" onClick={() => setIntroOpen((value) => !value)}>
            <span className="font-semibold">Surah Introduction</span>
            <ChevronDown size={20} aria-hidden="true" className={`reflect-intro-chevron ${introOpen ? "is-open" : ""}`} />
          </button>
          {introOpen && <div id="reflect-surah-introduction" className="reflect-intro-content">
            <div className="mt-4 flex gap-2" role="group" aria-label="Surah introduction language">
              {['ur', 'en'].map((language) => <button key={language} type="button" aria-pressed={displayedIntroLanguage === language} onClick={() => setIntroLanguage(language)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${displayedIntroLanguage === language ? 'bg-[#2d6e5e] text-white' : 'bg-slate-100 text-slate-700'}`}>{language === 'ur' ? 'اردو' : 'English'}</button>)}
            </div>
            {surahIntro ? <div className={`surah-info-html is-${displayedIntroLanguage} mt-4`} lang={displayedIntroLanguage} dir={displayedIntroLanguage === 'ur' ? 'rtl' : 'ltr'} dangerouslySetInnerHTML={{ __html: surahIntro }} /> : <p className="mt-4 text-sm text-slate-500">Surah introduction is unavailable in this language.</p>}
          </div>}
        </section>
        <LessonReader active={active} verses={verses} translationOption={translationOption} showWordByWord={showWordByWord} wordLanguage={wordLanguage} toggleKeyword={toggleKeyword} expandedTafsir={expandedTafsir} setExpandedTafsir={setExpandedTafsir} />
        <MyReflection active={active} finalQuestions={finalQuestions} reflectionOpen={reflectionOpen} setReflectionOpen={setReflectionOpen} reflectionIndex={reflectionIndex} setReflectionIndex={setReflectionIndex} saveAnswer={saveAnswer} flushAnswers={flushAnswers} />
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
          {group.open&&<div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Prompt {group.index+1} of {group.items.length}</span>
              <div className="flex items-center gap-2" aria-label={group.title+' prompt navigation'}>
                {group.items.map((item,i)=><button key={item.key} type="button" aria-label={'Go to '+item.label} aria-current={group.index===i?'step':undefined} onClick={()=>group.setIndex(i)} className={'h-2.5 w-2.5 rounded-full '+(group.index===i?'bg-[#2d6e5e]':String(active.answers?.tadabbur?.[item.key]||'').trim()?'bg-emerald-200':'bg-slate-200')}/>)}
              </div>
            </div>
            <label htmlFor={'reflect-'+group.items[group.index].key} className="mt-4 block text-sm font-semibold">{group.items[group.index].label}</label>
            <p className="mt-1 text-sm text-slate-600">{group.items[group.index].prompt}</p>
            <textarea id={'reflect-'+group.items[group.index].key} className={field+' mt-3 min-h-28'} rows={4} placeholder={group.items[group.index].placeholder} value={active.answers?.tadabbur?.[group.items[group.index].key]||''} onChange={event=>saveTadabburField(group.items[group.index].key,event.target.value)} onBlur={flushAnswers}/>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={group.index===0} onClick={()=>group.setIndex(i=>Math.max(0,i-1))}>‹ Previous</button>
              <button type="button" className="rounded-xl bg-[#2d6e5e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={group.index===group.items.length-1} onClick={()=>group.setIndex(i=>Math.min(group.items.length-1,i+1))}>Next ›</button>
            </div>
          </div>}
        </section>)}
        <section className={card} data-reflect-questions>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Questions</h3><button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-[#2d6e5e]" onClick={()=>{setQuestionAdd(true);setQuestionEdit(false);}}><Plus size={15}/> Add Question</button></div>
          {questionAdd&&<div className="mt-3 rounded-xl bg-slate-50 p-3"><textarea className={field} rows={2} aria-label="New question" placeholder="Write your question…" value={newQuestion} onChange={e=>setNewQuestion(e.target.value)}/><div className="mt-2 flex justify-end gap-2"><button type="button" className="px-3 py-2 text-sm" onClick={()=>setQuestionAdd(false)}>Cancel</button><button type="button" className={action} disabled={!newQuestion.trim()} onClick={()=>{saveStudyMeta({studyQuestions:[...(active.studyQuestions||[]),{id:String(Date.now())+Math.random().toString(36).slice(2),text:newQuestion.trim(),answer:'',answered:false}]});setQuestionIndex((active.studyQuestions||[]).length);setNewQuestion('');setQuestionAdd(false);}}>Add</button></div></div>}
          {(active.studyQuestions||[]).length?(()=>{
            const count=active.studyQuestions.length,index=Math.min(questionIndex,count-1),q=active.studyQuestions[index];
            return <div className="mt-3">
              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Question {index+1} of {count}</span><div className="relative"><button type="button" aria-label="Question options" className="rounded-lg p-2 text-slate-500" onClick={()=>setQuestionMenu(v=>!v)}><MoreVertical size={18}/></button>{questionMenu&&<div className="absolute right-0 top-full z-10 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"><button type="button" className="block w-full px-3 py-2 text-left text-sm" onClick={()=>{setQuestionDraft(q.text);setQuestionEdit(true);setQuestionMenu(false);}}>Edit Question</button><button type="button" className="block w-full px-3 py-2 text-left text-sm text-rose-600" onClick={()=>{removeQuestion(active,q.id);setQuestionIndex(Math.max(0,Math.min(index,count-2)));setQuestionEdit(false);setQuestionMenu(false);}}>Remove Question</button></div>}</div></div>
              <div className="mt-2 rounded-xl bg-slate-50 p-3">{questionEdit?<div><textarea className={field} rows={2} value={questionDraft} onChange={e=>setQuestionDraft(e.target.value)} aria-label="Edit question"/><div className="mt-2 flex justify-end gap-2"><button type="button" className="px-3 py-2 text-sm" onClick={()=>setQuestionEdit(false)}>Cancel</button><button type="button" className={action} disabled={!questionDraft.trim()} onClick={()=>{saveStudyMeta({studyQuestions:active.studyQuestions.map(item=>item.id===q.id?{...item,text:questionDraft.trim()}:item)});setQuestionEdit(false);}}>Save</button></div></div>:<p className="text-sm font-medium">{q.text}</p>}
                <div className="mt-3 border-t border-slate-200 pt-3"><textarea key={q.id} className="min-h-20 w-full resize-y bg-transparent text-sm outline-none placeholder:text-slate-400" aria-label="Answer question" placeholder="Tap to write your answer…" rows={3} value={q.answer||''} onChange={e=>{const answer=e.target.value;saveStudyMeta({studyQuestions:active.studyQuestions.map(item=>item.id===q.id?{...item,answer,answered:!!answer.trim()}:item)});}}/></div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2"><button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40" disabled={index===0} onClick={()=>{setQuestionIndex(index-1);setQuestionEdit(false);setQuestionMenu(false);}}>‹ Previous</button><div className="flex max-w-[35%] flex-wrap justify-center gap-1.5">{active.studyQuestions.map((item,i)=><button key={item.id} type="button" aria-label={'Question '+(i+1)} className={'h-2.5 w-2.5 rounded-full '+(i===index?'bg-[#2d6e5e]':'bg-slate-200')} onClick={()=>{setQuestionIndex(i);setQuestionEdit(false);setQuestionMenu(false);}}/>)}</div><button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40" disabled={index===count-1} onClick={()=>{setQuestionIndex(index+1);setQuestionEdit(false);setQuestionMenu(false);}}>Next ›</button></div>
            </div>;
          })():!questionAdd&&<button type="button" className="mt-3 w-full rounded-xl border border-dashed border-slate-200 px-3 py-5 text-sm text-slate-500" onClick={()=>setQuestionAdd(true)}>No questions added yet. Tap to add a question.</button>}
        </section>
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

