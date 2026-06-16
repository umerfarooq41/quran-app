import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Check, Copy, Palette, Play, Share2, X } from 'lucide-react';
import { db } from '../../../lib/db';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { getUrduTranslation } from '../../../lib/translations';
import { useAppStore } from '../../../store/useAppStore';

export function AyahActionSheet({ line, onClose }) {
  const { setAudioTarget } = useAppStore();
  const [status, setStatus] = useState('');
  const [translation, setTranslation] = useState('');
  const [showColors, setShowColors] = useState(false);
  const [selectedColor, setSelectedColor] = useState('amber');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!line?.surahNumber || !line?.ayahStart) {
      setTranslation('');
      setExpanded(false);
      return () => {
        mounted = false;
      };
    }

    setExpanded(false);
    getUrduTranslation(line.surahNumber, line.ayahStart)
      .then((text) => {
        if (mounted) setTranslation(text || '');
      })
      .catch(() => {
        if (mounted) setTranslation('');
      });

    return () => {
      mounted = false;
    };
  }, [line?.surahNumber, line?.ayahStart]);

  if (!line || !line.text) return null;

  const page = findPageForReference(line.surahNumber, line.ayahStart);
  const reference = line.ayahStart
    ? `${line.surahNumber}:${line.ayahStart}${line.ayahEnd !== line.ayahStart ? `-${line.ayahEnd}` : ''}`
    : `Surah ${line.surahNumber}`;

  const surah = getSurah(line.surahNumber);
  const tafsirText = translation || surah?.shortText || 'Translation/tafsir not available for this ayah.';
  const shareText = `${line.text}\n${tafsirText ? `${tafsirText}\n` : ''}${reference}`;

  const colorOptions = [
    ['amber', 'Amber'],
    ['emerald', 'Green'],
    ['rose', 'Rose'],
    ['sky', 'Blue'],
    ['violet', 'Purple'],
  ];

  async function addBookmark() {
    await db.bookmarks.add({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      category: 'Reading',
      note: '',
      preview: line.text,
      createdAt: Date.now(),
    });

    setStatus('Bookmark saved');
  }

  async function addHighlight(color = selectedColor) {
    await db.highlights.add({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      color,
      preview: line.text,
      createdAt: Date.now(),
    });

    setSelectedColor(color);
    setStatus(`${colorOptions.find(([id]) => id === color)?.[1] || 'Color'} highlight saved`);
  }

  async function copyAyah() {
    try {
      await navigator.clipboard?.writeText(shareText);
      setStatus('Copied');
    } catch {
      setStatus('Copy is not available in this browser');
    }
  }

  async function shareAyah() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Qur’an ${reference}`,
          text: shareText,
        });

        setStatus('Share sheet opened');
      } else {
        await copyAyah();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setStatus('Share was not completed');
      }
    }
  }

  function playAyah() {
    setAudioTarget({
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      page,
    });

    setStatus(`Ready to play ${reference}`);
  }

  return (
    <div className="ayah-action-backdrop" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 1 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className={`ayah-action-sheet ayah-action-sheet-compact ${expanded ? 'ayah-action-sheet-expanded' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" />

        <div className="ayah-main-action-row ayah-main-action-row-compact" aria-label="Ayah actions">
          <button className="ayah-round-action" onClick={() => setShowColors((value) => !value)} aria-label="Highlight">
            <Palette size={22} strokeWidth={1.8} />
            <span>Highlight</span>
          </button>

          <button className="ayah-round-action active" onClick={addBookmark} aria-label="Bookmark">
            <Bookmark size={22} strokeWidth={1.8} />
            <span>Bookmark</span>
          </button>

          <button className="ayah-round-action" onClick={playAyah} aria-label="Play">
            <Play size={22} strokeWidth={1.8} />
            <span>Play</span>
          </button>

          <button className="ayah-round-action" onClick={shareAyah} aria-label="Share">
            <Share2 size={22} strokeWidth={1.8} />
            <span>Share</span>
          </button>

          <button className="ayah-round-action" onClick={copyAyah} aria-label="Copy">
            <Copy size={22} strokeWidth={1.8} />
            <span>Copy</span>
          </button>
        </div>

        {showColors && (
          <div className="highlight-color-row highlight-color-row-compact">
            {colorOptions.map(([id, label]) => (
              <button
                key={id}
                onClick={() => addHighlight(id)}
                className={`highlight-color-button highlight-${id}`}
                aria-label={`${label} highlight`}
              >
                {selectedColor === id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}

        <section className="ayah-tafsir-block ayah-tafsir-block-compact">
          <div className="ayah-tafsir-title-row">
            <h3>Translation / Tafsir</h3>
            <span className="ayah-ref-pill">{reference}</span>
          </div>

          <p dir={translation ? 'rtl' : 'ltr'} className={expanded ? '' : 'ayah-tafsir-preview'}>
            {tafsirText}
          </p>

          <button onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Show less' : 'Read more'}
          </button>
        </section>

        {status && <p className="ayah-action-status">{status}</p>}
      </motion.div>
    </div>
  );
}
