import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, BookOpen } from 'lucide-react';
import { Empty } from '../../../components/common/AppChrome';
import { getSurah } from '../../../lib/quran';
import { assignmentsFor } from '../reflectPresentation';
import ThemeStudyButton from './ThemeStudyButton';
import { getWordByWordTranslation } from '../../../services/quranFoundation/words';

/** Keyword and hierarchical theme discovery across saved lessons. */
export default function DiscoverTab({ lessons, discoverTab, setDiscoverTab, themeGroups, expandedTheme, setExpandedTheme, expandedSubtheme, setExpandedSubtheme, setKeywordJump, setActive, setMode }) {
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [wordMeanings, setWordMeanings] = useState({ en: null, ur: null });
  const [meaningLoading, setMeaningLoading] = useState(false);
  const closeButtonRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    if (!selectedKeyword) return undefined;
    let live = true;
    const controller = new AbortController();
    setMeaningLoading(true);
    setWordMeanings({ en: null, ur: null });
    Promise.all(['en', 'ur'].map(async language => {
      try {
        const result = await getWordByWordTranslation(selectedKeyword.lesson.surahNumber, selectedKeyword.ayahNumber, {
          language, signal: controller.signal,
        });
        return [language, findMatchingMeaning(result?.words, selectedKeyword)];
      } catch {
        return [language, null];
      }
    })).then(results => {
      if (live) setWordMeanings(Object.fromEntries(results));
    }).finally(() => { if (live) setMeaningLoading(false); });
    const onEscape = event => { if (event.key === 'Escape') setSelectedKeyword(null); };
    document.addEventListener('keydown', onEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      live = false;
      controller.abort();
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = previousOverflow;
      lastTriggerRef.current?.focus();
    };
  }, [selectedKeyword]);

  const jumpToKeyword = word => {
    setSelectedKeyword(null);
    setKeywordJump({ lessonId: word.lesson.id, ayahNumber: word.ayahNumber, key: word.key || '' });
    setActive(word.lesson);
    setMode('lesson');
  };

  return (
<div className="reflect-discover">

          {discoverTab === 'Keywords' && (() => {
            const saved = lessons.flatMap(lesson => (lesson.keywords || []).filter(word => (word.arabic || '').trim()).map((word,index) => ({
              ...word, lesson, index, ref: lesson.surahNumber + ':' + word.ayahNumber,
            })));
            return <div className="reflect-discover-content">
              <div className="reflect-discover-heading"><h2>Saved Keywords</h2><span>{saved.length} saved</span></div>
              {saved.length ? <div className="reflect-keyword-list">{saved.map(word =>
                <button type="button" key={word.lesson.id + ':' + (word.key ?? word.ayahNumber + ':' + word.index)}
                  className="reflect-keyword-chip reflect-keyword-link" onClick={event => {lastTriggerRef.current = event.currentTarget;setSelectedKeyword(word);}} aria-label={`Reveal English and Urdu meanings for ${word.arabic}, ${word.ref}`}>
                  <span lang="ar" dir="rtl" className="reflect-keyword-arabic">{word.arabic}</span>
                  <span className="reflect-keyword-source" dir="ltr">{word.ref}</span>
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

        </div>
        {selectedKeyword && createPortal(
          <div className="reflect-keyword-sheet-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setSelectedKeyword(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="reflect-keyword-details-heading" className="reflect-keyword-sheet">
              <div className="reflect-keyword-sheet-header">
                <h2 id="reflect-keyword-details-heading">Saved Keyword</h2>
                <button ref={closeButtonRef} type="button" className="reflect-keyword-sheet-close" onClick={() => setSelectedKeyword(null)} aria-label="Close keyword details"><X size={20}/></button>
              </div>
              <div className="reflect-keyword-sheet-word" lang="ar" dir="rtl">{selectedKeyword.arabic}</div>
              <p className="reflect-keyword-sheet-reference">{selectedKeyword.lesson.surahName || getSurah(selectedKeyword.lesson.surahNumber)?.name} · {selectedKeyword.ref}</p>
              <div className="reflect-keyword-sheet-translation">
                <span className="reflect-keyword-sheet-label">English</span>
                <p lang="en" dir="ltr">{meaningLoading ? 'Loading…' : wordMeanings.en || 'English meaning unavailable for this word.'}</p>
              </div>
              <div className="reflect-keyword-sheet-translation">
                <span className="reflect-keyword-sheet-label">Urdu</span>
                <p lang="ur" dir="rtl">{meaningLoading ? 'Loading…' : wordMeanings.ur || 'اس لفظ کا اردو معنی دستیاب نہیں ہے۔'}</p>
              </div>
              <button type="button" className="reflect-keyword-sheet-jump" onClick={() => jumpToKeyword(selectedKeyword)}>
                <BookOpen size={18} aria-hidden="true"/> Jump to Ayah
              </button>
            </section>
          </div>, document.body
        )}
  );
}

/* The snapshot key identifies a filtered WBW position, not always a raw
   QuranWords location. Match the actual Arabic word before showing a meaning. */
function normalizeArabic(value) {
  return String(value || '').normalize('NFKC').replace(/[\\u064b-\\u065f\\u0670\\u06d6-\\u06ed\\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
}

function findMatchingMeaning(words, saved) {
  if (!Array.isArray(words)) return null;
  const normalized = normalizeArabic(saved.arabic);
  const position = Number(String(saved.key || '').split(':')[1]);
  const atPosition = Number.isInteger(position) && position >= 0 ? words[position] : null;
  if (atPosition && normalizeArabic(atPosition.arabic) === normalized) return atPosition.meaning || null;
  const matches = words.filter(word => normalizeArabic(word.arabic) === normalized);
  return matches.length === 1 ? matches[0].meaning || null : null;
}
