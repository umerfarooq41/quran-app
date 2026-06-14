import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bookmark, Check, Copy, Menu, Palette, Play, Search, Settings, Share2, Undo2, X } from 'lucide-react';
import { db, saveLastRead } from '../lib/db';
import { findPageForReference, getMushafPageNumber, getPage, getPageMeta, getSurah, totalPages } from '../lib/quran';
import { getUrduTranslation } from '../lib/translations';
import { generateAyahImage } from '../lib/shareCanvas';
import { useAppStore } from '../store/useAppStore';
import { basmallahText, getDisplayLineText, getHizbLabel } from '../utils/quranLabels';

export default function ReaderScreen() {
  const { page, goPage, controlsVisible, toggleControls, settings, setView, selectedLine, setSelectedLine, pendingAyah, clearPendingAyah } = useAppStore();
  const pageData = getPage(page);
  const meta = getPageMeta(page);
  const displayPage = getMushafPageNumber(page);
  const touchStart = useRef(null);
  const [markedRefs, setMarkedRefs] = useState(new Set());

  useEffect(() => {
    let mounted = true;

    Promise.all([
      db.bookmarks.toArray(),
      db.highlights.toArray(),
      db.memorizationProgress.toArray(),
    ]).then(([bookmarks, highlights, progress]) => {
      if (!mounted) return;

      const next = new Set();
      [...bookmarks, ...highlights, ...progress].forEach((item) => {
        if (item?.surahNumber && item?.ayahNumber) {
          next.add(`${item.surahNumber}:${item.ayahNumber}`);
        }
      });

      setMarkedRefs(next);
    });

    return () => {
      mounted = false;
    };
  }, [page, selectedLine]);

  useEffect(() => {
    const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
    saveLastRead({
      page,
      surahNumber: first?.surahNumber,
      ayahNumber: first?.ayahStart,
    });
  }, [page, pageData.lines]);

  function handleTouchEnd(event) {
    if (!touchStart.current) return;

    const delta = event.changedTouches[0].clientX - touchStart.current;

    if (Math.abs(delta) > 70) {
      goPage(delta > 0 ? page + 1 : page - 1);
    }

    touchStart.current = null;
  }

  useEffect(() => {
    if (!pendingAyah) return undefined;

    const timer = window.setTimeout(() => clearPendingAyah(), 2200);

    return () => window.clearTimeout(timer);
  }, [pendingAyah?.surahNumber, pendingAyah?.ayahNumber, clearPendingAyah]);

  return (
    <section
      className="fixed inset-0 overflow-hidden bg-reader text-slate-950"
      onClick={toggleControls}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="reader-shell relative mx-auto flex h-dvh max-w-[576px] flex-col overflow-hidden bg-[#fffaf1] text-[#13100a] shadow-2xl shadow-slate-900/10">
        <div className="reader-passive-header pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8">
          <span>{meta.surah.name}</span>
          <span>{displayPage}</span>
        </div>

        <header
          className={`reader-topbar ${controlsVisible ? 'reader-topbar-visible' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="reader-control-row">
            <button
              className="reader-back-pill"
              onClick={() => setView('home', 'back')}
              aria-label="Back to home"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="reader-top-actions">
              <button
                className="reader-top-icon"
                onClick={() => addBookmark(pageData)}
                aria-label="Bookmark"
              >
                <Bookmark size={30} strokeWidth={1.7} />
              </button>

              <button
                className="reader-top-icon"
                onClick={() => setView('index')}
                aria-label="Index"
              >
                <Menu size={32} strokeWidth={1.7} />
              </button>

              <button
                className="reader-top-icon"
                onClick={() => setView('settings')}
                aria-label="Settings"
              >
                <Settings size={30} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        </header>

        <div
          className="reader-page grid flex-1 grid-rows-16 overflow-hidden px-4"
          style={{ '--font-scale': settings.fontScale }}
        >
          {pageData.lines.map((line, index) => {
            const nextLine = pageData.lines[index + 1];
            const hasSeparateBasmallah = nextLine?.type === 'basmallah' || nextLine?.type === 'bismillah';

            return (
              <QuranLine
                key={line.line}
                line={line}
                hasSeparateBasmallah={hasSeparateBasmallah}
                onSelect={() => setSelectedLine(line)}
                marked={line.ayahStart ? markedRefs.has(`${line.surahNumber}:${line.ayahStart}`) : false}
                jumped={Boolean(
                  pendingAyah &&
                    line.surahNumber === pendingAyah.surahNumber &&
                    line.ayahStart <= pendingAyah.ayahNumber &&
                    (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
                )}
              />
            );
          })}
        </div>

        <div className="reader-footer-meta pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-between px-8">
          <span>{displayPage}</span>
          <span>{getHizbLabel(page)}</span>
        </div>
      </div>

      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            className="reader-bottom-controls"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="reader-listen-pill"
              onClick={() => setView('audio')}
            >
              <span className="reader-listen-play">
                <Play size={26} fill="currentColor" />
              </span>
              <span>Listen to the Holy Qur&apos;an</span>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 42 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 42 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 340, damping: 32 }}
              className="reader-bottom-sheet"
            >
              <div className="reader-bottom-meta">
                <span>{displayPage}</span>
                <span>{getHizbLabel(page)}</span>
              </div>

              <PageSlider page={page} goPage={goPage} />

              <div className="reader-bottom-actions">
                <button onClick={() => setView('home', 'back')} aria-label="Return">
                  <Undo2 size={34} strokeWidth={1.8} />
                </button>

                <span>{displayPage}</span>

                <button onClick={() => setView('search')} aria-label="Search">
                  <Search size={34} strokeWidth={1.8} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LineActions line={selectedLine} onClose={() => setSelectedLine(null)} />
    </section>
  );
}

function QuranLine({ line, onSelect, marked = false, jumped = false, hasSeparateBasmallah = false }) {
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
  const [fitScale, setFitScale] = useState(1);

  const isBasmallah = line.type === 'basmallah' || line.type === 'bismillah';
  const centered = line.isCentered || line.type === 'surah_name' || isBasmallah;
  const text = getDisplayLineText(line);
  const inlineBasmallah = line.type === 'surah_name' && line.surahNumber !== 1 && line.surahNumber !== 9 && !hasSeparateBasmallah;

  useLayoutEffect(() => {
    const measure = () => {
      if (
        !lineRef.current ||
        !textRef.current ||
        centered ||
        line.type === 'spacer' ||
        line.type === 'surah_name' ||
        isBasmallah
      ) {
        setFitScale(1);
        return;
      }

      textRef.current.style.transform = 'scaleX(1)';

      const available = lineRef.current.clientWidth;
      const actual = textRef.current.scrollWidth;

      if (!available || !actual) return;

      const nextScale = Math.max(0.55, Math.min(1, available / actual));
      setFitScale(Number(nextScale.toFixed(3)));
    };

    measure();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;

    if (resizeObserver && lineRef.current) {
      resizeObserver.observe(lineRef.current);
    }

    window.addEventListener('resize', measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text, centered, line.type, isBasmallah]);

  function startLongPress() {
    if (line.type === 'spacer') return;

    longPressed.current = false;
    window.clearTimeout(longPressTimer.current);

    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;

      if (navigator.vibrate) {
        navigator.vibrate([24]);
      }

      onSelect();
    }, 430);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
  }

  return (
    <button
      ref={lineRef}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={(event) => {
        event.stopPropagation();

        if (longPressed.current) {
          longPressed.current = false;
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();

        if (line.type !== 'spacer') {
          onSelect();
        }
      }}
      className={`quran-line quran-line-${isBasmallah ? 'basmallah' : line.type} ${marked ? 'quran-line-marked' : ''} ${jumped ? 'quran-line-jumped' : ''} ${line.type === 'spacer' ? 'opacity-0' : ''} ${centered ? 'justify-center text-center' : 'justify-end text-right'} overflow-hidden`}
      aria-label={line.type === 'spacer' ? 'Blank line' : text}
      tabIndex={line.type === 'spacer' ? -1 : 0}
    >
      {line.type === 'surah_name' ? (
        <SurahHeader line={line} inlineBasmallah={inlineBasmallah} />
      ) : (
        <span
          ref={textRef}
          className="quran-line-text"
          style={{
            transform: `scaleX(${fitScale})`,
            transformOrigin: 'center center',
            maxWidth: '100%',
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      )}
    </button>
  );
}

function SurahHeader({ line, inlineBasmallah }) {
  const surah = getSurah(line.surahNumber);

  return (
    <div className={`surah-banner ${inlineBasmallah ? 'surah-banner-inline' : ''}`}>
      <span className="surah-banner-ayahs">آياتها {surah?.verses}</span>
      {inlineBasmallah && <span className="surah-banner-basmallah">{basmallahText}</span>}
      <span className="surah-banner-name">{getDisplayLineText(line)}</span>
    </div>
  );
}

function PageSlider({ page, goPage }) {
  const bars = Array.from({ length: 33 }, (_, index) => {
    const center = 16;
    const distance = Math.abs(index - center);
    const height = Math.max(9, 35 - distance * 1.35);
    const opacity = Math.max(0.18, 1 - distance * 0.045);

    return { height, opacity };
  });

  return (
    <div className="reader-wave-slider">
      <div className="reader-wave-bars" aria-hidden="true">
        {bars.map((bar, index) => (
          <span
            key={index}
            style={{
              height: `${bar.height}px`,
              opacity: bar.opacity,
            }}
          />
        ))}
      </div>

      <div className="reader-wave-marker" aria-hidden="true" />

      <input
        aria-label="Page"
        type="range"
        min="1"
        max={totalPages}
        value={page}
        onChange={(e) => goPage(Number(e.target.value))}
      />
    </div>
  );
}

function LineActions({ line, onClose }) {
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
        onClick={(e) => e.stopPropagation()}
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

async function addBookmark(pageData) {
  const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);

  if (!first) return;

  await db.bookmarks.add({
    page: pageData.page,
    surahNumber: first.surahNumber,
    ayahNumber: first.ayahStart,
    category: 'Reading',
    note: '',
    preview: first.text,
    createdAt: Date.now(),
  });
}