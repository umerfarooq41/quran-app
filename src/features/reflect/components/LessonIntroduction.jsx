import React from 'react';
import { BookOpen, ChevronDown, Info } from 'lucide-react';
import { getSurah } from '../../../lib/quran';
import { reflectCardClass as card } from '../reflectPresentation';

/** Lesson identity, reading guidance and source-language introduction. */
export default function LessonIntroduction({ active, saveStudyMeta, guidanceOpen, setGuidanceOpen, introOpen, setIntroOpen, displayedIntroLanguage, setIntroLanguage, surahIntro }) {
  return (
    <>
        <div className={card + " reflect-study-summary"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="reflect-lesson-title" className="block text-xs font-semibold text-slate-600">Lesson Title</label>
              <input id="reflect-lesson-title" className="reflect-lesson-title-input mt-1 w-full min-w-0 rounded-lg px-3 py-2.5 text-base font-semibold" value={active.title || ''} placeholder="Give your study a title" onChange={e=>saveStudyMeta({title:e.target.value})} />
              <h2 className="mt-3 text-lg font-bold leading-snug">{active.surahName || getSurah(active.surahNumber)?.name || ("Surah " + active.surahNumber)}</h2>
              <p className="reflect-accent-text mt-1 text-base font-semibold">{active.surahNumber}:{active.startAyah}–{active.endAyah}</p>
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
            <div className="reflect-intro-language mt-4 flex gap-2" role="group" aria-label="Surah introduction language">
              {['ur', 'en'].map((language) => <button key={language} type="button" aria-pressed={displayedIntroLanguage === language} onClick={() => setIntroLanguage(language)} className="reflect-intro-language-button rounded-lg px-4 py-2 text-sm font-semibold">{language === 'ur' ? 'اردو' : 'English'}</button>)}
            </div>
            {surahIntro ? <div className={`surah-info-html is-${displayedIntroLanguage} mt-4`} lang={displayedIntroLanguage} dir={displayedIntroLanguage === 'ur' ? 'rtl' : 'ltr'} dangerouslySetInnerHTML={{ __html: surahIntro }} /> : <p className="mt-4 text-sm text-slate-500">Surah introduction is unavailable in this language.</p>}
          </div>}
        </section>
    </>
  );
}
