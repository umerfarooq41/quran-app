import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Info, Loader2, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { Screen, Empty, Header } from '../components/common/AppChrome';
import { useAppStore } from '../store/useAppStore';
import { getSurah, getSurahAyahs, getSurahInfo } from '../lib/quran';
import { sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { getTranslationOption } from '../lib/translations';
import { getTadabburLessons, updateTadabburLesson, deleteTadabburLesson, saveReflectAnswerField, saveReflectKeywords } from '../lib/db';
import {
  createTadabburLesson,
  REFLECT_FINAL_QUESTIONS,
} from '../services/tadabbur/createTadabburLesson';
import { getReflectRangeCount, isValidReflectRange } from '../features/reflect/reflectRules';

const card = 'rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-sm';
const action = 'rounded-xl bg-[#2d6e5e] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-[#2d6e5e]';

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
  const [customTheme, setCustomTheme] = useState('');
  const [hubTab, setHubTab] = useState('Studies');
  const [discoverTab, setDiscoverTab] = useState('Keywords');
  const [expandedTheme, setExpandedTheme] = useState(null);
  const [expandedSubtheme, setExpandedSubtheme] = useState(null);
  const [keywordJump, setKeywordJump] = useState(null);
  const lessonScrollRef = useRef(null);
  const [swipedStudy, setSwipedStudy] = useState(null);
  const [expandedTafsir, setExpandedTafsir] = useState({});
  const swipeStart = useRef(null);
  const pendingFields = useRef(new Map());
  const saveQueue = useRef(Promise.resolve());

  function flushAnswers() {
    const pending = [...pendingFields.current.values()];
    pendingFields.current.clear();
    for (const item of pending) {
      window.clearTimeout(item.timer);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveReflectAnswerField(item.lessonId, item.group, item.index, item.value))
        .catch(() => setError('Unable to save a Reflect answer. Please check device storage.'));
    }
    return saveQueue.current;
  }

  function queueAnswer(lessonId, group, index, value) {
    const key = lessonId + ':' + group + ':' + index;
    const previous = pendingFields.current.get(key);
    if (previous) window.clearTimeout(previous.timer);
    const item = { lessonId, group, index, value, timer: null };
    item.timer = window.setTimeout(() => {
      if (pendingFields.current.get(key) !== item) return;
      pendingFields.current.delete(key);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveReflectAnswerField(lessonId, group, index, value))
        .catch(() => setError('Unable to save a Reflect answer. Please check device storage.'));
    }, 300);
    pendingFields.current.set(key, item);
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAnswers();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flushAnswers();
    };
  }, []);


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
    setHubTab('Studies');
    setActive(null);
    setMode('hub');
  }

  function saveStudyMeta(patch) {
    if (!active) return;
    const id = active.id;
    setActive(current => current?.id === id ? {...current, ...patch} : current);
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => updateTadabburLesson(id, patch)).catch(() => setError('Unable to save study details.'));
  }

  const themeGroups = {
    'Faith & Theology': ['Tawheed', 'Attributes of Allah', 'Hereafter', 'The Unseen'],
    'Prophets & History': ['Stories of the Prophets', 'Past Nations', 'Trials & Resilience'],
    'Worship & Ethics': ['Prayer & Worship', 'Justice', 'Family & Relationships', 'Honesty'],
    'Heart Purification': ['Patience', 'Gratitude', 'Repentance & Hope', 'Trust in Allah', 'Humility'],
    'Paradise & Hell': ['Paradise', 'Hellfire', 'Accountability'],
  };

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
  const legacyPoints = active?.content?.understand?.keyPoints || [];
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
        <div className="library-tabs share-like-segment reflect-tabs" role="tablist" aria-label="Reflect library">
          {['Studies', 'Questions', 'Discover', 'Progress'].map(tab => <button key={tab} type="button" role="tab" aria-selected={hubTab === tab} onClick={() => setHubTab(tab)} className={hubTab === tab ? 'is-active' : ''}>{tab}</button>)}
        </div>
        {hubTab === 'Questions' && <div className={card}><h2 className="font-semibold">My Questions</h2>{lessons.flatMap(l => (l.studyQuestions || []).map(q => ({...q, lesson:l}))).length ? lessons.flatMap(l => (l.studyQuestions || []).map(q => ({...q, lesson:l}))).map(q => <button key={q.lesson.id + q.id} type="button" className="mt-3 block w-full border-t pt-3 text-left text-sm" onClick={() => { setActive(q.lesson); setMode('lesson'); }}><span className="font-medium">{q.text}</span><span className="mt-1 block text-xs text-slate-500">{q.lesson.surahName} {q.lesson.startAyah}–{q.lesson.endAyah} · {q.answered ? 'Answered' : 'Open'}</span></button>) : <p className="mt-2 text-sm text-slate-500">No questions saved yet.</p>}</div>}
        {hubTab === 'Discover' && <div className="reflect-discover">
          <div className="library-tabs share-like-segment reflect-discover-tabs" role="tablist" aria-label="Discover sections">
            {['Keywords','Themes'].map(tab => <button key={tab} type="button" role="tab" aria-selected={discoverTab === tab} className={discoverTab === tab ? 'is-active' : ''} onClick={() => setDiscoverTab(tab)}>{tab}</button>)}
          </div>

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
              const mainLessons = lessons.filter(lesson => lesson.studyThemes?.main === main);
              const isOpen = expandedTheme === main;
              return <section key={main} className="reflect-theme-group">
                <button type="button" className="reflect-theme-heading" aria-expanded={isOpen} onClick={() => {setExpandedTheme(isOpen?null:main);setExpandedSubtheme(null);}}>
                  <span><strong>{main}</strong><small>{subs.length} subthemes · {mainLessons.length} studies</small></span>
                  <ChevronDown size={19} className={isOpen?'reflect-theme-chevron is-open':'reflect-theme-chevron'} aria-hidden="true"/>
                </button>
                {isOpen && <div className="reflect-theme-children">
                  {subs.map(sub => {
                    const matched = mainLessons.filter(lesson => (lesson.studyThemes?.sub || []).includes(sub));
                    const subKey = main+':'+sub;
                    const subOpen = expandedSubtheme === subKey;
                    return <div key={sub} className="reflect-subtheme">
                      <button type="button" className="reflect-subtheme-heading" aria-expanded={subOpen} onClick={() => setExpandedSubtheme(subOpen?null:subKey)}>
                        <span>{sub}</span><span className="reflect-subtheme-count">{matched.length} {matched.length===1?'study':'studies'}</span>
                        <ChevronDown size={16} className={subOpen?'reflect-theme-chevron is-open':'reflect-theme-chevron'} aria-hidden="true"/>
                      </button>
                      {subOpen && <div className="reflect-theme-studies">
                        {matched.length ? matched.map(lesson => <button key={lesson.id} type="button" className="reflect-theme-study" onClick={() => {setActive(lesson);setMode('lesson');}}>
                          <strong>{lesson.surahName || getSurah(lesson.surahNumber)?.name} {lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah}</strong>
                          <small>{lesson.status==='completed'?'Completed':'In progress'}</small>
                        </button>) : <p className="reflect-theme-empty">No saved studies in this subtheme yet.</p>}
                      </div>}
                    </div>;
                  })}
                  {mainLessons.some(lesson => (lesson.studyThemes?.custom || []).length) && <div className="reflect-subtheme">
                    <p className="reflect-theme-custom-label">Custom themes</p>
                    {mainLessons.flatMap(lesson => (lesson.studyThemes?.custom || []).map(tag => ({lesson,tag}))).map(({lesson,tag}) =>
                      <button key={lesson.id+':'+tag} type="button" className="reflect-theme-study" onClick={() => {setActive(lesson);setMode('lesson');}}>
                        <strong>{tag}</strong><small>{lesson.surahName || getSurah(lesson.surahNumber)?.name} {lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah}</small>
                      </button>)}
                  </div>}
                </div>}
              </section>;
            })}
            {lessons.filter(lesson => !lesson.studyThemes?.main && (lesson.studyThemes?.custom || []).length).length > 0 &&
              <section className="reflect-theme-group"><div className="reflect-theme-heading"><strong>Other saved themes</strong></div>
                <div className="reflect-theme-children">{lessons.filter(lesson => !lesson.studyThemes?.main).flatMap(lesson => (lesson.studyThemes?.custom || []).map(tag => ({lesson,tag}))).map(({lesson,tag}) =>
                  <button key={lesson.id+':'+tag} type="button" className="reflect-theme-study" onClick={() => {setActive(lesson);setMode('lesson');}}>
                    <strong>{tag}</strong><small>{lesson.surahName || getSurah(lesson.surahNumber)?.name} {lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah}</small>
                  </button>)}</div></section>}
          </div>}

        </div>}
        {hubTab === 'Progress' && <div className={card}><h2 className="font-semibold">Study Progress</h2><p className="mt-2 text-sm">{lessons.filter(l => l.status === 'completed').length} completed studies</p><p className="mt-1 text-sm">{new Set(lessons.filter(l => l.status === 'completed').flatMap(l => Array.from({length:l.endAyah-l.startAyah+1},(_,i)=>l.surahNumber+':'+(l.startAyah+i)))).size} unique ayahs studied</p><p className="mt-1 text-sm">{lessons.flatMap(l => l.studyQuestions || []).filter(q => !q.answered).length} open questions</p></div>}
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
                    <span>{lesson.surahName || getSurah(lesson.surahNumber)?.name} {lesson.surahNumber}:{lesson.startAyah}–{lesson.endAyah}</span>
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

      {pendingDelete !== null && <div className="reflect-delete-backdrop" role="presentation">
        <div className="reflect-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reflect-delete-title" aria-describedby="reflect-delete-description">
          <h2 id="reflect-delete-title">Remove lesson?</h2>
          <p id="reflect-delete-description">This will permanently remove the saved lesson and its reflections.</p>
          <div className="reflect-delete-actions">
            <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
            <button type="button" className="reflect-delete-confirm" onClick={async () => {const id=pendingDelete;setPendingDelete(null);await removeLesson(id);}}>Remove</button>
          </div>
        </div>
      </div>}

      {mode === 'new' && <>

        <div className={card + ' reflect-passage-selector'}>
          <div className="reflect-passage-heading">
            <h2 className="font-semibold">Passage</h2>
            <span className="reflect-passage-limit">3–15 ayahs</span>
          </div>
          <ReflectRangePicker label="Surah" value={surahNumber} display={surahNumber + '. ' + (surah?.name || '')}
            options={Array.from({length:114},(_,i)=>getSurah(i+1)).filter(Boolean).map(item=>({value:item.number,label:item.number+'. '+item.name}))}
            open={rangePicker==='surah'} onToggle={()=>setRangePicker(current=>current==='surah'?null:'surah')}
            onSelect={value=>{setSurahNumber(value);setStartAyah(1);setEndAyah(Math.min(3,getSurahAyahs(value).length));setRangePicker(null);}}/>
          <div className="reflect-passage-range">
            <ReflectRangePicker label="From" value={startAyah} options={ayahs.map(item=>({value:item.ayahNumber,label:String(item.ayahNumber)}))}
              open={rangePicker==='from'} onToggle={()=>setRangePicker(current=>current==='from'?null:'from')}
              onSelect={value=>{setStartAyah(value);setEndAyah(Math.min(ayahs.length,value+2));setRangePicker(null);}}/>
            <span className="reflect-passage-to">to</span>
            <ReflectRangePicker label="To" value={endAyah} options={ayahs.filter(item=>item.ayahNumber>=startAyah&&item.ayahNumber<=startAyah+14).map(item=>({value:item.ayahNumber,label:String(item.ayahNumber)}))}
              open={rangePicker==='to'} onToggle={()=>setRangePicker(current=>current==='to'?null:'to')}
              onSelect={value=>{setEndAyah(value);setRangePicker(null);}}/>
          </div>
          <p className={'reflect-passage-status '+(validRange?'is-valid':'is-invalid')}>{validRange ? count+' ayahs selected' : 'Select 3–15 ayahs'}</p>
          <div className="reflect-preview-divider" aria-hidden="true" />
          <div className="reflect-preview-content">
            <div className="reflect-preview-heading">Preview</div>
            <div className="divide-y divide-slate-100">
              {selected.map(a=><article key={a.ayahNumber} className="py-3 first:pt-1 last:pb-1">
                <p className="mb-2 text-center text-xs font-medium tabular-nums text-slate-400">{surahNumber}:{a.ayahNumber}</p>
                <p className="tab-arabic reflect-preview-arabic" style={{whiteSpace:'normal',overflow:'visible',textOverflow:'clip'}} dir="rtl" lang="ar">{a.text}</p>
              </article>)}
            </div>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="button" className={action+' w-full'} disabled={busy || !validRange || selected.length!==count} onClick={createStudy}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Preparing study…</span> : 'Start Reflect study'}
        </button>
      </>}

      {mode === 'lesson' && active && <>
        <div className={card + " reflect-study-summary"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{active.surahName || getSurah(active.surahNumber)?.name || ("Surah " + active.surahNumber)}</h2>
              <p className="mt-1 text-sm text-slate-600">Ayahs {active.startAyah}–{active.endAyah}</p>
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
        <section className={card}>
          <h3 className="font-semibold">Read the passage</h3>

          {verses.length ? <div className="mt-4 divide-y divide-slate-200">
            {verses.map((verse) => (
              <article key={verse.ayahNumber} data-reflect-ayah={verse.ayahNumber} className="ayah-translation-body reflect-lesson-ayah py-5 first:pt-0 last:pb-0" data-translation-language={translationOption.language || 'En'}>
                <p className="mb-3 text-sm font-semibold text-[#2d6e5e]">Ayah {verse.ayahNumber} · {active.surahNumber}:{verse.ayahNumber}</p>
                <p className="ayah-translation-arabic" dir="rtl" lang="ar">{verse.arabic}</p>

                {showWordByWord && (verse.wordByWordWords?.length > 0 || verse.wordByWord) && (
                  <section className={`ayah-word-by-word is-${wordLanguage} mt-4`} aria-label={`Ayah ${verse.ayahNumber} word-by-word translation`}>
                    <div className="ayah-word-by-word-heading">Word by word · {wordLanguage === 'ur' ? 'Urdu' : 'English'}</div>
                    {verse.wordByWordWords?.length > 0 ? (
                      <div className="ayah-word-by-word-list" dir="rtl">
                        {verse.wordByWordWords.map((word, index) => (
                          <button type="button" data-keyword-key={verse.ayahNumber + ':' + index} className={`ayah-word-by-word-item rounded-lg px-1 py-2 ${(active.keywords || []).some((item) => item.key === verse.ayahNumber + ':' + index) ? 'reflect-keyword-selected' : ''}`} key={word.id || index} aria-pressed={(active.keywords || []).some((item) => item.key === verse.ayahNumber + ':' + index)} aria-label={`Toggle keyword ${word.arabic || ''}`} onClick={() => toggleKeyword(verse.ayahNumber, word, index)}>
                            <span className="ayah-word-by-word-arabic" dir="rtl" lang="ar">{word.arabic}</span>
                            <span className="ayah-word-by-word-meaning" dir={wordLanguage === 'ur' ? 'rtl' : 'ltr'} lang={wordLanguage}>{word.meaning}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="ayah-word-by-word-status">{verse.wordByWord}</p>}
                  </section>
                )}

                <section className="mt-4" aria-label={"Ayah " + verse.ayahNumber + " translation"}>
                  <p className="ayah-translation-text" dir={translationOption.direction || "ltr"}>
                    {renderReflectTranslation(verse.translation, verse.tafsirNotes?.length ? verse.tafsirNotes : (verse.tafsir ? [{number:1,text:verse.tafsir}] : []),
                      (number) => setExpandedTafsir(previous => ({...previous, [verse.ayahNumber]: previous[verse.ayahNumber] === number ? null : number})), expandedTafsir[verse.ayahNumber])}
                  </p>
                </section>
                {(() => {
                  const notes = verse.tafsirNotes?.length ? verse.tafsirNotes : (verse.tafsir ? [{number:1,text:verse.tafsir}] : []);
                  const note = notes.find(item => Number(item.number) === expandedTafsir[verse.ayahNumber]);
                  return note ? <div className="ayah-translation-footnote-wrap reflect-selected-tafsir" dir={translationOption.direction || "ltr"}>
                    <div className="ayah-translation-footnotes"><section className="ayah-translation-note-section">
                      <p className="ayah-translation-note-row"><span className="ayah-translation-note-number" dir="ltr" lang="en">{note.number}</span><span className="ayah-translation-note-content">{note.text}</span></p>
                    </section></div></div> : null;
                })()}
              </article>
            ))}
          </div> : (
            <p className="mt-2 text-sm text-slate-600">This earlier saved lesson has no available source snapshot.</p>
          )}
        </section>

        <section className={card}>
          <h3 className="font-semibold">Keywords</h3>
          <p className="mt-1 text-xs text-slate-500">Tap a word above to save or remove it from this lesson.</p>
          {(active.keywords || []).length ? <div className="mt-3 flex flex-wrap gap-2">
            {active.keywords.map((keyword) => <button type="button" key={keyword.key} className="reflect-keyword-chip rounded-xl border px-3 py-2 text-sm" onClick={() => toggleKeyword(keyword.ayahNumber, keyword, Number(keyword.key.split(':')[1]))} aria-label={`Remove keyword ${keyword.arabic}`}>
              <span lang="ar" dir="rtl" className="font-semibold">{keyword.arabic}</span>
              <span className="mx-2 text-slate-500">{keyword.meaning}</span>
              <span aria-hidden="true">×</span>
            </button>)}
          </div> : <p className="mt-3 text-sm text-slate-500">No keywords selected yet.</p>}
        </section>
        {legacyPoints.length > 0 && <section className={card}>
          <h3 className="font-semibold">Previously saved study notes</h3>
          {legacyPoints.map((point,i)=><p key={i} className="mt-3 text-sm leading-6">{point.text}</p>)}
        </section>}

        <section className={card}>
          <h3 className="font-semibold">My Reflection</h3>
          <p className="mt-1 text-xs text-slate-500">Write your personal reflections after reading. These are not Tafsir.</p>
          {finalQuestions.map((q,i)=><label key={i} className="mt-4 block text-sm font-medium">{q}<textarea className={field+' mt-2 min-h-20'} value={active.answers?.final?.[i]||''} onChange={e=>saveAnswer('final',i,e.target.value)} onBlur={flushAnswers}/></label>)}
        </section>
        <section className={card}>
          <h3 className="font-semibold">Tadabbur &amp; Tadhakkur</h3>
          <p className="mt-1 text-sm text-slate-500">Personal contemplation, remembrance, and a practical commitment. These are your own reflections, not Tafsir.</p>
          {[
            ['imagine', 'Imagine & Feel', 'What in these ayahs should I pause and contemplate?'],
            ['dua', 'Dua', 'What would I like to ask Allah after reading these ayahs?'],
            ['evaluate', 'Evaluate', 'Where do my actions or attitudes need to improve in light of this guidance?'],
            ['commitment', 'Plan · My Commitment', 'What one specific action will I take because of this lesson?'],
          ].map(([key, label, prompt]) => (
            <label key={key} className="mt-4 block text-sm font-medium">
              {label}
              <span className="mt-1 block text-xs font-normal text-slate-500">{prompt}</span>
              <textarea className={field+' mt-2 min-h-20'} value={active.answers?.tadabbur?.[key] ?? (key === 'commitment' ? active.answers?.tadabbur?.plan || '' : '')} onChange={(event) => saveTadabburField(key, event.target.value)} onBlur={flushAnswers} />
            </label>
          ))}
        </section>
        <section className={card}>
          <h3 className="font-semibold">My Questions</h3>
          <p className="mt-1 text-xs text-slate-500">Save questions to investigate with reliable sources.</p>
          {(active.studyQuestions || []).map(q => <div key={q.id} className="mt-3 rounded-xl border border-slate-200 p-3">
            <textarea className={field} aria-label="Study question" rows={2} value={q.text} onChange={e => saveStudyMeta({studyQuestions: active.studyQuestions.map(item => item.id === q.id ? {...item, text:e.target.value} : item)})}/>
            <label className="mt-2 block text-xs font-medium">Answer and source (optional)<textarea className={field+' mt-1'} rows={2} value={q.answer || ''} onChange={e => saveStudyMeta({studyQuestions: active.studyQuestions.map(item => item.id === q.id ? {...item, answer:e.target.value} : item)})}/></label>
            <div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(q.answered)} onChange={e => saveStudyMeta({studyQuestions: active.studyQuestions.map(item => item.id === q.id ? {...item, answered:e.target.checked} : item)})}/> Answered</label><button type="button" className="text-xs text-rose-600" onClick={() => saveStudyMeta({studyQuestions: active.studyQuestions.filter(item => item.id !== q.id)})}>Remove</button></div>
          </div>)}
          <div className="mt-3 flex gap-2"><input className={field} aria-label="New question" placeholder="What would I like to understand better?" value={newQuestion} onChange={e => setNewQuestion(e.target.value)}/><button type="button" className={action} disabled={!newQuestion.trim()} onClick={() => {saveStudyMeta({studyQuestions:[...(active.studyQuestions || []),{id:String(Date.now())+Math.random().toString(36).slice(2),text:newQuestion.trim(),answer:'',answered:false}]});setNewQuestion('');}}>Add</button></div>
        </section>
        <section className={card}>
          <h3 className="font-semibold">Themes</h3>
          <p className="mt-1 text-xs text-slate-500">Personal study tags, not Tafsir classifications.</p>
          <label className="mt-3 block text-sm font-medium">Main theme<select className={field+' mt-2'} value={active.studyThemes?.main || ''} onChange={e => saveStudyMeta({studyThemes:{...active.studyThemes,main:e.target.value,sub:[]}})}><option value="">Select a theme</option>{Object.keys(themeGroups).map(group=><option key={group} value={group}>{group}</option>)}</select></label>
          {active.studyThemes?.main && <div className="mt-3"><p className="text-sm font-medium">Subthemes</p><div className="mt-2 flex flex-wrap gap-2">{(themeGroups[active.studyThemes.main] || []).map(tag=><button key={tag} type="button" aria-pressed={(active.studyThemes?.sub || []).includes(tag)} className={'rounded-full border px-3 py-2 text-xs '+((active.studyThemes?.sub || []).includes(tag) ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200')} onClick={() => {const sub=active.studyThemes?.sub || [];saveStudyMeta({studyThemes:{...active.studyThemes,sub:sub.includes(tag)?sub.filter(t=>t!==tag):[...sub,tag]}});}}>{tag}</button>)}</div></div>}
          <label className="mt-3 block text-sm font-medium">Custom theme</label>
          <div className="mt-2 flex gap-2"><input className={field} value={customTheme} onChange={e=>setCustomTheme(e.target.value)} placeholder="Add your own theme"/><button type="button" className={action} disabled={!customTheme.trim()} onClick={()=>{saveStudyMeta({studyThemes:{...active.studyThemes,custom:[...new Set([...(active.studyThemes?.custom || []),customTheme.trim()])]}});setCustomTheme('');}}>Add</button></div>
          {(active.studyThemes?.custom || []).map(tag=><button key={tag} type="button" className="mr-2 mt-2 rounded-full bg-slate-100 px-3 py-2 text-xs" onClick={()=>saveStudyMeta({studyThemes:{...active.studyThemes,custom:active.studyThemes.custom.filter(t=>t!==tag)}})}>{tag} ×</button>)}
        </section>
        <section className={card}>
          <h3 className="font-semibold">Finish &amp; Revisit</h3>
          <p className="mt-1 text-xs text-slate-500">Review your learning and practical commitment. No additional answers required.</p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-[#2d6e5e]">{active.surahName || 'Surah '+active.surahNumber} · {active.startAyah}–{active.endAyah}</p><p className="mt-3 text-xs font-semibold">What I learned</p><p className="mt-1 whitespace-pre-wrap text-sm">{active.answers?.final?.[1] || 'Not written yet'}</p><p className="mt-3 text-xs font-semibold">My commitment</p><p className="mt-1 whitespace-pre-wrap text-sm">{active.answers?.tadabbur?.commitment || active.answers?.tadabbur?.plan || 'Not written yet'}</p></div>
          {active.status === 'completed' && <div className="mt-4"><p className="text-sm font-semibold">How is your commitment going?</p>{[['done','I practised it'],['progress',"I'm working on it"],['not-yet',"I haven't started yet"]].map(([value,label])=><label key={value} className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="commitment-review" checked={active.commitmentReview?.status === value} onChange={()=>saveStudyMeta({commitmentReview:{...active.commitmentReview,status:value}})}/>{label}</label>)}<textarea className={field+' mt-3'} rows={2} aria-label="Commitment review notes" placeholder="What did I notice? (optional)" value={active.commitmentReview?.notes || ''} onChange={e=>saveStudyMeta({commitmentReview:{...active.commitmentReview,notes:e.target.value}})}/></div>}
        </section>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {active.status !== 'completed' && <button type="button" className={action+' w-full'} disabled={busy} onClick={finishLesson}>{busy ? 'Saving…' : 'Mark as finished'}</button>}
        {active.status === 'completed' && <p role="status" className="text-sm text-emerald-700">Lesson completed</p>}
        <button type="button" className={action+' w-full'} onClick={()=>{ flushAnswers(); setMode('hub'); refresh().catch(()=>{}); }}>Back to studies</button>
      </>}
      </div>
    </Screen>
  );
}

/** Reader-style inline references, each toggling only its own Tafsir note. */
function renderReflectTranslation(value, notes, onToggle, selectedNumber) {
  const text = String(value || "");
  const available = new Set((notes || []).map(note => Number(note.number)).filter(Number.isFinite));
  return text.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match || !available.has(Number(match[1]))) return <React.Fragment key={index}>{part}</React.Fragment>;
    const number = Number(match[1]);
    return <button key={index} type="button" className={"ayah-translation-inline-footnote" + (selectedNumber === number ? " is-active" : "")}
      dir="ltr" lang="en" aria-pressed={selectedNumber === number} aria-label={"Toggle Tafsir footnote " + number}
      onClick={() => onToggle(number)}>{number}</button>;
  });
}

function ReflectRangePicker({label,value,display,options,open,onToggle,onSelect}) {
  return <div className="reflect-range-field">
    <span className="reflect-range-label">{label}</span>
    <button type="button" className="reflect-range-trigger" aria-expanded={open} aria-label={label+': '+(display||value)} onClick={onToggle}>
      <span>{display || value}</span><ChevronDown size={18} aria-hidden="true"/>
    </button>
    {open && <div className="reflect-range-options" role="listbox" aria-label={label}>
      {options.map(option=><button key={option.value} type="button" role="option" aria-selected={Number(value)===option.value}
        className={Number(value)===option.value?'is-selected':''} onClick={()=>onSelect(option.value)}>
        {option.label}{Number(value)===option.value && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}
