import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Empty } from '../../../components/common/AppChrome';
import { getSurah } from '../../../lib/quran';
import { assignmentsFor } from '../reflectPresentation';
import ReflectHubTabs from './ReflectHubTabs';
import ThemeStudyButton from './ThemeStudyButton';

/** Keyword and hierarchical theme discovery across saved lessons. */
export default function DiscoverTab({ lessons, discoverTab, setDiscoverTab, themeGroups, expandedTheme, setExpandedTheme, expandedSubtheme, setExpandedSubtheme, setKeywordJump, setActive, setMode }) {
  return (
<div className="reflect-discover">
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

        </div>
  );
}
