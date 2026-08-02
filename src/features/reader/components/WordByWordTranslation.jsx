import React, { useEffect, useMemo, useState } from 'react';
import { getSurahAyahs } from '../../../lib/quran';
import {
  getWordByWordTranslation,
  getCachedWordByWordTranslation,
  prefetchWordByWordTranslation,
  getWordLanguage,
} from '../../../services/quranFoundation';

export function WordByWordTranslation({
  surahNumber,
  ayahNumber,
  enabled,
  language = 'en',
}) {
  const languageOption = useMemo(() => getWordLanguage(language), [language]);
  const [state, setState] = useState({ status: 'idle', words: [] });

  useEffect(() => {
    if (!enabled || !surahNumber || !ayahNumber) {
      setState({ status: 'idle', words: [] });
      return undefined;
    }

    let mounted = true;
    const cached = getCachedWordByWordTranslation(
      surahNumber,
      ayahNumber,
      languageOption.id,
    );

    if (cached) {
      setState({ status: 'ready', words: cached.words || [] });
    } else {
      setState({ status: 'loading', words: [] });
    }

    getWordByWordTranslation(surahNumber, ayahNumber, {
      language: languageOption.id,
    })
      .then((result) => {
        if (mounted) setState({ status: 'ready', words: result.words || [] });
      })
      .catch(() => {
        if (mounted) setState({ status: 'error', words: [] });
      });

    const ayahCount = getSurahAyahs(Number(surahNumber))?.length || 0;
    [
      Number(ayahNumber) - 2,
      Number(ayahNumber) - 1,
      Number(ayahNumber) + 1,
      Number(ayahNumber) + 2,
      Number(ayahNumber) + 3,
    ]
      .filter((number) => number >= 1 && number <= ayahCount)
      .forEach((number) => {
        prefetchWordByWordTranslation(surahNumber, number, {
          language: languageOption.id,
        });
      });

    return () => {
      mounted = false;
    };
  }, [enabled, surahNumber, ayahNumber, languageOption.id]);

  if (!enabled) return null;

  return (
    <section
      className={`ayah-word-by-word is-${languageOption.id}`}
      aria-label={`${languageOption.label} word-by-word translation`}
      data-word-language={languageOption.id}
    >
      <div className="ayah-word-by-word-heading">
        Word by word · {languageOption.label}
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
                  {toRenderableText(word.arabic)}
                </span>
              )}
              {languageOption.id === 'en' && word.meaningHtml ? (
                <span
                  className="ayah-word-by-word-meaning wbw-colored-meaning"
                  dir="ltr"
                  lang="en"
                  dangerouslySetInnerHTML={{ __html: word.meaningHtml }}
                />
              ) : toRenderableText(word.meaning) ? (
                <span
                  className="ayah-word-by-word-meaning"
                  dir={languageOption.direction}
                  lang={languageOption.id}
                >
                  {toRenderableText(word.meaning)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function toRenderableText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(toRenderableText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return toRenderableText(
      value.text
      ?? value.translation
      ?? value.translated_text
      ?? value.meaning
      ?? value.value
      ?? '',
    );
  }
  return '';
}
