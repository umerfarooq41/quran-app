import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Check, Copy, Palette, Play, Share2, X } from 'lucide-react';
import { db } from '../../../lib/db';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { generateAyahImage } from '../../../lib/shareCanvas';
import { getUrduTranslation } from '../../../lib/translations';
import { useAppStore } from '../../../store/useAppStore';

export function AyahActionSheet({ line, onClose }) {
  const { setView, goPage, setAudioTarget, setTafsirTarget } = useAppStore();
  const [status, setStatus] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [activeTab, setActiveTab] = useState('Recitation');
  const [translation, setTranslation] = useState('');
  const [showColors, setShowColors] = useState(false);
  const [selectedColor, setSelectedColor] = useState('amber');

  useEffect(() => {
    let mounted = true;

    if (!line?.surahNumber || !line?.ayahStart) {
      setTranslation('');
      return () => {
        mounted = false;
      };
    }

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

  async function addTaggedBookmark(category = activeTab) {
    await db.bookmarks.add({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      category,
      note: '',
      preview: line.text,
      createdAt: Date.now(),
    });

    setStatus(`${category} bookmark saved`);
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

  async function addMemorize() {
    await db.memorizationProgress.add({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      status: 'memorize',
      preview: line.text,
      updatedAt: Date.now(),
    });

    setStatus('Added to memorization');
  }

  async function copyAyah() {
    try {
      await navigator.clipboard?.writeText(shareText);
      setStatus('Copied');
    } catch {
      setStatus('Copy is not available in this browser');
    }
  }

  async function createDesignPreview() {
    const image = await generateAyahImage({
      reference,
      text: line.text,
    });

    setPreviewImage(image);
    setStatus('Design preview created');
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

    goPage(page);
    setView('audio');
    onClose();
  }

  function openFullTafsir() {
    setTafsirTarget({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: line.ayahStart,
      reference,
      arabic: line.text,
    });

    onClose();
  }

  const tabs = [
    { label: 'Recitation', color: 'emerald' },
    { label: 'Memorize', color: 'amber' },
    { label: 'Tadabbur', color: 'rose' },
  ];

  return (
    <div className="ayah-action-backdrop" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 1 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 38,
          mass: 0.9,
        }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="ayah-action-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" />

        <div className="ayah-tab-row">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              className={`ayah-tab-pill ayah-tab-${tab.color} ${activeTab === tab.label ? 'ayah-tab-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.label);

                if (tab.label === 'Memorize') {
                  addMemorize();
                } else {
                  addTaggedBookmark(tab.label);
                }
              }}
            >
              <Bookmark size={23} strokeWidth={1.8} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ayah-main-action-row">
          <button className="ayah-round-action gradient" onClick={createDesignPreview} aria-label="Design preview">
            <span className="gradient-check">⌃</span>
          </button>

          <button className="ayah-round-action active" onClick={() => addTaggedBookmark(activeTab)} aria-label="Bookmark">
            <Bookmark size={31} strokeWidth={1.8} />
          </button>

          <button className="ayah-round-action" onClick={playAyah} aria-label="Play">
            <Play size={29} strokeWidth={1.8} />
          </button>

          <button className="ayah-round-action" onClick={shareAyah} aria-label="Share">
            <Share2 size={29} strokeWidth={1.8} />
          </button>

          <button className="ayah-round-action" onClick={copyAyah} aria-label="Copy">
            <Copy size={29} strokeWidth={1.8} />
          </button>
        </div>

        <div className="ayah-highlight-panel">
          <button className="ayah-highlight-toggle" onClick={() => setShowColors((value) => !value)}>
            <Palette size={22} />
            Highlight color
            <span className={`highlight-dot highlight-${selectedColor}`} />
          </button>

          {showColors && (
            <div className="highlight-color-row">
              {colorOptions.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => addHighlight(id)}
                  className={`highlight-color-button highlight-${id}`}
                  aria-label={`${label} highlight`}
                >
                  {selectedColor === id && <Check size={18} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="ayah-tafsir-block">
          <div className="flex items-center justify-between gap-3">
            <h3>Translation / Tafsir</h3>
            <span className="ayah-ref-pill">{reference}</span>
          </div>

          <p dir={translation ? 'rtl' : 'ltr'}>{tafsirText}</p>

          <button onClick={openFullTafsir}>Read more</button>
        </section>

        {status && <p className="ayah-action-status">{status}</p>}

        {previewImage && (
          <div className="share-preview-panel">
            <div className="share-preview-header">
              <span>Design preview</span>
              <button onClick={() => setPreviewImage(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="share-color-dots" aria-hidden="true">
              {['#dfa9ce', '#acd9ba', '#e5aaaa', '#dedb82', '#b8c5d1', '#c0afd9', '#b2d8b8'].map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </div>

            <img src={previewImage} alt="Share design preview" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
