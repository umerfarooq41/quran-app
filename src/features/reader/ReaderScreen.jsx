import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { db } from '../../lib/db';
import { getMushafPageNumber, getPage, getPageMeta } from '../../lib/quran';
import { useAppStore } from '../../store/useAppStore';
import { AyahActionSheet } from './components/AyahActionSheet';
import { MushafPage } from './components/MushafPage';
import { ReaderAudioPanel } from './components/ReaderAudioPanel';
import { ReaderBottomControls } from './components/ReaderBottomControls';
import { ReaderFooterMeta, ReaderPassiveHeader } from './components/ReaderPassiveMeta';
import { ReaderTopControls } from './components/ReaderTopControls';
import { usePagePersistence } from './hooks/usePagePersistence';
import { useReaderGestures } from './hooks/useReaderGestures';

export default function ReaderScreen() {
  const {
    page,
    goPage,
    controlsVisible,
    toggleControls,
    setControlsVisible,
    settings,
    updateSettings,
    setView,
    selectedLine,
    setSelectedLine,
    pendingAyah,
    clearPendingAyah,
  } = useAppStore();
  const pageData = getPage(page);
  const meta = getPageMeta(page);
  const displayPage = getMushafPageNumber(page);
  const [markedRefs, setMarkedRefs] = useState(new Set());
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const [audioAyah, setAudioAyah] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAudioAyah, setActiveAudioAyah] = useState(null);
  const { handleTouchStart, handleTouchEnd } = useReaderGestures({ page, goPage });

  usePagePersistence({ page, pageData });

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

    setAudioAyah(target);
    setActiveAudioAyah(target);
    setSelectedLine(null);
    setAudioPanelOpen(true);
    setIsPlaying(true);
    setControlsVisible(true);
  }

  function closeAudioPanel() {
    setAudioPanelOpen(false);
    setIsPlaying(false);
    setActiveAudioAyah(null);
  }

  return (
    <section
      className="fixed inset-0 overflow-hidden bg-reader text-slate-950"
      onClick={toggleControls}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="reader-shell relative mx-auto flex h-dvh max-w-[576px] flex-col overflow-hidden bg-[#fffaf1] text-[#13100a] shadow-2xl shadow-slate-900/10">
        <ReaderPassiveHeader meta={meta} displayPage={displayPage} />

        <ReaderTopControls
          visible={controlsVisible || audioPanelOpen}
          onBack={() => setView('home', 'back')}
          onBookmark={() => addBookmark(pageData)}
          onIndex={() => setView('index')}
          onSettings={() => setView('settings')}
        />

        <MushafPage
          pageData={pageData}
          settings={settings}
          markedRefs={markedRefs}
          pendingAyah={pendingAyah}
          activeAudioAyah={activeAudioAyah}
          onSelectLine={setSelectedLine}
        />

        <ReaderFooterMeta page={page} displayPage={displayPage} />
      </div>

      <AnimatePresence>
        {(controlsVisible || audioPanelOpen) && (
          <ReaderBottomControls
            page={page}
            displayPage={displayPage}
            goPage={goPage}
            onHome={() => setView('home', 'back')}
            onSearch={() => setView('search')}
            onAudio={() => openAudioPanel()}
            compact={audioPanelOpen}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioPanelOpen && (
          <ReaderAudioPanel
            ayah={audioAyah}
            settings={settings}
            updateSettings={updateSettings}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onClose={closeAudioPanel}
            onActiveAyahChange={setActiveAudioAyah}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLine && (
          <AyahActionSheet
            line={selectedLine}
            onClose={() => setSelectedLine(null)}
            onPlay={openAudioPanel}
          />
        )}
      </AnimatePresence>
    </section>
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
