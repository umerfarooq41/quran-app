import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronUp, Loader2, Plus, Sparkles } from 'lucide-react';
import { Screen, Empty } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';
import { useAppStore } from '../store/useAppStore';
import { getSurah, getSurahAyahs } from '../lib/quran';
import { getTadabburLessons, updateTadabburLesson, deleteTadabburLesson } from '../lib/db';
import { createTadabburLesson, REFLECT_FINAL_QUESTIONS } from '../services/tadabbur/createTadabburLesson';
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
  const [error, setError] = useState('');

  const surah = getSurah(surahNumber);
  const ayahs = useMemo(() => getSurahAyahs(surahNumber), [surahNumber]);
  const count = getReflectRangeCount(startAyah, endAyah);
  const validRange = isValidReflectRange(startAyah, endAyah, ayahs.length);
  const selected = ayahs.filter((a) => a.ayahNumber >= startAyah && a.ayahNumber <= endAyah);

  async function refresh() { setLessons(await getTadabburLessons()); }
  useEffect(() => { refresh().catch(() => setError('Unable to load saved Reflect lessons.')); }, []);

  function beginNew() {
    setActive(null); setError('');
    setMode('new');
    if (!target?.surahNumber) { setSurahNumber(1); setStartAyah(1); setEndAyah(3); }
  }

  async function generate() {
    if (!validRange || selected.length !== count) return;
    setBusy(true); setError('');
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
      await refresh(); setActive(lesson); setMode('lesson');
    } catch (e) {
      const providerDetail = e.providerMessage ? `\\nGemini detail: ${e.providerMessage}` : '';
      setError((e.name === 'AbortError'
        ? 'This is taking too long. Check your connection and try again.'
        : (e.message || 'Unable to create this lesson.')) + providerDetail);
    }
    finally { setBusy(false); }
  }

  async function saveAnswer(group, index, value) {
    if (!active) return;
    const next = { ...active, answers: { ...active.answers, [group]: active.answers?.[group]?.map((v, i) => i === index ? value : v) } };
    setActive(next);
    await updateTadabburLesson(active.id, { answers: next.answers });
    await refresh();
  }

  async function removeLesson(id) {
    await deleteTadabburLesson(id); setLessons((rows) => rows.filter((row) => row.id !== id));
    if (active?.id === id) { setActive(null); setMode('hub'); }
  }

  const questions = active?.content?.prepare?.questions || [];
  const points = active?.content?.understand?.keyPoints || [];
  const finalQuestions = active?.finalQuestions || REFLECT_FINAL_QUESTIONS;

  return (
    <Screen className="space-y-4 pb-10">
      <header className="flex items-center gap-3 py-2">
        <button type="button" onClick={() => mode === 'hub' ? goBack() : (setMode('hub'), setActive(null))} className="rounded-full bg-white p-3 shadow-sm" aria-label="Back"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-[#2d6e5e]">Quran study</p><h1 className="text-xl font-bold text-slate-900">{mode === 'hub' ? 'Reflect' : mode === 'new' ? 'New lesson' : active?.title || 'Reflect lesson'}</h1></div>
        {mode === 'hub' && <button type="button" onClick={beginNew} className="rounded-full bg-[#2d6e5e] p-3 text-white" aria-label="New lesson"><Plus size={19}/></button>}
      </header>

      {mode === 'hub' && <>
        <div className={card}><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-[#2d6e5e]"><Sparkles size={22}/></span><div><h2 className="font-semibold">Your Reflect library</h2><p className="text-sm text-slate-500">Lessons and personal reflections saved on this device.</p></div></div></div>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Lessons</h2><span className="text-xs text-slate-500">{lessons.length} saved</span></div>
        {lessons.length ? lessons.map((lesson) => <article key={lesson.id} className={card}><button type="button" className="w-full text-left" onClick={() => { setActive(lesson); setMode('lesson'); }}><p className="text-xs text-[#2d6e5e]">Surah {lesson.surahNumber} · Ayahs {lesson.startAyah}–{lesson.endAyah}</p><h3 className="mt-1 font-semibold">{lesson.title}</h3><p className="mt-1 text-xs text-slate-500">{new Date(lesson.updatedAt).toLocaleDateString()}</p></button><button type="button" className="mt-3 text-xs text-rose-600" onClick={() => removeLesson(lesson.id)}>Delete lesson</button></article>) : <Empty text="Your saved Reflect lessons will appear here."/>}
        <div className={card}><h3 className="font-semibold">Reflections</h3><p className="mt-1 text-sm text-slate-500">Your answers are kept privately on this device and are never sent for AI generation.</p></div>
      </>}

      {mode === 'new' && <>
        <div className={card}><h2 className="font-semibold">Choose a passage</h2><p className="mt-1 text-sm text-slate-500">Select 3–15 consecutive Ayahs from one Surah.</p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">Surah</label><select className={field+' mt-1'} value={surahNumber} onChange={(e) => { const n=Number(e.target.value); setSurahNumber(n); setStartAyah(1); setEndAyah(3); }}>{Array.from({length:114},(_,i)=>getSurah(i+1)).filter(Boolean).map(s=><option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}</select>
          <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Start Ayah<select className={field+' mt-1'} value={startAyah} onChange={(e)=>{const n=Number(e.target.value);setStartAyah(n);setEndAyah(Math.min(ayahs.length,n+2));}}>{ayahs.map(a=><option key={a.ayahNumber} value={a.ayahNumber}>{a.ayahNumber}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">End Ayah<select className={field+' mt-1'} value={endAyah} onChange={(e)=>setEndAyah(Number(e.target.value))}>{ayahs.filter(a=>a.ayahNumber>=startAyah && a.ayahNumber<=Math.min(ayahs.length,startAyah+14)).map(a=><option key={a.ayahNumber} value={a.ayahNumber}>{a.ayahNumber}</option>)}</select></label></div>
          <p className={'mt-3 text-sm '+(validRange?'text-emerald-700':'text-rose-600')}>{count} Ayahs selected · Choose between 3 and 15.</p>
        </div>
        <section className="overflow-hidden rounded-2xl border border-[#d9e7e1] bg-[#fbfaf6] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5ebe6] px-4 py-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-[#2d6e5e]">Selected passage</p><h3 className="mt-0.5 font-semibold text-slate-800">{surah?.name} <span className="font-normal text-slate-500">· {startAyah}–{endAyah}</span></h3></div>
            <span className="rounded-full bg-[#e9f2ed] px-3 py-1 text-xs font-semibold text-[#2d6e5e]">{count} Ayahs</span>
          </div>
          <div className="divide-y divide-[#e9ece7] px-4">
            {selected.map((a) => <article key={a.ayahNumber} className="py-5">
              <div className="mb-3 flex justify-center"><span className="rounded-full border border-[#dce8e0] bg-white px-3 py-1 text-xs font-medium tabular-nums text-[#527567]">{surahNumber}:{a.ayahNumber}</span></div>
              <p className="text-center text-[1.7rem] leading-[2.15] text-slate-900" dir="rtl" lang="ar">{a.text}</p>
            </article>)}
          </div>
          <p className="border-t border-[#e5ebe6] px-4 py-2 text-center text-xs text-slate-500">Arabic text · {count} consecutive Ayahs</p>
        </section>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="button" className={action+' w-full'} disabled={busy || !validRange || selected.length!==count} onClick={generate}>{busy ? <span className="inline-flex items-center gap-2"><Loader2 size={17} className="animate-spin"/>Generating lesson…</span> : 'Generate Reflect lesson'}</button>
      </>}

      {mode === 'lesson' && active && <>
        <div className={card}><p className="text-xs font-semibold text-[#2d6e5e]">SURAH {active.surahNumber} · AYAH {active.startAyah}–{active.endAyah}</p><h2 className="mt-1 text-lg font-bold">{active.title}</h2><p className="mt-2 text-xs text-slate-500">Generated once and saved locally. Reopening this lesson does not call Gemini.</p></div>
        <section className={card}><h3 className="font-semibold">Before you read</h3><p className="mt-1 text-sm text-slate-500">Answer from what you already know or have experienced.</p>{questions.map((q,i)=><label key={i} className="mt-4 block text-sm font-medium">{q.text}<textarea className={field+' mt-2 min-h-20'} value={active.answers?.prepare?.[i]||''} onChange={e=>saveAnswer('prepare',i,e.target.value)}/></label>)}</section>
        <section className={card}><h3 className="font-semibold">Understand</h3>{points.map((p,i)=><div key={i} className="mt-3"><p className="text-sm leading-6">{p.text}</p><p className="mt-1 text-xs text-slate-400">{(p.ayahReferences||[]).join(' · ')}</p></div>)}</section>
        {active.content?.themes && <section className={card}><h3 className="font-semibold">Themes</h3><p className="mt-2 text-sm font-medium">{active.content.themes.main?.[0]?.name || active.content.themes.main?.[0]?.text || ''}</p><div className="mt-2 flex flex-wrap gap-2">{(active.content.themes.secondary||[]).map((t,i)=><span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">{t.name||t.text||t}</span>)}</div></section>}
        {active.content?.apply?.suggestion && <section className={card}><h3 className="font-semibold">Practical application</h3><p className="mt-2 text-sm leading-6">{active.content.apply.suggestion}</p></section>}
        <section className={card}><h3 className="font-semibold">Reflect on what you learned</h3>{finalQuestions.map((q,i)=><label key={i} className="mt-4 block text-sm font-medium">{q}<textarea className={field+' mt-2 min-h-20'} value={active.answers?.final?.[i]||''} onChange={e=>saveAnswer('final',i,e.target.value)}/></label>)}</section>
        <button type="button" className={action+' w-full'} onClick={()=>setMode('hub')}>Back to lessons</button>
      </>}
    </Screen>
  );
}
