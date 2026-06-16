import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Copy, Play, Share2 } from 'lucide-react';
import { db } from '../../../lib/db';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { getUrduTranslation } from '../../../lib/translations';

export function AyahActionSheet({ line, onClose, onPlay }) {
  const [status, setStatus] = useState('');
  const [translation, setTranslation] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!line?.surahNumber || !line?.ayahStart) {
      setTranslation('');
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
  const tafsirText = translation || surah?.shortText || 'Tafsir is not available for this ayah yet.';
  const shareText = `${line.text}\n${tafsirText ? `${tafsirText}\n` : ''}${reference}`;

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
        await navigator.share({ title: `Qur’an ${reference}`, text: shareText });
        setStatus('Share sheet opened');
      } else {
        await copyAyah();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus('Share was not completed');
    }
  }

  function playAyah() {
    onPlay?.({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      reference,
      arabic: line.text,
    });
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
        className="ayah-action-sheet ayah-action-sheet-compact"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" />

        <div className="ayah-main-action-row ayah-main-action-row-compact">
          <button className="ayah-round-action gradient" aria-label="App">
            <span className="brand-dot" />
          </button>

          <button className="ayah-round-action" onClick={addBookmark} aria-label="Bookmark">
            <Bookmark size={22} strokeWidth={1.8} />
          </button>

          <button className="ayah-round-action" onClick={playAyah} aria-label="Play">
            <Play size={22} strokeWidth={1.8} fill="currentColor" />
          </button>

          <button className="ayah-round-action" onClick={shareAyah} aria-label="Share">
            <Share2 size={22} strokeWidth={1.8} />
          </button>

          <button className="ayah-round-action" onClick={copyAyah} aria-label="Copy">
            <Copy size={22} strokeWidth={1.8} />
          </button>
        </div>

        <section className={`ayah-tafsir-block ${expanded ? 'ayah-tafsir-expanded' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <h3>Tafsir</h3>
            <span className="ayah-ref-pill">{reference}</span>
          </div>

          <p className={!expanded ? 'tafsir-preview-text' : ''} dir={translation ? 'rtl' : 'ltr'}>{tafsirText}</p>

          {!expanded && (
            <button type="button" onClick={() => setExpanded(true)}>Read more</button>
          )}
        </section>

        {status && <p className="ayah-action-status">{status}</p>}
      </motion.div>
    </div>
  );
}
