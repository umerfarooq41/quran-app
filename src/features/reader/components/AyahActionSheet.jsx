import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Copy, Highlighter, Play, Share2 } from 'lucide-react';
import {
  getAyahAnnotations,
  removeAyahBookmark,
  removeAyahHighlight,
  saveAyahBookmark,
  saveAyahHighlight,
} from '../../../lib/db';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { getJuzForReference } from '../../../data/quranMeta';

const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 48;
const CHIP_ROW_HEIGHT = 48;
const BOOKMARK_PICKER_HEIGHT = 50;
const TOOLTIP_GAP = 12;
const VIEWPORT_EDGE = 8;
const DEFAULT_BOOKMARK = 'Reading';
const BOOKMARK_TYPES = [
  { category: 'Reading', label: 'Recite' },
  { category: 'Memorize', label: 'Memorize' },
  { category: 'Tadabbur', label: 'Tadabbur' },
];
const HIGHLIGHT_COLORS = [
  { id: 'amber', label: 'Yellow', value: '#FACC15' },
  { id: 'emerald', label: 'Green', value: '#86EFAC' },
  { id: 'sky', label: 'Blue', value: '#93C5FD' },
  { id: 'violet', label: 'Purple', value: '#C4B5FD' },
  { id: 'rose', label: 'Pink', value: '#FDA4AF' },
];

export function AyahActionSheet({
  ayah,
  onClose,
  onPlay,
  onShare,
  onCopied,
  onAnnotationsChanged,
}) {
  const [annotations, setAnnotations] = useState({ highlight: null, bookmarks: [] });
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);
  const placement = useMemo(() => getTooltipPlacement({
    ayah,
    highlightPaletteOpen,
    bookmarkPickerOpen,
  }), [
    ayah?.selectedWordRect,
    ayah?.ayahRect,
    ayah?.pointer,
    highlightPaletteOpen,
    bookmarkPickerOpen,
  ]);

  useEffect(() => {
    let mounted = true;

    if (!ayah?.surahNumber || !ayah?.ayahNumber) return undefined;

    setHighlightPaletteOpen(false);
    setBookmarkPickerOpen(false);
    getAyahAnnotations(ayah.surahNumber, ayah.ayahNumber)
      .then((nextAnnotations) => {
        if (mounted) setAnnotations(nextAnnotations);
      })
      .catch(() => {
        if (mounted) setAnnotations({ highlight: null, bookmarks: [] });
      });

    return () => {
      mounted = false;
    };
  }, [ayah?.surahNumber, ayah?.ayahNumber]);

  if (!ayah?.text) return null;

  const page = ayah.page || findPageForReference(ayah.surahNumber, ayah.ayahNumber);
  const reference = ayah.reference || `${ayah.surahNumber}:${ayah.ayahNumber}`;
  const surah = getSurah(ayah.surahNumber);
  const highlightColor = getHighlightColor(annotations.highlight?.color);
  const savedBookmark = getActiveBookmark(annotations.bookmarks);

  async function handleHighlightClick() {
    if (annotations.highlight) {
      await removeAyahHighlight(ayah.surahNumber, ayah.ayahNumber);
      onAnnotationsChanged?.();
      onClose?.();
      return;
    }

    setBookmarkPickerOpen(false);
    setHighlightPaletteOpen(true);
  }

  async function chooseHighlight(color) {
    await saveAyahHighlight({
      page,
      surah: ayah.surahNumber,
      ayah: ayah.ayahNumber,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      lineIndex: Number.isInteger(ayah.lineIndex) ? ayah.lineIndex : null,
      wordIndex: Number.isInteger(ayah.wordIndex) ? ayah.wordIndex : null,
      selectedWord: ayah.selectedWord || '',
      selectedWordId: ayah.selectedWordId || '',
      ayahKey: ayah.ayahKey || reference,
      color,
      preview: ayah.text,
    });

    onAnnotationsChanged?.();
    onClose?.();
  }

  function closeTooltip() {
    onClose?.();
  }

  async function handleBookmarkClick() {
    if (savedBookmark) {
      await Promise.all(
        annotations.bookmarks
          .filter((bookmark) => bookmark?.id)
          .map((bookmark) => removeAyahBookmark(bookmark.id)),
      );

      onAnnotationsChanged?.();
      onClose?.();
      return;
    }

    setHighlightPaletteOpen(false);
    setBookmarkPickerOpen(true);
  }

  async function chooseBookmark(category) {
    await saveAyahBookmark({
      page,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      category: category || DEFAULT_BOOKMARK,
      note: '',
      preview: ayah.text,
    });

    onAnnotationsChanged?.();
    onClose?.();
  }

  function playAyah() {
    onClose?.();
    onPlay?.({
      page,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      reference,
      arabic: ayah.text,
    });
  }

  function shareAyah() {
    onClose?.();
    onShare?.(ayah);
  }

  async function copyAyah() {
    const copyText = [
      cleanAyahText(ayah.text),
      '',
      `${surah?.name || 'Surah'} ${ayah.surahNumber}:${ayah.ayahNumber}`,
      `Juz ${getJuzForReference(ayah.surahNumber, ayah.ayahNumber)}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(copyText);
      onCopied?.();
    } catch {
      // Clipboard may be unavailable in older embedded browsers.
    }

    onClose?.();
  }

  return (
    <div className="ayah-tooltip-backdrop" data-reader-ui onClick={closeTooltip}>
      <motion.div
        initial={{ opacity: 0, scale: .94, y: placement.arrowPlacement === 'top' ? -4 : 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .96 }}
        transition={{ duration: .14, ease: 'easeOut' }}
        className="ayah-action-tooltip-wrap"
        style={{
          left: `${placement.left}px`,
          top: `${placement.top}px`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="ayah-action-tooltip"
          data-placement={placement.arrowPlacement}
          style={{
            '--ayah-tooltip-arrow-x': `${placement.arrowX}px`,
          }}
          role="toolbar"
          aria-label="Ayah actions"
        >
          <TooltipButton
            label="Highlight"
            icon={Highlighter}
            active={Boolean(annotations.highlight)}
            color={highlightColor?.value}
            onClick={handleHighlightClick}
          />
          <TooltipButton
            label="Bookmark"
            icon={Bookmark}
            active={Boolean(savedBookmark)}
            onClick={handleBookmarkClick}
          />
          <TooltipButton label="Play" icon={Play} onClick={playAyah} filled />
          <TooltipButton label="Share" icon={Share2} onClick={shareAyah} />
          <TooltipButton label="Copy" icon={Copy} onClick={copyAyah} />
        </div>

        {highlightPaletteOpen && !annotations.highlight && (
          <div className="ayah-highlight-chip-row" aria-label="Highlight color">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                aria-label={color.label}
                onClick={() => chooseHighlight(color.id)}
              >
                <span style={{ background: color.value }} />
              </button>
            ))}
          </div>
        )}

        {bookmarkPickerOpen && !savedBookmark && (
          <div className="ayah-bookmark-picker" aria-label="Bookmark type">
            {BOOKMARK_TYPES.map((type) => (
              <button
                key={type.category}
                type="button"
                onClick={() => chooseBookmark(type.category)}
              >
                {type.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TooltipButton({ label, icon: Icon, active = false, filled = false, color = '', onClick }) {
  function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={active ? 'is-active' : ''}
      style={color ? {
        '--ayah-tooltip-active-bg': `${color}33`,
        '--ayah-tooltip-active-color': color,
      } : undefined}
      onClick={handleClick}
    >
      <Icon size={21} fill={filled || active ? 'currentColor' : 'none'} />
    </button>
  );
}

function getTooltipPlacement({
  ayah,
  highlightPaletteOpen = false,
  bookmarkPickerOpen = false,
}) {
  const viewportWidth = typeof window === 'undefined' ? 390 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 844 : window.innerHeight;
  const tooltipHeight = TOOLTIP_HEIGHT
    + (highlightPaletteOpen ? CHIP_ROW_HEIGHT : 0)
    + (bookmarkPickerOpen ? BOOKMARK_PICKER_HEIGHT : 0);
  const anchor = getAnchorRect(ayah);
  const anchorCenterX = anchor.left + (anchor.width / 2);
  const left = clamp(
    anchorCenterX - (TOOLTIP_WIDTH / 2),
    VIEWPORT_EDGE,
    Math.max(VIEWPORT_EDGE, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_EDGE),
  );
  const spaceAbove = anchor.top;
  const spaceBelow = viewportHeight - anchor.bottom;
  const canShowAbove = spaceAbove >= TOOLTIP_HEIGHT + TOOLTIP_GAP;
  const showAbove = canShowAbove || spaceBelow < TOOLTIP_HEIGHT + TOOLTIP_GAP;
  const rawTop = showAbove
    ? anchor.top - tooltipHeight - TOOLTIP_GAP
    : anchor.bottom + TOOLTIP_GAP;
  const top = clamp(
    rawTop,
    VIEWPORT_EDGE,
    Math.max(VIEWPORT_EDGE, viewportHeight - tooltipHeight - VIEWPORT_EDGE),
  );
  const arrowX = clamp(anchorCenterX - left, 20, TOOLTIP_WIDTH - 20);

  return {
    left,
    top,
    arrowX,
    arrowPlacement: showAbove ? 'bottom' : 'top',
  };
}

function getHighlightColor(colorId) {
  return HIGHLIGHT_COLORS.find((color) => color.id === colorId) || null;
}

function getActiveBookmark(bookmarks = []) {
  return bookmarks.find((bookmark) => bookmark?.id) || null;
}

function getAnchorRect(ayah) {
  const rect = normalizeRect(ayah?.selectedWordRect)
    || normalizeRect(ayah?.ayahRect);

  if (rect) return rect;

  const pointerX = Number(ayah?.pointer?.x);
  const pointerY = Number(ayah?.pointer?.y);
  const left = Number.isFinite(pointerX) ? pointerX : (typeof window === 'undefined' ? 195 : window.innerWidth / 2);
  const top = Number.isFinite(pointerY) ? pointerY : (typeof window === 'undefined' ? 422 : window.innerHeight / 2);

  return {
    left,
    top,
    right: left + 1,
    bottom: top + 1,
    width: 1,
    height: 1,
  };
}

function normalizeRect(rect) {
  const left = Number(rect?.left);
  const top = Number(rect?.top);
  const width = Number(rect?.width);
  const height = Number(rect?.height);

  if (!Number.isFinite(left) || !Number.isFinite(top) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    left,
    top,
    width,
    height,
    right: Number.isFinite(Number(rect?.right)) ? Number(rect.right) : left + width,
    bottom: Number.isFinite(Number(rect?.bottom)) ? Number(rect.bottom) : top + height,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanAyahText(text = '') {
  return String(text)
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
