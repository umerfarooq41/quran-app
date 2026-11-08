import React, { useEffect, useState } from 'react';
import { getWordByWordTranslation } from '../../../services/quranFoundation/words';
import renderReflectTranslation from './ReflectTranslation';
import { reflectCardClass as card } from '../reflectPresentation';
import { getSurah } from '../../../lib/quran';

/** Read-only Arabic/translation/Tafsir snapshot with interactive keyword selection. */
export default function LessonReader({ active, verses, translationOption, toggleKeyword, expandedTafsir, setExpandedTafsir }) {
  const surahName = getSurah(active.surahNumber)?.name || active.surahName || 'Surah';
  const savedLanguage = active.sourceSnapshot?.wordByWordLanguage === 'ur' ? 'ur' : 'en';
  const [wordLanguage, setWordLanguage] = useState(savedLanguage);
  const [wordOverrides, setWordOverrides] = useState({});
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => {
    setWordLanguage(active.sourceSnapshot?.wordByWordLanguage === 'ur' ? 'ur' : 'en');
    setWordOverrides({});
  }, [active.id]);

  useEffect(() => {
    if (wordLanguage === savedLanguage) return undefined;
    const controller = new AbortController();
    setWordLoading(true);
    Promise.all(verses.map(async (verse) => {
      try {
        const result = await getWordByWordTranslation(active.surahNumber, verse.ayahNumber, {
          language: wordLanguage, signal: controller.signal,
        });
        return [verse.ayahNumber, result?.words || []];
      } catch {
        return [verse.ayahNumber, []];
      }
    })).then(rows => {
      if (!controller.signal.aborted) setWordOverrides(previous => ({
        ...previous, [wordLanguage]: Object.fromEntries(rows),
      }));
    }).finally(() => { if (!controller.signal.aborted) setWordLoading(false); });
    return () => controller.abort();
  }, [active.id, active.surahNumber, verses, wordLanguage, savedLanguage]);

  return (
    <>
        <section className="reflect-passage-section">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Read the passage</h3>
            <div className="reflect-word-language" role="group" aria-label="Word-by-word language">
              {['en', 'ur'].map(language => <button key={language} type="button"
                aria-pressed={wordLanguage === language}
                className="reflect-word-language-option"
                onClick={() => setWordLanguage(language)}>{language === 'en' ? 'English' : 'Urdu'}</button>)}
            </div>
          </div>

          {verses.length ? <div className="reflect-passage-verses mt-4">
            {verses.map((verse) => (
              <article key={verse.ayahNumber} data-reflect-ayah={verse.ayahNumber} className="reflect-lesson-ayah" data-translation-language={translationOption.language || 'En'}>
                <header className="ayah-translation-header reflect-ayah-reference">{surahName} {active.surahNumber}:{verse.ayahNumber}</header>
                <div className="ayah-translation-body reflect-ayah-body" data-translation-language={translationOption.language || 'En'}>
                <p className="ayah-translation-arabic" dir="rtl" lang="ar">{verse.arabic}</p>

                {(() => {
                  const words = (wordLanguage === savedLanguage ? verse.wordByWordWords : wordOverrides[wordLanguage]?.[verse.ayahNumber])?.filter(word => word?.arabic && /[\p{L}\p{N}]/u.test(word.arabic) && !/^[۝۞﴿﴾٠-٩۰-۹0-9()]+$/u.test(word.arabic.trim()));
                  return (
                  <section className={`ayah-word-by-word is-${wordLanguage} mt-4`} aria-label={`Ayah ${verse.ayahNumber} word-by-word translation`}>
                    <div className="ayah-word-by-word-heading">Word by word · {wordLanguage === 'ur' ? 'Urdu' : 'English'}</div>
                    {words?.length > 0 ? (
                      <div className="ayah-word-by-word-list" dir="rtl">
                        {words.map((word, index) => (
                          <button type="button" data-keyword-key={verse.ayahNumber + ':' + index} className={`ayah-word-by-word-item rounded-lg px-1 py-2 ${(active.keywords || []).some((item) => item.key === verse.ayahNumber + ':' + index) ? 'reflect-keyword-selected' : ''}`} key={word.id || index} aria-pressed={(active.keywords || []).some((item) => item.key === verse.ayahNumber + ':' + index)} aria-label={`Toggle keyword ${word.arabic || ''} ${word.meaning || ''}`} onClick={() => toggleKeyword(verse.ayahNumber, word, index)}>
                            <span className="ayah-word-by-word-arabic" dir="rtl" lang="ar">{word.arabic}</span>
                            <span className="ayah-word-by-word-meaning" dir={wordLanguage === 'ur' ? 'rtl' : 'ltr'} lang={wordLanguage}>{word.meaning}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="ayah-word-by-word-status">{wordLoading ? 'Loading word meanings…' : 'Word meanings unavailable for this language.'}</p>}
                  </section>
                  );
                })()}

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
                </div>
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
            {active.keywords.map((keyword) => <button type="button" key={keyword.key} className="reflect-keyword-chip rounded-xl border px-3 py-2 text-sm" onClick={() => toggleKeyword(keyword.ayahNumber, keyword, Number(keyword.key.split(':')[1]))} aria-label={`Remove keyword ${keyword.arabic} ${keyword.meaning || ''}`}>
              <span lang="ar" dir="rtl" className="font-semibold">{keyword.arabic}</span>
              <span className="mx-2 reflect-keyword-meaning">{keyword.meaning}</span>
              <span aria-hidden="true">×</span>
            </button>)}
          </div> : <p className="mt-3 text-sm text-slate-500">No keywords selected yet.</p>}
        </section>
    </>
  );
}
