import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2, Plus } from 'lucide-react';
import { Screen, Empty } from '../components/common/AppChrome';
import { useAppStore } from '../store/useAppStore';
import { getSurah, getSurahAyahs, getSurahInfo } from '../lib/quran';
import { sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { getTranslationOption } from '../lib/translations';
import { getTadabburLessons, updateTadabburLesson, deleteTadabburLesson, saveReflectAnswerField } from '../lib/db';
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
  const [introLanguage, setIntroLanguage] = useState(null);
  const [error, setError] = useState('');
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

  function saveNotes(value) {
    if (!active) return;
    setActive((current) => current?.id === active.id
      ? { ...current, answers: { ...current.answers, notes: value } }
      : current);
    queueAnswer(active.id, 'notes', null, value);
  }

  async function finishLesson() {
    if (!active || busy) return;
    await flushAnswers();
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

  const questions = active?.content?.prepare?.questions || [];
  const verses = active?.sourceSnapshot?.verses || [];
  const finalQuestions = active?.finalQuestions || REFLECT_FINAL_QUESTIONS;
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
    <Screen className="space-y-4 pb-10">
      <header className="flex items-center gap-3 py-2">
        <button type="button" onClick={() => { flushAnswers(); if (mode === 'hub') goBack(); else { setMode('hub'); setActive(null); } }} className="rounded-full bg-white p-3 shadow-sm" aria-label="Back"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2d6e5e]">Quran study</p>
          <h1 className="text-xl font-bold text-slate-900">{mode === 'hub' ? 'Reflect' : mode === 'new' ? 'New study' : active?.title || 'Reflect study'}</h1>
        </div>
        {mode === 'hub' && <button type="button" onClick={beginNew} className="rounded-full bg-[#2d6e5e] p-3 text-white" aria-label="New study"><Plus size={19}/></button>}
      </header>

      {mode === 'hub' && <>
        <div className={card}>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-3 text-[#2d6e5e]"><BookOpen size={22}/></span>
            <div><h2 className="font-semibold">Your Reflect library</h2><p className="text-sm text-slate-500">Source-led Quran study and personal reflections saved on this device.</p></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">No AI-generated explanations. You study the selected sources and write your own reflections.</p>
        </div>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Studies</h2><span className="text-xs text-slate-500">{lessons.length} saved</span></div>
        {lessons.length ? lessons.map((lesson) => (
          <article key={lesson.id} className={card}>
            <button type="button" className="w-full text-left" onClick={() => { flushAnswers(); setActive(lesson); setMode('lesson'); }}>
              <p className="text-xs text-[#2d6e5e]">Surah {lesson.surahNumber} · Ayahs {lesson.startAyah}–{lesson.endAyah}</p>
              <h3 className="mt-1 font-semibold">{lesson.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{lesson.status === "completed" ? "Completed" : "In progress"} · {new Date(lesson.updatedAt).toLocaleDateString()}</p>
            </button>
            <button type="button" className="mt-3 text-xs text-rose-600" onClick={() => removeLesson(lesson.id)}>Delete study</button>
          </article>
        )) : <Empty text="Your saved Reflect studies will appear here."/>}
      </>}

      {mode === 'new' && <>
        <div className={card}>
          <h2 className="font-semibold">Choose a passage</h2>
          <p className="mt-1 text-sm text-slate-500">Select 3–15 consecutive Ayahs from one Surah.</p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">Surah</label>
          <select className={field+' mt-1'} value={surahNumber} onChange={(e) => { const n=Number(e.target.value); setSurahNumber(n); setStartAyah(1); setEndAyah(3); }}>
            {Array.from({length:114},(_,i)=>getSurah(i+1)).filter(Boolean).map(s=><option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">Start Ayah
              <select className={field+' mt-1'} value={startAyah} onChange={(e)=>{const n=Number(e.target.value);setStartAyah(n);setEndAyah(Math.min(ayahs.length,n+2));}}>
                {ayahs.map(a=><option key={a.ayahNumber} value={a.ayahNumber}>{a.ayahNumber}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">End Ayah
              <select className={field+' mt-1'} value={endAyah} onChange={(e)=>setEndAyah(Number(e.target.value))}>
                {ayahs.filter(a=>a.ayahNumber>=startAyah && a.ayahNumber<=Math.min(ayahs.length,startAyah+14)).map(a=><option key={a.ayahNumber} value={a.ayahNumber}>{a.ayahNumber}</option>)}
              </select>
            </label>
          </div>
          <p className={'mt-3 text-sm '+(validRange?'text-emerald-700':'text-rose-600')}>{count} Ayahs selected · Choose between 3 and 15.</p>
        </div>
        <section className="tab-card reflect-passage-preview">
          <div className="tab-card-surface">
            <div className="tab-card-top">
              <span className="tab-card-type">
                <span className="tab-type">Selected passage</span>
              </span>
              <span className="tab-surah">{surah?.name} · {surahNumber}:{startAyah}–{endAyah}</span>
            </div>
            <p className="tab-saved-date">{count} consecutive Ayahs</p>
            <div className="mt-3 divide-y divide-slate-100">
              {selected.map((a) => <article key={a.ayahNumber} className="py-3 first:pt-1 last:pb-1">
                <p className="mb-2 text-center text-xs font-medium tabular-nums text-slate-400">{surahNumber}:{a.ayahNumber}</p>
                <p className="tab-arabic reflect-preview-arabic" style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }} dir="rtl" lang="ar">{a.text}</p>
              </article>)}
            </div>
          </div>
        </section>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="button" className={action+' w-full'} disabled={busy || !validRange || selected.length!==count} onClick={createStudy}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Preparing study…</span> : 'Start Reflect study'}
        </button>
      </>}

      {mode === 'lesson' && active && <>
        <div className={card}>
          <p className="text-xs font-semibold text-[#2d6e5e]">SURAH {active.surahNumber} · AYAH {active.startAyah}–{active.endAyah}</p>
          <h2 className="mt-1 text-lg font-bold">{active.title}</h2>
          <p className="mt-2 text-xs text-slate-500">Source-led study · Saved on this device</p>
          {active.sourceSnapshot?.translationName && <p className="mt-1 text-xs text-slate-500">Translation: {active.sourceSnapshot.translationName}</p>}
        </div>

        {questions.length > 0 && <section className={card}>
          <h3 className="font-semibold">Before you read</h3>
          <p className="mt-1 text-sm text-slate-500">Answer from what you already know or have experienced, before studying the passage.</p>
          {questions.map((q,i)=><label key={i} className="mt-4 block text-sm font-medium">{q.text}<textarea className={field+' mt-2 min-h-20'} value={active.answers?.prepare?.[i]||''} onChange={e=>saveAnswer('prepare',i,e.target.value)} onBlur={flushAnswers}/></label>)}
        </section>}

        <section className={card}>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={introOpen} onClick={() => setIntroOpen((value) => !value)}>
            <span className="font-semibold">Surah Introduction</span>
            <span className="text-sm text-[#2d6e5e]">{introOpen ? 'Hide' : 'Show'}</span>
          </button>
          {introOpen && <>
            <div className="mt-4 flex gap-2" role="group" aria-label="Surah introduction language">
              {['ur', 'en'].map((language) => <button key={language} type="button" aria-pressed={displayedIntroLanguage === language} onClick={() => setIntroLanguage(language)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${displayedIntroLanguage === language ? 'bg-[#2d6e5e] text-white' : 'bg-slate-100 text-slate-700'}`}>{language === 'ur' ? 'اردو' : 'English'}</button>)}
            </div>
            {surahIntro ? <div className={`surah-info-html is-${displayedIntroLanguage} mt-4`} lang={displayedIntroLanguage} dir={displayedIntroLanguage === 'ur' ? 'rtl' : 'ltr'} dangerouslySetInnerHTML={{ __html: surahIntro }} /> : <p className="mt-4 text-sm text-slate-500">Surah introduction is unavailable in this language.</p>}
          </>}
        </section>
        <section className={card}>
          <h3 className="font-semibold">Read the passage</h3>
          <p className="mt-1 text-xs text-slate-500">Each Ayah is followed by its word-by-word meanings, selected translation, and available Tafsir.</p>
          {verses.length ? <div className="mt-4 divide-y divide-slate-200">
            {verses.map((verse) => (
              <article key={verse.ayahNumber} className="ayah-translation-body reflect-lesson-ayah py-5 first:pt-0 last:pb-0" data-translation-language={translationOption.language || 'En'}>
                <p className="mb-3 text-sm font-semibold text-[#2d6e5e]">Ayah {verse.ayahNumber} · {active.surahNumber}:{verse.ayahNumber}</p>
                <p className="ayah-translation-arabic" dir="rtl" lang="ar">{verse.arabic}</p>

                {showWordByWord && (verse.wordByWordWords?.length > 0 || verse.wordByWord) && (
                  <section className={`ayah-word-by-word is-${wordLanguage} mt-4`} aria-label={`Ayah ${verse.ayahNumber} word-by-word translation`}>
                    <div className="ayah-word-by-word-heading">Word by word · {wordLanguage === 'ur' ? 'Urdu' : 'English'}</div>
                    {verse.wordByWordWords?.length > 0 ? (
                      <div className="ayah-word-by-word-list" dir="rtl">
                        {verse.wordByWordWords.map((word, index) => (
                          <div className="ayah-word-by-word-item" key={word.id || index}>
                            <span className="ayah-word-by-word-arabic" dir="rtl" lang="ar">{word.arabic}</span>
                            <span className="ayah-word-by-word-meaning" dir={wordLanguage === 'ur' ? 'rtl' : 'ltr'} lang={wordLanguage}>{word.meaning}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="ayah-word-by-word-status">{verse.wordByWord}</p>}
                  </section>
                )}

                <section className="mt-4" aria-label={`Ayah ${verse.ayahNumber} translation`}>
                  <h4 className="mb-2 text-sm font-semibold">Translation</h4>
                  <p className="ayah-translation-text" dir={translationOption.direction || 'ltr'}>{verse.translation}</p>
                </section>

                {Boolean(verse.tafsirNotes?.length || verse.tafsir) && (
                  <section className="ayah-translation-footnotes mt-4" aria-label={`Ayah ${verse.ayahNumber} Tafsir`} dir={translationOption.direction || 'ltr'}>
                    <h4 className="mb-2 text-sm font-semibold">Tafsir</h4>
                    {(verse.tafsirNotes?.length ? verse.tafsirNotes : [{ number: '1', text: verse.tafsir }]).map((note, index) => (
                      <p key={note.number || index} className="ayah-translation-note-row">
                        <span className="ayah-translation-note-number">{verse.ayahNumber}.{note.number || index + 1}</span>
                        <span className="ayah-translation-note-content">{note.text}</span>
                      </p>
                    ))}
                  </section>
                )}
              </article>
            ))}
          </div> : (
            <p className="mt-2 text-sm text-slate-600">This earlier saved lesson has no available source snapshot.</p>
          )}
        </section>

        {legacyPoints.length > 0 && <section className={card}>
          <h3 className="font-semibold">Previously saved study notes</h3>
          {legacyPoints.map((point,i)=><p key={i} className="mt-3 text-sm leading-6">{point.text}</p>)}
        </section>}

        <section className={card}>
          <h3 className="font-semibold">Your observations</h3>
          <p className="mt-1 text-sm text-slate-500">Write what you notice in the passage or questions you want to explore.</p>
          <textarea className={field+' mt-3 min-h-28'} placeholder="Write your own notes…" value={active.answers?.notes||''} onChange={e=>saveNotes(e.target.value)} onBlur={flushAnswers}/>
        </section>

        <section className={card}>
          <h3 className="font-semibold">Reflect on what you learned</h3>
          {finalQuestions.map((q,i)=><label key={i} className="mt-4 block text-sm font-medium">{q}<textarea className={field+' mt-2 min-h-20'} value={active.answers?.final?.[i]||''} onChange={e=>saveAnswer('final',i,e.target.value)} onBlur={flushAnswers}/></label>)}
        </section>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {active.status !== 'completed' && <button type="button" className={action+' w-full'} disabled={busy} onClick={finishLesson}>{busy ? 'Saving…' : 'Mark as finished'}</button>}
        {active.status === 'completed' && <p role="status" className="text-sm text-emerald-700">Lesson completed</p>}
        <button type="button" className={action+' w-full'} onClick={()=>{ flushAnswers(); setMode('hub'); refresh().catch(()=>{}); }}>Back to studies</button>
      </>}
    </Screen>
  );
}
