import React, { useEffect, useMemo, useState } from 'react';
import {
  getWordByWordTranslation,
  getWordByWordSource,
  getWordLanguage,
} from '../../../services/quranFoundation';

export function WordByWordTranslation({
  surahNumber,
  ayahNumber,
  enabled,
  language = 'en',
  source = '',
}) {
  const sourceOption = useMemo(() => getWordByWordSource(source, language), [source, language]);
  const languageOption = useMemo(() => getWordLanguage(sourceOption.language), [sourceOption.language]);
  const [state, setState] = useState({ status: 'idle', words: [] });

  useEffect(() => {
    if (!enabled || !surahNumber || !ayahNumber) {
      setState({ status: 'idle', words: [] });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading', words: [] });

    getWordByWordTranslation(surahNumber, ayahNumber, {
      language: sourceOption.language,
      source: sourceOption.id,
      signal: controller.signal,
    })
      .then((result) => setState({ status: 'ready', words: result.words }))
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setState({ status: 'error', words: [] });
        }
      });

    return () => controller.abort();
  }, [enabled, surahNumber, ayahNumber, languageOption.id, sourceOption.id]);

  if (!enabled) return null;

  return (
    <section
      className={`ayah-word-by-word is-${languageOption.id}`}
      aria-label={`${languageOption.label} word-by-word translation`}
      data-word-language={languageOption.id}
    >
      <div className="ayah-word-by-word-heading">
        Word by word · {sourceOption.shortName || languageOption.label}
      </div>

      {state.status === 'loading' && (
        <p className="ayah-word-by-word-status">Loading word meanings…</p>
      )}

      {state.status === 'error' && (
        <p className="ayah-word-by-word-status is-error">
          {languageOption.label} word meanings are unavailable right now.
        </p>
      )}

      {state.status === 'ready' && state.words.length === 0 && (
        <p className="ayah-word-by-word-status">
          No {languageOption.label.toLowerCase()} word meanings are available for this ayah.
        </p>
      )}

      {state.words.length > 0 && (
        <div className="ayah-word-by-word-list" dir="rtl">
          {state.words.map((word) => (
            <div className="ayah-word-by-word-item" key={word.id}>
              {languageOption.id === 'en' && word.arabicHtml ? (
                <span
                  className="ayah-word-by-word-arabic wbw-colored-arabic"
                  lang="ar"
                  dir="rtl"
                  dangerouslySetInnerHTML={{ __html: word.arabicHtml }}
                />
              ) : (
                <span className="ayah-word-by-word-arabic" lang="ar" dir="rtl">
                  {word.arabic}
                </span>
              )}
              {languageOption.id === 'en' && word.meaningHtml ? (
                <span
                  className="ayah-word-by-word-meaning wbw-colored-meaning"
                  dir="ltr"
                  lang="en"
                  dangerouslySetInnerHTML={{ __html: word.meaningHtml }}
                />
              ) : (
                <span
                  className="ayah-word-by-word-meaning"
                  dir={languageOption.direction}
                  lang={languageOption.id}
                >
                  {word.meaning}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
