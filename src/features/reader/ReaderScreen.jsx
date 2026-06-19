import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { db } from '../../lib/db';
import { getMushafPageNumber, getPage, getPageMeta, getSurahAyahs } from '../../lib/quran';
import { OVERLAY_TYPES, useAppStore } from '../../store/useAppStore';
import { AyahActionSheet } from './components/AyahActionSheet';
import { MushafPage } from './components/MushafPage';
import { ReaderAudioPanel } from './components/ReaderAudioPanel';
import { ReaderBottomControls } from './components/ReaderBottomControls';
import { ReaderFooterMeta, ReaderPassiveHeader } from './components/ReaderPassiveMeta';
import { ReaderTopControls } from './components/ReaderTopControls';
import { ShareAyahSheet } from './components/ShareAyahSheet';
import { usePagePersistence } from './hooks/usePagePersistence';
import { useReaderGestures } from './hooks/useReaderGestures';

export default function ReaderScreen() {
  const {
    page,
    goPage,
    goPreviousReaderPage,
    controlsVisible,
    toggleControls,
    setControlsVisible,
    settings,
    updateSettings,
    goBack,
    openBookmarks,
    openIndex,
    openSearch,
    openSettings,
    overlayStack,
    selectedAyah,
    openAyahSheet,
    closeAyahSheet,
    shareTarget,
    openShareSheet: pushShareSheet,
    closeShareSheet,
    audioTarget,
    setAudioTarget,
    openAudioPlayer,
    closeAudioPlayer,
    pendingAyah,
    clearPendingAyah,
  } = useAppStore();
  const pageData = getPage(page);
  const meta = getPageMeta(page);
  const displayPage = getMushafPageNumber(page);
  const [savedHighlights, setSavedHighlights] = useState(new Map());
  const [bookmarkMarkers, setBookmarkMarkers] = useState(new Map());
  const [annotationVersion, setAnnotationVersion] = useState(0);
  const [activeAudioAyah, setActiveAudioAyah] = useState(null);
  const suppressTapUntil = useRef(0);
  const { handleTouchStart, handleTouchEnd } = useReaderGestures({ page, goPage });
  const topOverlay = overlayStack.at(-1)?.type;
  const audioSessionOpen = overlayStack.some((item) => item.type === OVERLAY_TYPES.AUDIO);

  usePagePersistence({ page, pageData });

  useEffect(() => {
    let mounted = true;

    Promise.all([
      db.bookmarks.toArray(),
      db.highlights.toArray(),
    ]).then(([bookmarks, highlights]) => {
      if (!mounted) return;

      const nextHighlights = new Map();
      highlights.forEach((item) => {
        if (item?.surahNumber && item?.ayahNumber && item?.color) {
          nextHighlights.set(`${item.surahNumber}:${item.ayahNumber}`, item.color);
        }
      });

      const nextBookmarks = new Map();
      [...bookmarks]
        .sort((a, b) => (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0))
        .forEach((item) => {
          if (item?.surahNumber && item?.ayahNumber && item?.category) {
            nextBookmarks.set(`${item.surahNumber}:${item.ayahNumber}`, item.category);
          }
        });

      setSavedHighlights(nextHighlights);
      setBookmarkMarkers(nextBookmarks);
    });

    return () => {
      mounted = false;
    };
  }, [page, annotationVersion]);

  useEffect(() => {
    if (!pendingAyah) return undefined;

    const timer = window.setTimeout(() => clearPendingAyah(), 2200);

    return () => window.clearTimeout(timer);
  }, [pendingAyah?.surahNumber, pendingAyah?.ayahNumber, clearPendingAyah]);

  function openAudioPanel(targetLine = null) {
    const firstLine = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
    const target = targetLine || (firstLine ? {
      page,
      surahNumber: firstLine.surahNumber,
      ayahNumber: firstLine.ayahStart,
      reference: `${firstLine.surahNumber}:${firstLine.ayahStart}`,
      arabic: firstLine.text,
    } : null);

    if (!target) return;

    setActiveAudioAyah(target);
    openAudioPlayer(target);
  }

  function closeAudioPanel() {
    closeAudioPlayer();
    setActiveAudioAyah(null);
  }

  function changeAudioAyah(target) {
    if (!target) return;

    const keepControlsVisible = controlsVisible;
    setAudioTarget(target);
    setActiveAudioAyah(target);

    if (target.page && target.page !== page) {
      goPage(target.page);
      if (keepControlsVisible) setControlsVisible(true);
    }
  }

  function annotationsChanged() {
    setAnnotationVersion((version) => version + 1);
  }

  function showShareSheet(targetAyah) {
    pushShareSheet(targetAyah);
  }

  function selectAyah(line, ayahNumber) {
    const ayah = getSurahAyahs(line.surahNumber)
      .find((candidate) => candidate.ayahNumber === Number(ayahNumber));

    suppressTapUntil.current = Date.now() + 700;
    openAyahSheet({
      page,
      surahNumber: line.surahNumber,
      ayahNumber: Number(ayahNumber),
      reference: `${line.surahNumber}:${ayahNumber}`,
      text: ayah?.text || line.text,
    });
  }

  function handleReaderTap(event) {
    if (Date.now() < suppressTapUntil.current) return;
    if (event.target.closest('[data-reader-ui]')) return;
    toggleControls();
  }

  return (
    <section
      className="fixed inset-0 overflow-hidden bg-reader text-slate-950"
      onClick={handleReaderTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="reader-shell relative mx-auto flex h-dvh max-w-[576px] flex-col overflow-hidden bg-[#fffaf1] text-[#13100a] shadow-2xl shadow-slate-900/10">
        <ReaderPassiveHeader meta={meta} displayPage={displayPage} />

        <ReaderTopControls
          visible={controlsVisible}
          onBack={() => goBack()}
          onBookmarks={openBookmarks}
          onIndex={openIndex}
          onSettings={openSettings}
        />

        <MushafPage
          pageData={pageData}
          settings={settings}
          savedHighlights={savedHighlights}
          bookmarkMarkers={bookmarkMarkers}
          pendingAyah={pendingAyah}
          selectedAyah={selectedAyah}
          activeAudioAyah={activeAudioAyah}
          onSelectAyah={selectAyah}
        />

        <ReaderFooterMeta page={page} displayPage={displayPage} />
      </div>

      <AnimatePresence>
        {controlsVisible && (
          <ReaderBottomControls
            page={page}
            displayPage={displayPage}
            goPage={goPage}
            onPreviousPage={goPreviousReaderPage}
            onSearch={openSearch}
            onAudio={() => openAudioPanel()}
            compact={audioSessionOpen}
          />
        )}
      </AnimatePresence>

      {audioSessionOpen && (
          <ReaderAudioPanel
            ayah={audioTarget}
            visible={controlsVisible && topOverlay === OVERLAY_TYPES.AUDIO}
            settings={settings}
            updateSettings={updateSettings}
            onClose={closeAudioPanel}
            onAyahChange={changeAudioAyah}
            onPlaybackStopped={() => setActiveAudioAyah(null)}
          />
      )}

      <AnimatePresence>
        {selectedAyah && topOverlay === OVERLAY_TYPES.AYAH && (
          <AyahActionSheet
            ayah={selectedAyah}
            onClose={closeAyahSheet}
            onPlay={openAudioPanel}
            onShare={showShareSheet}
            onAnnotationsChanged={annotationsChanged}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareTarget && topOverlay === OVERLAY_TYPES.SHARE && (
          <ShareAyahSheet
            ayah={shareTarget}
            onClose={closeShareSheet}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
