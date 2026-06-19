import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Search } from 'lucide-react';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '../lib/db';
import { searchQuranImproved } from '../lib/quranSearch';
import { loadTranslation } from '../lib/translations';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';

const RECENT_SAVE_DELAY = 900;

export default function SearchScreen() {
  const { goAyah, goPage, settings } = useAppStore();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [translations, setTranslations] = useState(null);
  const debounceTimer = useRef(null);
  const mountedRef = useRef(true);
  const skipNextDebounce = useRef(false);
  const results = useMemo(
    () => searchQuranImproved(query, translations),
    [query, translations],
  );
  const cleanQuery = query.trim();

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    getRecentSearches().then((items) => {
      if (mounted) setRecentSearches(items);
    });
    loadTranslation(settings.translation)
      .then((data) => {
        if (mounted) setTranslations(data);
      })
      .catch(() => {
        if (mounted) setTranslations(null);
      });

    return () => {
      mounted = false;
      mountedRef.current = false;
      window.clearTimeout(debounceTimer.current);
    };
  }, [settings.translation]);

  useEffect(() => {
    window.clearTimeout(debounceTimer.current);
    if (!cleanQuery) return undefined;
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return undefined;
    }

    debounceTimer.current = window.setTimeout(() => {
      persistRecentSearch(cleanQuery);
    }, RECENT_SAVE_DELAY);

    return () => window.clearTimeout(debounceTimer.current);
  }, [cleanQuery]);

  async function persistRecentSearch(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;

    const items = await saveRecentSearch(trimmed);
    if (mountedRef.current) setRecentSearches(items);
  }

  function submitSearch(event) {
    event.preventDefault();
    if (!cleanQuery) return;

    window.clearTimeout(debounceTimer.current);
    setQuery(cleanQuery);
    persistRecentSearch(cleanQuery);
  }

  function chooseRecent(item) {
    skipNextDebounce.current = true;
    setQuery(item.query);
    persistRecentSearch(item.query);
  }

  async function clearHistory() {
    window.clearTimeout(debounceTimer.current);
    await clearRecentSearches();
    if (mountedRef.current) setRecentSearches([]);
  }

  function openResult(result) {
    if (cleanQuery) persistRecentSearch(cleanQuery);

    if (result.surahNumber && result.ayahNumber) {
      goAyah(result.surahNumber, result.ayahNumber, result.page);
      return;
    }

    goPage(result.page);
  }

  return (
    <Screen className="search-screen">
      <Header title="Search" />

      <form className="search-form" onSubmit={submitSearch}>
        <Search size={19} aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Surah, Arabic text, 2:255, page 12..."
          aria-label="Search the Quran"
        />
        <button type="submit" disabled={!cleanQuery}>Search</button>
      </form>

      {!cleanQuery && recentSearches.length > 0 && (
        <section className="search-recent">
          <div className="search-recent-heading">
            <h2>Recent searches</h2>
            <button type="button" onClick={clearHistory}>Clear</button>
          </div>
          <div className="search-recent-list">
            {recentSearches.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseRecent(item)}>
                <Clock3 size={15} />
                <span>{item.query}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {cleanQuery && (
        <section className="search-results" aria-live="polite">
          <div className="search-results-heading">
            <h2>Results</h2>
            <span>{results.length}</span>
          </div>

          {results.length === 0 ? (
            <p className="search-empty">No matching Surah or ayah found.</p>
          ) : (
            <div className="search-results-list">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.surahNumber || result.page}-${result.ayahNumber || index}`}
                  type="button"
                  className="search-result-card"
                  onClick={() => openResult(result)}
                >
                  <span className="search-result-reference">
                    <strong>{result.surahName || result.title}</strong>
                    {result.ayahNumber && <small>Ayah {result.ayahNumber}</small>}
                  </span>
                  <span
                    className="search-result-preview"
                    dir={containsArabic(result.preview) ? 'rtl' : 'ltr'}
                  >
                    {result.preview}
                  </span>
                  <span className="search-result-meta">
                    {result.matchType} · Page {result.page}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </Screen>
  );
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ''));
}
