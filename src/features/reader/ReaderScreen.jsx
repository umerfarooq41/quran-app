import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { db } from '../../lib/db';
import { getCurrentIndoPakJuzProgress } from '../../data/indoPakParaQuarters';
import { getMushafPageNumber, getPage, getPageMeta, getSurahAyahs } from '../../lib/quran';
import { OVERLAY_TYPES, useAppStore } from '../../store/useAppStore';
import { AyahActionSheet } from './components/AyahActionSheet';
import { MushafPage } from './components/MushafPage';
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
    audioPlayerActive,
    openAudioPlayer,
    pendingAyah,
    pendingQuarterFlash,
    clearPendingAyah,
    clearPendingQuarterFlash,
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    goPage: state.goPage,
    goPreviousReaderPage: state.goPreviousReaderPage,
    controlsVisible: state.controlsVisible,
    toggleControls: state.toggleControls,
    setControlsVisible: state.setControlsVisible,
    settings: state.settings,
    goBack: state.goBack,
    openBookmarks: state.openBookmarks,
    openIndex: state.openIndex,
    openSearch: state.openSearch,
    openSettings: state.openSettings,
    overlayStack: state.overlayStack,
    selectedAyah: state.selectedAyah,
    openAyahSheet: state.openAyahSheet,
    closeAyahSheet: state.closeAyahSheet,
    shareTarget: state.shareTarget,
    openShareSheet: state.openShareSheet,
    closeShareSheet: state.closeShareSheet,
    audioTarget: state.audioTarget,
    audioPlayerActive: state.audioPlayerActive,
    openAudioPlayer: state.openAudioPlayer,
    pendingAyah: state.pendingAyah,
    pendingQuarterFlash: state.pendingQuarterFlash,
    clearPendingAyah: state.clearPendingAyah,
    clearPendingQuarterFlash: state.clearPendingQuarterFlash,
  })));
  const pageData = getPage(page);
  const meta = getPageMeta(page);
  const displayPage = getMushafPageNumber(page);
  const firstPageAyah = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
  const footerTarget = getFooterTarget({
    page,
    firstPageAyah,
    pendingAyah,
    pendingQuarterFlash,
    selectedAyah,
    audioTarget,
  });
  const juzProgress = getCurrentIndoPakJuzProgress(
    page,
    footerTarget?.surahNumber,
    footerTarget?.ayahNumber,
    meta.juz,
  );
  const [savedHighlights, setSavedHighlights] = useState(new Map());
  const [bookmarkMarkers, setBookmarkMarkers] = useState(new Map());
  const [annotationVersion, setAnnotationVersion] = useState(0);
  const [quarterFlashTarget, setQuarterFlashTarget] = useState(null);
  const suppressTapUntil = useRef(0);
  const previousAudioTargetKey = useRef(
    audioTarget ? `${audioTarget.surahNumber}:${audioTarget.ayahNumber}` : '',
  );
  const { handleTouchStart, handleTouchEnd } = useReaderGestures({ page, goPage });
  const topOverlay = overlayStack.at(-1)?.type;

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
          nextHighlights.set(`${item.surahNumber}:${item.ayahNumber}`, item);
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

  useEffect(() => {
    if (!pendingQuarterFlash || Number(pendingQuarterFlash.targetPage) !== page) {
      setQuarterFlashTarget(null);
      return undefined;
    }

    let flashTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      if (!pageData?.lines?.length) return;

      setQuarterFlashTarget({
        page,
        line: pendingQuarterFlash.flashMode === 'first-rendered-line'
          ? pageData.lines[0].line
          : null,
        surahNumber: pendingQuarterFlash.targetSurah,
        ayahNumber: pendingQuarterFlash.targetAyah,
        flashMode: pendingQuarterFlash.flashMode,
      });
      const flashDuration = pendingQuarterFlash.flashMode === 'ayah-marker'
        ? 1400
        : 1800;
      flashTimer = window.setTimeout(() => {
        setQuarterFlashTarget(null);
        clearPendingQuarterFlash();
      }, flashDuration);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(flashTimer);
    };
  }, [
    page,
    pageData,
    pendingQuarterFlash,
    clearPendingQuarterFlash,
  ]);

  useEffect(() => {
    const nextKey = audioTarget
      ? `${audioTarget.surahNumber}:${audioTarget.ayahNumber}`
      : '';
    const targetChanged = nextKey && nextKey !== previousAudioTargetKey.current;
    previousAudioTargetKey.current = nextKey;

    if (targetChanged && audioPlayerActive && audioTarget?.page && audioTarget.page !== page) {
      const keepControlsVisible = controlsVisible;
      goPage(audioTarget.page);
      if (keepControlsVisible) setControlsVisible(true);
    }
  }, [audioTarget?.surahNumber, audioTarget?.ayahNumber]);

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

    openAudioPlayer(target);
  }

  function annotationsChanged() {
    setAnnotationVersion((version) => version + 1);
  }

  function showShareSheet(targetAyah) {
    pushShareSheet(targetAyah);
  }

  function selectAyah(line, lineIndex, selection) {
    const ayahNumber = Number(selection?.ayahNumber || line.ayahStart);
    const wordIndex = Number.isInteger(selection?.wordIndex)
      ? selection.wordIndex
      : null;
    const ayah = getSurahAyahs(line.surahNumber)
      .find((candidate) => candidate.ayahNumber === ayahNumber);
    const ayahKey = `${line.surahNumber}:${ayahNumber}`;

    suppressTapUntil.current = Date.now() + 700;
    openAyahSheet({
      page,
      surah: line.surahNumber,
      ayah: ayahNumber,
      surahNumber: line.surahNumber,
      ayahNumber,
      lineIndex,
      wordIndex,
      ayahKey,
      reference: ayahKey,
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
          quarterFlashTarget={quarterFlashTarget}
          selectedAyah={selectedAyah}
          activeAudioAyah={audioPlayerActive ? audioTarget : null}
          onSelectAyah={selectAyah}
        />

        <ReaderFooterMeta displayPage={displayPage} progress={juzProgress} />
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
            compact={audioPlayerActive}
            juzProgress={juzProgress}
          />
        )}
      </AnimatePresence>

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

function getFooterTarget({
  page,
  firstPageAyah,
  pendingAyah,
  pendingQuarterFlash,
  selectedAyah,
  audioTarget,
}) {
  if (pendingAyah?.surahNumber && pendingAyah?.ayahNumber) return pendingAyah;
  if (Number(pendingQuarterFlash?.targetPage) === page) {
    return {
      surahNumber: pendingQuarterFlash.targetSurah,
      ayahNumber: pendingQuarterFlash.targetAyah,
    };
  }
  if (selectedAyah?.page === page) return selectedAyah;
  if (audioTarget?.page === page) return audioTarget;
  return firstPageAyah;
}
