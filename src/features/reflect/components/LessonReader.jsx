import React from 'react';
import renderReflectTranslation from './ReflectTranslation';
import { reflectCardClass as card } from '../reflectPresentation';

/** Read-only Arabic/translation/Tafsir snapshot with interactive keyword selection. */
export default function LessonReader({ active, verses, translationOption, showWordByWord, wordLanguage, toggleKeyword, expandedTafsir, setExpandedTafsir }) {
  return (
    <>
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
    </>
  );
}
