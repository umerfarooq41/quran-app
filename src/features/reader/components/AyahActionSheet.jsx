import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Check, Copy, Highlighter, Play, Share2 } from 'lucide-react';
import { getAyahAnnotations, saveAyahBookmark, saveAyahHighlight } from '../../../lib/db';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { getJuzForReference } from '../../../data/quranMeta';
import { getUrduTranslation } from '../../../lib/translations';

const HIGHLIGHT_COLORS = ['amber', 'emerald', 'rose', 'sky', 'violet'];

const BOOKMARK_TYPES = [
  { category: 'Reading', label: 'Recitation / Reading', tone: 'emerald' },
  { category: 'Memorize', label: 'Memorize', tone: 'amber' },
  { category: 'Tadabbur', label: 'Tadabbur', tone: 'rose' },
  { category: 'Notes', label: 'Add Notes', tone: 'sky' },
];

export function AyahActionSheet({
  ayah,
  onClose,
  onPlay,
  onShare,
  onAnnotationsChanged,
}) {
  const [status, setStatus] = useState('');
  const [translation, setTranslation] = useState('');
  const [tafsirExpanded, setTafsirExpanded] = useState(false);
  const [openPanel, setOpenPanel] = useState(null);
  const [highlightColor, setHighlightColor] = useState('');
  const [bookmarkTypes, setBookmarkTypes] = useState(new Set());
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    let mounted = true;

    if (!ayah?.surahNumber || !ayah?.ayahNumber) return undefined;

    setOpenPanel(null);
    setTafsirExpanded(false);
    setStatus('');

    Promise.all([
      getUrduTranslation(ayah.surahNumber, ayah.ayahNumber).catch(() => ''),
      getAyahAnnotations(ayah.surahNumber, ayah.ayahNumber),
    ]).then(([translationText, annotations]) => {
      if (!mounted) return;

      setTranslation(translationText || '');
      setHighlightColor(annotations.highlight?.color || '');
      setBookmarkTypes(new Set(annotations.bookmarks.map((item) => item.category)));
      setNoteText(annotations.bookmarks.find((item) => item.category === 'Notes')?.note || '');
    });

    return () => {
      mounted = false;
    };
  }, [ayah?.surahNumber, ayah?.ayahNumber]);

  if (!ayah || !ayah.text) return null;

  const page = ayah.page || findPageForReference(ayah.surahNumber, ayah.ayahNumber);
  const reference = ayah.reference || `${ayah.surahNumber}:${ayah.ayahNumber}`;
  const surah = getSurah(ayah.surahNumber);
  const tafsirText = translation || surah?.shortText || 'Tafsir is not available for this ayah yet.';

  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? null : panel);
    setStatus('');
  }

  async function chooseHighlight(color) {
    await saveAyahHighlight({
      page,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      color,
      preview: ayah.text,
    });
    setHighlightColor(color);
    setStatus('Highlight saved');
    onAnnotationsChanged?.();
  }

  async function chooseBookmark(type) {
    if (type.category === 'Notes') {
      setBookmarkTypes((current) => new Set(current).add('Notes'));
      return;
    }

    await saveBookmark(type.category, '');
  }

  async function saveBookmark(category, note) {
    await saveAyahBookmark({
      page,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      category,
      note,
      preview: ayah.text,
    });
    setBookmarkTypes((current) => new Set(current).add(category));
    setStatus(category === 'Notes' ? 'Note saved' : 'Bookmark saved');
    onAnnotationsChanged?.();
  }

  async function copyAyah() {
    const translationText = translation || await getUrduTranslation(
      ayah.surahNumber,
      ayah.ayahNumber,
    ).catch(() => '');
    const copyText = [
      cleanAyahText(ayah.text),
      '',
      translationText,
      '',
      `${surah?.name || 'Surah'} — Ayah ${ayah.ayahNumber}`,
      `Juz ${getJuzForReference(ayah.surahNumber, ayah.ayahNumber)}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(copyText);
      setStatus('Copied');
    } catch {
      setStatus('Copy is not available in this browser');
    }
  }

  function playAyah() {
    onPlay?.({
      page,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      reference,
      arabic: ayah.text,
    });
  }

  return (
    <div className="ayah-action-backdrop" data-reader-ui onClick={onClose}>
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: .9 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={.16}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="ayah-action-sheet ayah-action-sheet-v2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" />

        <div className="ayah-action-reference">
          <strong>{surah?.name}</strong>
          <span>{reference}</span>
        </div>

        <div className="ayah-main-actions-v2">
          <MainAction
            label="Highlight"
            icon={Highlighter}
            active={openPanel === 'highlight' || Boolean(highlightColor)}
            onClick={() => togglePanel('highlight')}
          />
          <MainAction
            label="Bookmark"
            icon={Bookmark}
            active={openPanel === 'bookmark' || bookmarkTypes.size > 0}
            onClick={() => togglePanel('bookmark')}
          />
          <MainAction label="Play" icon={Play} onClick={playAyah} />
          <MainAction label="Share" icon={Share2} onClick={() => onShare?.(ayah)} />
          <MainAction label="Copy" icon={Copy} onClick={copyAyah} />
        </div>

        {openPanel === 'highlight' && (
          <section className="ayah-inline-panel">
            <div className="ayah-inline-panel-title">
              <strong>Highlight color</strong>
              {highlightColor && <span>Tap another color to change it</span>}
            </div>
            <div className="ayah-highlight-colors">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`highlight-color-button highlight-${color} ${highlightColor === color ? 'is-selected' : ''}`}
                  onClick={() => chooseHighlight(color)}
                  aria-label={`${color} highlight`}
                >
                  {highlightColor === color && <Check size={17} />}
                </button>
              ))}
            </div>
          </section>
        )}

        {openPanel === 'bookmark' && (
          <section className="ayah-inline-panel">
            <div className="ayah-inline-panel-title">
              <strong>Bookmark type</strong>
              <span>You can save more than one type</span>
            </div>
            <div className="ayah-bookmark-types">
              {BOOKMARK_TYPES.map((type) => (
                <button
                  key={type.category}
                  type="button"
                  className={`bookmark-type bookmark-type-${type.tone} ${bookmarkTypes.has(type.category) ? 'is-selected' : ''}`}
                  onClick={() => chooseBookmark(type)}
                >
                  <Bookmark size={17} fill="currentColor" />
                  <span>{type.label}</span>
                  {bookmarkTypes.has(type.category) && <Check size={16} />}
                </button>
              ))}
            </div>

            {bookmarkTypes.has('Notes') && (
              <div className="ayah-note-editor">
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Write your note…"
                  rows={3}
                />
                <button type="button" onClick={() => saveBookmark('Notes', noteText)}>
                  Save note
                </button>
              </div>
            )}
          </section>
        )}

        <section className={`ayah-tafsir-block ${tafsirExpanded ? 'ayah-tafsir-expanded' : ''}`}>
          <div className="ayah-tafsir-heading">
            <h3>Tafsir</h3>
            <span className="ayah-ref-pill">{reference}</span>
          </div>
          <p className={!tafsirExpanded ? 'tafsir-preview-text' : ''} dir={translation ? 'rtl' : 'ltr'}>
            {tafsirText}
          </p>
          <button type="button" onClick={() => setTafsirExpanded((current) => !current)}>
            {tafsirExpanded ? 'Show less' : 'Read more'}
          </button>
        </section>

        {status && <p className="ayah-action-status" role="status">{status}</p>}
      </motion.section>
    </div>
  );
}

function MainAction({ label, icon: Icon, active = false, onClick }) {
  return (
    <button
      type="button"
      className={`ayah-main-action-v2 ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <span><Icon size={21} fill={label === 'Play' ? 'currentColor' : 'none'} /></span>
      <small>{label}</small>
    </button>
  );
}

function cleanAyahText(text = '') {
  return String(text)
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
