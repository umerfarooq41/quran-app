import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Highlighter, MapPin, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  db,
  removeAyahBookmark,
  removeAyahHighlight,
  saveAyahBookmark,
} from '../lib/db';
import { findPageForReference, getSurah, getSurahAyahs } from '../lib/quran';
import { useAppStore } from '../store/useAppStore';
import { BackButton, Empty, Screen } from '../components/common/AppChrome';

const BOOKMARK_TYPES = [
  { category: 'Reading', label: 'Recite', tone: 'emerald' },
  { category: 'Memorize', label: 'Memorize', tone: 'amber' },
  { category: 'Tadabbur', label: 'Tadabbur', tone: 'rose' },
];

const HIGHLIGHT_TONES = ['amber', 'emerald', 'sky', 'violet', 'rose'];
const HIGHLIGHT_TONE_BY_VALUE = {
  '#FACC15': 'amber',
  '#86EFAC': 'emerald',
  '#93C5FD': 'sky',
  '#C4B5FD': 'violet',
  '#FDA4AF': 'rose',
};

export default function BookmarksScreen() {
  const { goBack, goAyah, goQuarterTarget } = useAppStore(useShallow((state) => ({
    goBack: state.goBack,
    goAyah: state.goAyah,
    goQuarterTarget: state.goQuarterTarget,
  })));
  const [activeTab, setActiveTab] = useState('bookmarks');
  const [bookmarks, setBookmarks] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [swipedCard, setSwipedCard] = useState(null);
  const [editor, setEditor] = useState(null);
  const [status, setStatus] = useState('');
  const swipeStart = useRef(null);
  const suppressCardClick = useRef(false);

  async function loadItems() {
    const [bookmarkRows, highlightRows, noteRows] = await Promise.all([
      db.bookmarks.orderBy('createdAt').reverse().toArray(),
      db.highlights.toArray(),
      db.notes.toArray(),
    ]);
    const notesByAyah = new Map();

    noteRows.forEach((item) => {
      if (item?.surahNumber && item?.ayahNumber && item?.text) {
        notesByAyah.set(`${item.surahNumber}:${item.ayahNumber}`, item.text);
      }
    });

    const nextBookmarks = bookmarkRows
      .map((item) => ({
        ...item,
        filterType: normalizeCategory(item.category),
        note: item.note || notesByAyah.get(`${item.surahNumber}:${item.ayahNumber}`) || '',
      }))
      .filter((item) => isLibraryBookmark(item.filterType));

    const nextHighlights = highlightRows
      .filter((item) => item?.surahNumber && item?.ayahNumber)
      .sort((first, second) => (
        (second.updatedAt || second.createdAt || 0) - (first.updatedAt || first.createdAt || 0)
      ));

    setBookmarks(nextBookmarks);
    setHighlights(nextHighlights);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function jumpToBookmark(item, menuKey, fromMenu = false) {
    if (!fromMenu && suppressCardClick.current) {
      suppressCardClick.current = false;
      if (swipedCard === menuKey) setSwipedCard(null);
      return;
    }
    if (!fromMenu && swipedCard === menuKey) {
      setSwipedCard(null);
      return;
    }

    const itemPage = item.page || findPageForReference(item.surahNumber, item.ayahNumber);
    setOpenMenu(null);
    setEditor(null);
    setSwipedCard(null);
    goQuarterTarget({
      id: 'bookmark',
      page: itemPage,
      surah: item.surahNumber,
      ayah: item.ayahNumber,
    });
  }

  function jumpToHighlight(item, menuKey, fromMenu = false) {
    if (!fromMenu && suppressCardClick.current) {
      suppressCardClick.current = false;
      return;
    }

    const itemPage = item.page || findPageForReference(item.surahNumber, item.ayahNumber);
    setOpenMenu(null);
    setEditor(null);
    setSwipedCard(null);
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

  async function deleteHighlight(item) {
    await removeAyahHighlight(item.surahNumber, item.ayahNumber);
    await loadItems();
    setStatus('Highlight removed');
    setOpenMenu(null);
    setEditor(null);
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

  function selectTab(nextTab) {
    setActiveTab(nextTab);
    setOpenMenu(null);
    setEditor(null);
    setSwipedCard(null);
  }

  return (
    <Screen className="tabs-screen">
      <div className="tabs-header compact">
        <BackButton className="tabs-back-pill" onClick={() => goBack()} />
        <h1>Library</h1>
      </div>

      <div className="library-tabs" role="tablist" aria-label="Library tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bookmarks'}
          className={activeTab === 'bookmarks' ? 'is-active' : ''}
          onClick={() => selectTab('bookmarks')}
        >
          Bookmarks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'highlights'}
          className={activeTab === 'highlights' ? 'is-active' : ''}
          onClick={() => selectTab('highlights')}
        >
          Highlights
        </button>
      </div>

      {status && <p className="tabs-status" role="status">{status}</p>}

      {activeTab === 'bookmarks' ? (
        <BookmarkList
          items={bookmarks}
          openMenu={openMenu}
          swipedCard={swipedCard}
          editor={editor}
          suppressCardClick={suppressCardClick}
          onDelete={deleteBookmark}
          onEditorChange={setEditor}
          onFinishSwipe={finishSwipe}
          onJump={jumpToBookmark}
          onMenuChange={setOpenMenu}
          onSaveNote={saveNote}
          onStartSwipe={startSwipe}
          onSwipedCardChange={setSwipedCard}
        />
      ) : (
        <HighlightList
          items={highlights}
          openMenu={openMenu}
          suppressCardClick={suppressCardClick}
          onDelete={deleteHighlight}
          onJump={jumpToHighlight}
          onMenuChange={setOpenMenu}
        />
      )}
    </Screen>
  );
}

function BookmarkList({
  items,
  openMenu,
  swipedCard,
  editor,
  suppressCardClick,
  onDelete,
  onEditorChange,
  onFinishSwipe,
  onJump,
  onMenuChange,
  onSaveNote,
  onStartSwipe,
  onSwipedCardChange,
}) {
  if (items.length === 0) {
    return (
      <Empty text={(
        <span className="library-empty-copy">
          <span>No bookmarks yet.</span>
          <span>Long press an ayah and tap bookmark to save one.</span>
        </span>
      )}
      />
    );
  }

  return (
    <div className="tabs-list" role="tabpanel" aria-label="Bookmarks">
      {items.map((item) => {
        const menuKey = `bookmark-${item.id}`;
        const preview = getAyahPreview(item);
        const type = getBookmarkType(item.filterType);
        const editorOpen = editor?.key === menuKey;
        const reference = formatReference(item);

        return (
          <article
            key={menuKey}
            className={`tab-card ${swipedCard === menuKey ? 'is-swiped' : ''}`}
          >
            <button
              type="button"
              className="tab-card-remove"
              onClick={() => onDelete(item)}
            >
              <Trash2 size={19} />
              Remove
            </button>

            <div
              className="tab-card-surface"
              onTouchStart={(event) => onStartSwipe(event, menuKey)}
              onTouchEnd={(event) => onFinishSwipe(event, menuKey)}
            >
              <button
                type="button"
                className="tab-card-hit"
                onClick={() => onJump(item, menuKey)}
                aria-label={`Open ${reference}`}
              >
                <div className="tab-card-top">
                  <span className="tab-card-type">
                    <span className={`tab-bookmark tab-bookmark-${type.tone}`}>
                      <Bookmark size={20} fill="currentColor" strokeWidth={0} />
                    </span>
                    <span className="tab-type">{type.label}</span>
                  </span>
                  <span className="tab-surah">{reference}</span>
                </div>

                <p className="tab-saved-date">Saved: {formatSavedDate(item.createdAt || item.updatedAt)}</p>
                {item.note && <p className="tab-note">{item.note}</p>}
                <p dir="rtl" className="tab-arabic">{preview}</p>
              </button>

              <button
                type="button"
                className="tab-more-button"
                onClick={() => {
                  suppressCardClick.current = false;
                  onSwipedCardChange(null);
                  onEditorChange(null);
                  onMenuChange(openMenu === menuKey ? null : menuKey);
                }}
                aria-label="Bookmark actions"
              >
                <MoreVertical size={20} />
              </button>

              {openMenu === menuKey && (
                <div className="tab-menu" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onJump(item, menuKey, true)}
                  >
                    <MapPin size={16} />
                    Jump to Ayah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEditorChange({ key: menuKey, mode: 'note', value: item.note || '' });
                      onMenuChange(null);
                    }}
                  >
                    <Pencil size={16} />
                    {item.note ? 'Edit Note' : 'Add Note'}
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(item)}>
                    <Trash2 size={16} />
                    Remove Bookmark
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
                    onChange={(event) => onEditorChange((current) => ({ ...current, value: event.target.value }))}
                    placeholder="Add a note..."
                  />
                  <div>
                    <button type="button" className="secondary" onClick={() => onEditorChange(null)}>Cancel</button>
                    <button type="button" className="primary" onClick={() => onSaveNote(item)}>Save</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HighlightList({
  items,
  openMenu,
  suppressCardClick,
  onDelete,
  onJump,
  onMenuChange,
}) {
  if (items.length === 0) {
    return (
      <Empty text={(
        <span className="library-empty-copy">
          <span>No highlights yet.</span>
          <span>Long press an ayah and tap highlight to mark it.</span>
        </span>
      )}
      />
    );
  }

  return (
    <div className="tabs-list" role="tabpanel" aria-label="Highlights">
      {items.map((item) => {
        const menuKey = `highlight-${item.id || `${item.surahNumber}-${item.ayahNumber}`}`;
        const preview = getAyahPreview(item);
        const reference = formatReference(item);
        const tone = getHighlightTone(item.color);

        return (
          <article key={menuKey} className="tab-card library-highlight-card">
            <div className={`library-highlight-strip library-highlight-${tone}`} aria-hidden="true" />
            <div className="tab-card-surface">
              <button
                type="button"
                className="tab-card-hit"
                onClick={() => onJump(item, menuKey)}
                aria-label={`Open ${reference}`}
              >
                <div className="tab-card-top">
                  <span className="tab-card-type">
                    <span className={`library-highlight-dot library-highlight-${tone}`}>
                      <Highlighter size={15} />
                    </span>
                    <span className="tab-type">Highlight</span>
                  </span>
                  <span className="tab-surah">{reference}</span>
                </div>

                <p className="tab-saved-date">Saved: {formatSavedDate(item.createdAt || item.updatedAt)}</p>
                <p dir="rtl" className="tab-arabic">{preview}</p>
              </button>

              <button
                type="button"
                className="tab-more-button"
                onClick={() => {
                  suppressCardClick.current = false;
                  onMenuChange(openMenu === menuKey ? null : menuKey);
                }}
                aria-label="Highlight actions"
              >
                <MoreVertical size={20} />
              </button>

              {openMenu === menuKey && (
                <div className="tab-menu" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onJump(item, menuKey, true)}>
                    <MapPin size={16} />
                    Jump to Ayah
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(item)}>
                    <X size={16} />
                    Remove Highlight
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function normalizeCategory(category) {
  if (category === 'Notes') return 'Notes';
  if (category === 'Recite' || category === 'Recitation') return 'Reading';
  return BOOKMARK_TYPES.some((type) => type.category === category) ? category : 'Reading';
}

function isLibraryBookmark(category) {
  return BOOKMARK_TYPES.some((type) => type.category === category);
}

function getBookmarkType(category) {
  return BOOKMARK_TYPES.find((type) => type.category === category) || BOOKMARK_TYPES[0];
}

function getAyahPreview(item) {
  const ayah = getSurahAyahs(item.surahNumber)
    .find((candidate) => candidate.ayahNumber === item.ayahNumber);

  return item.preview || ayah?.text || `${item.surahNumber}:${item.ayahNumber}`;
}

function formatReference(item) {
  const surah = getSurah(item.surahNumber);

  return `${surah?.name || 'Surah'} ${item.surahNumber}:${item.ayahNumber}`;
}

function getHighlightTone(color) {
  if (HIGHLIGHT_TONES.includes(color)) return color;

  return HIGHLIGHT_TONE_BY_VALUE[String(color || '').toUpperCase()] || 'amber';
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
