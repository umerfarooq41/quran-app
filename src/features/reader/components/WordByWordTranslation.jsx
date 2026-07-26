import React, { useEffect, useState } from 'react';
import { getWordByWordTranslation } from '../../../services/quranFoundation';

export function WordByWordTranslation({ surahNumber, ayahNumber, enabled }) {
  const [state, setState] = useState({ status: 'idle', words: [] });

  useEffect(() => {
    if (!enabled || !surahNumber || !ayahNumber) {
      setState({ status: 'idle', words: [] });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading', words: [] });

    getWordByWordTranslation(surahNumber, ayahNumber, {
      language: 'en',
      signal: controller.signal,
    })
      .then((result) => setState({ status: 'ready', words: result.words }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ status: 'error', words: [] });
      });

    return () => controller.abort();
  }, [enabled, surahNumber, ayahNumber]);

  if (!enabled) return null;

  return (
    <section className="ayah-word-by-word" aria-label="Word-by-word translation">
      <div className="ayah-word-by-word-heading">Word by word</div>

      {state.status === 'loading' && (
        <p className="ayah-word-by-word-status">Loading word meanings…</p>
      )}

      {state.status === 'error' && (
        <p className="ayah-word-by-word-status is-error">Word meanings are unavailable right now.</p>
      )}

      {state.status === 'ready' && state.words.length === 0 && (
        <p className="ayah-word-by-word-status">No word meanings are available for this ayah.</p>
      )}

      {state.words.length > 0 && (
        <div className="ayah-word-by-word-list" dir="rtl">
          {state.words.map((word) => (
            <div className="ayah-word-by-word-item" key={word.id}>
              <span className="ayah-word-by-word-arabic" lang="ar">{word.arabic}</span>
              <span className="ayah-word-by-word-meaning" dir="ltr">{word.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
