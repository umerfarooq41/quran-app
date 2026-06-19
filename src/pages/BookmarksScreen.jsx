import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, MoreVertical, Pencil, Tags, Trash2, X } from 'lucide-react';
import {
  changeAyahBookmarkType,
  db,
  removeAyahBookmark,
  removeAyahHighlight,
  saveAyahBookmark,
} from '../lib/db';
import { findPageForReference, getSurah, getSurahAyahs } from '../lib/quran';
import { useAppStore } from '../store/useAppStore';
import { Empty, Screen } from '../components/common/AppChrome';

const BOOKMARK_TYPES = [
  { category: 'Reading', label: 'Recitation / Reading', tone: 'emerald' },
  { category: 'Memorize', label: 'Memorize', tone: 'amber' },
  { category: 'Tadabbur', label: 'Tadabbur', tone: 'rose' },
  { category: 'Notes', label: 'Notes', tone: 'sky' },
];

export default function BookmarksScreen() {
  const { goBack, goAyah } = useAppStore();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [swipedCard, setSwipedCard] = useState(null);
  const [editor, setEditor] = useState(null);
  const [status, setStatus] = useState('');
  const swipeStart = useRef(null);
  const suppressCardClick = useRef(false);

  async function loadItems() {
    const [bookmarks, highlights] = await Promise.all([
      db.bookmarks.orderBy('createdAt').reverse().toArray(),
      db.highlights.toArray(),
    ]);
    const highlightByAyah = new Map();

    highlights.forEach((item) => {
      highlightByAyah.set(`${item.surahNumber}:${item.ayahNumber}`, item.color);
    });

    setItems(bookmarks.map((item) => ({
      ...item,
      filterType: normalizeCategory(item.category),
      highlightColor: highlightByAyah.get(`${item.surahNumber}:${item.ayahNumber}`) || '',
    })));
  }

  useEffect(() => {
    let mounted = true;

    loadItems().then(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleItems = items.filter((item) => (
    filter === 'All' || item.filterType === filter
  ));

  function jumpToItem(item, menuKey) {
    if (suppressCardClick.current) {
      suppressCardClick.current = false;
      if (swipedCard === menuKey) setSwipedCard(null);
      return;
    }
    if (swipedCard === menuKey) {
      setSwipedCard(null);
      return;
    }

    const itemPage = item.page || findPageForReference(item.surahNumber, item.ayahNumber);
    goAyah(item.surahNumber, item.ayahNumber, itemPage);
  }

  function startSwipe(event, menuKey) {
    const touch = event.touches[0];
    swipeStart.current = touch ? { menuKey, x: touch.clientX, y: touch.clientY } : null;
  }

  function finishSwipe(event, menuKey) {
    const start = swipeStart.current;
    const touch = event.changedTouches[0];
    swipeStart.current = null;
    if (!start || !touch || start.menuKey !== menuKey) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < -44) {
      suppressCardClick.current = true;
      setOpenMenu(null);
      setEditor(null);
      setSwipedCard(menuKey);
    } else if (deltaX > 30) {
      suppressCardClick.current = true;
      setSwipedCard(null);
    }
  }

  async function deleteBookmark(item) {
    await removeAyahBookmark(item.id);
    await loadItems();
    setStatus('Bookmark removed');
    setOpenMenu(null);
    setSwipedCard(null);
    setEditor(null);
  }

  async function clearHighlight(item) {
    await removeAyahHighlight(item.surahNumber, item.ayahNumber);
    await loadItems();
    setStatus('Highlight removed');
    setOpenMenu(null);
  }

  async function saveNote(item) {
    await saveAyahBookmark({
      page: item.page || findPageForReference(item.surahNumber, item.ayahNumber),
      surahNumber: item.surahNumber,
      ayahNumber: item.ayahNumber,
      category: item.category || 'Reading',
      note: editor?.value?.trim() || '',
      preview: item.preview || '',
      createdAt: item.createdAt,
    });
    await loadItems();
    setStatus('Note saved');
    setEditor(null);
  }

  async function changeType(item, category) {
    await changeAyahBookmarkType(item.id, category);
    await loadItems();
    setStatus('Bookmark type changed');
    setEditor(null);
  }

  return (
    <Screen className="tabs-screen">
      <div className="tabs-header compact">
        <button className="tabs-back-pill" onClick={() => goBack()} aria-label="Back">
          <ArrowLeft size={21} />
        </button>
        <h1>Bookmarks</h1>
      </div>

      <div className="tabs-filter-row" aria-label="Bookmark filters">
        <button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>
          All
        </button>
        {BOOKMARK_TYPES.map((type) => (
          <button
            key={type.category}
            className={filter === type.category ? 'active' : ''}
            onClick={() => setFilter(type.category)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {status && <p className="tabs-status" role="status">{status}</p>}

      {visibleItems.length === 0 ? (
        <Empty text="No bookmarks in this filter. Long-press an ayah to save one." />
      ) : (
        <div className="tabs-list">
          {visibleItems.map((item) => {
            const menuKey = `bookmark-${item.id}`;
            const surah = getSurah(item.surahNumber);
            const ayah = getSurahAyahs(item.surahNumber)
              .find((candidate) => candidate.ayahNumber === item.ayahNumber);
            const preview = item.preview || ayah?.text || `${item.surahNumber}:${item.ayahNumber}`;
            const type = getBookmarkType(item.filterType);
            const editorOpen = editor?.key === menuKey;

            return (
              <article
                key={menuKey}
                className={`tab-card ${swipedCard === menuKey ? 'is-swiped' : ''}`}
              >
                <button
                  type="button"
                  className="tab-card-remove"
                  onClick={() => deleteBookmark(item)}
                >
                  <Trash2 size={19} />
                  Remove
                </button>

                <div
                  className="tab-card-surface"
                  onTouchStart={(event) => startSwipe(event, menuKey)}
                  onTouchEnd={(event) => finishSwipe(event, menuKey)}
                >
                  <button
                    type="button"
                    className="tab-card-hit"
                    onClick={() => jumpToItem(item, menuKey)}
                    aria-label={`Open ${surah?.name || 'ayah'} ${item.ayahNumber}`}
                  >
                    <div className="tab-card-top">
                      <span className={`tab-bookmark tab-bookmark-${type.tone}`}>
                        <Bookmark size={20} fill="currentColor" strokeWidth={0} />
                      </span>
                      <span className="tab-card-heading">
                        <span className={`tab-type tab-type-${type.tone}`}>{type.label}</span>
                        <span className="tab-surah">{surah?.name} - {item.surahNumber}:{item.ayahNumber}</span>
                      </span>
                    </div>

                    <p className="tab-saved-date">Saved on {formatSavedDate(item.createdAt || item.updatedAt)}</p>
                    {item.note && <p className="tab-note">{item.note}</p>}
                    <p dir="rtl" className="tab-arabic">{preview}</p>
                  </button>

                  <button
                    type="button"
                    className="tab-more-button"
                    onClick={() => {
                      suppressCardClick.current = false;
                      setSwipedCard(null);
                      setEditor(null);
                      setOpenMenu(openMenu === menuKey ? null : menuKey);
                    }}
                    aria-label="Bookmark actions"
                  >
                    <MoreVertical size={20} />
                  </button>

                  {openMenu === menuKey && (
                    <div className="tab-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setEditor({ key: menuKey, mode: 'note', value: item.note || '' });
                          setOpenMenu(null);
                        }}
                      >
                        <Pencil size={16} />
                        Edit note
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditor({ key: menuKey, mode: 'type' });
                          setOpenMenu(null);
                        }}
                      >
                        <Tags size={16} />
                        Change type
                      </button>
                      {item.highlightColor && (
                        <button type="button" onClick={() => clearHighlight(item)}>
                          <X size={16} />
                          Remove Highlight
                        </button>
                      )}
                      <button type="button" className="danger" onClick={() => deleteBookmark(item)}>
                        <Trash2 size={16} />
                        Remove bookmark
                      </button>
                    </div>
                  )}

                  {editorOpen && editor.mode === 'note' && (
                    <div className="tab-inline-editor">
                      <label htmlFor={`note-${item.id}`}>Bookmark note</label>
                      <textarea
                        id={`note-${item.id}`}
                        rows={3}
                        value={editor.value}
                        onChange={(event) => setEditor((current) => ({ ...current, value: event.target.value }))}
                        placeholder="Add a note..."
                      />
                      <div>
                        <button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button>
                        <button type="button" className="primary" onClick={() => saveNote(item)}>Save note</button>
                      </div>
                    </div>
                  )}

                  {editorOpen && editor.mode === 'type' && (
                    <div className="tab-inline-editor">
                      <div className="tab-inline-title">Change bookmark type</div>
                      <div className="tab-type-options">
                        {BOOKMARK_TYPES.map((option) => (
                          <button
                            type="button"
                            key={option.category}
                            className={`tab-type-option tab-type-${option.tone}`}
                            onClick={() => changeType(item, option.category)}
                          >
                            <Bookmark size={15} fill="currentColor" />
                            <span>{option.label}</span>
                            {item.filterType === option.category && <Check size={15} />}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="tab-editor-cancel" onClick={() => setEditor(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function normalizeCategory(category) {
  if (category === 'Recitation') return 'Reading';
  return BOOKMARK_TYPES.some((type) => type.category === category) ? category : 'Reading';
}

function getBookmarkType(category) {
  return BOOKMARK_TYPES.find((type) => type.category === category) || BOOKMARK_TYPES[0];
}

function formatSavedDate(timestamp) {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
