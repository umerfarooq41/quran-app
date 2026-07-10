import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { db } from '../../lib/db';
import { getCurrentIndoPakJuzProgress } from '../../data/indoPakParaQuarters';
import { clampPage, getMushafPageNumber, getPage, getPageMeta, getSurahAyahs } from '../../lib/quran';
import { OVERLAY_TYPES, useAppStore } from '../../store/useAppStore';
import { AyahActionSheet } from './components/AyahActionSheet';
import { AyahTranslationCard } from './components/AyahTranslationCard';
import { MushafPage } from './components/MushafPage';
import { ReaderBottomControls } from './components/ReaderBottomControls';
import { ReaderFooterMeta, ReaderPassiveHeader } from './components/ReaderPassiveMeta';
import { ReaderTopControls } from './components/ReaderTopControls';
import { ReaderLandscapeView } from './components/ReaderLandscapeView';
import { ShareAyahSheet } from './components/ShareAyahSheet';
import { usePagePersistence } from './hooks/usePagePersistence';
import { useReaderGestures } from './hooks/useReaderGestures';
import { useReaderLandscape } from './hooks/useReaderLandscape';

const PAGE_SLIDE_SETTLE_MS = 190;
const PAGE_SLIDE_IDLE = {
  active: false,
  settling: false,
  offset: 0,
  targetPage: null,
  direction: 0,
};

export default function ReaderScreen() {
  const {
    page,
    previousReaderPage,
    readerNavigationRevision,
    goPage,
    syncReaderPageFromScroll,
    goPreviousReaderPage,
    controlsVisible,
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
    audioPlayerVisible,
    openAudioPlayer,
    showAudioPlayer,
    hideAudioPlayer,
    pendingAyah,
    pendingQuarterFlash,
    clearPendingAyah,
    clearPendingQuarterFlash,
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    previousReaderPage: state.previousReaderPage,
    readerNavigationRevision: state.readerNavigationRevision,
    goPage: state.goPage,
    syncReaderPageFromScroll: state.syncReaderPageFromScroll,
    goPreviousReaderPage: state.goPreviousReaderPage,
    controlsVisible: state.controlsVisible,
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
    audioPlayerVisible: state.audioPlayerVisible,
    openAudioPlayer: state.openAudioPlayer,
    showAudioPlayer: state.showAudioPlayer,
    hideAudioPlayer: state.hideAudioPlayer,
    pendingAyah: state.pendingAyah,
    pendingQuarterFlash: state.pendingQuarterFlash,
    clearPendingAyah: state.clearPendingAyah,
    clearPendingQuarterFlash: state.clearPendingQuarterFlash,
  })));
  const isReaderLandscape = useReaderLandscape();

  useEffect(() => {
    document.documentElement.dataset.readerLandscape = isReaderLandscape ? 'true' : 'false';
    return () => {
      delete document.documentElement.dataset.readerLandscape;
    };
  }, [isReaderLandscape]);
  const [sliderPreviewPage, setSliderPreviewPage] = useState(null);
  const [sliderInteracting, setSliderInteracting] = useState(false);
  const [translationTarget, setTranslationTarget] = useState(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [pageSlide, setPageSlide] = useState(PAGE_SLIDE_IDLE);
  const [pageTransition, setPageTransition] = useState(null);
  const pageData = getPage(page);
  const meta = getPageMeta(page);
  const displayPage = getMushafPageNumber(page);
  const footerPage = sliderInteracting && sliderPreviewPage ? sliderPreviewPage : page;
  const footerPageData = footerPage === page ? pageData : getPage(footerPage);
  const footerMeta = footerPage === page ? meta : getPageMeta(footerPage);
  const footerDisplayPage = getMushafPageNumber(footerPage);
  const firstPageAyah = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
  const firstFooterAyah = footerPageData.lines.find((line) => line.surahNumber && line.ayahStart);
  const footerTarget = getFooterTarget({
    page: footerPage,
    firstPageAyah: firstFooterAyah,
    pendingAyah,
    pendingQuarterFlash,
    selectedAyah,
    audioTarget,
  });
  const juzProgress = getCurrentIndoPakJuzProgress(
    footerPage,
    footerTarget?.surahNumber,
    footerTarget?.ayahNumber,
    footerMeta.juz,
  );
  const [savedHighlights, setSavedHighlights] = useState(new Map());
  const [bookmarkMarkers, setBookmarkMarkers] = useState(new Map());
  const [annotationVersion, setAnnotationVersion] = useState(0);
  const [quarterFlashTarget, setQuarterFlashTarget] = useState(null);
  const suppressTapUntil = useRef(0);
  const suppressAyahInteractionUntil = useRef(0);
  const copyToastTimer = useRef(0);
  const readerShellRef = useRef(null);
  const pageSlideTimer = useRef(0);
  const pageTransitionTimer = useRef(0);
  const previousAudioTargetKey = useRef(
    audioTarget ? `${audioTarget.surahNumber}:${audioTarget.ayahNumber}` : '',
  );
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handlePointerDown,
  } = useReaderGestures({
    page,
    goPage: (targetPage) => goReaderPage(targetPage, null, { skipSlideTransition: true }),
    onSlideMove: handlePageSlideMove,
    onSlideEnd: handlePageSlideEnd,
    onSlideCancel: cancelPageSlide,
  });
  const topOverlay = overlayStack.at(-1)?.type;
  const ayahTooltipVisible = Boolean(selectedAyah && topOverlay === OVERLAY_TYPES.AYAH);
  const shareSheetVisible = Boolean(shareTarget && topOverlay === OVERLAY_TYPES.SHARE);
  const readerInteractionsBlocked = Boolean(
    controlsVisible ||
      audioPlayerVisible ||
      (!isReaderLandscape && translationTarget) ||
      ayahTooltipVisible ||
      shareSheetVisible
  );
  const activeSlideTargetPage = pageSlide.targetPage && pageSlide.targetPage !== page
    ? pageSlide.targetPage
    : null;
  const activeSlideTargetPageData = activeSlideTargetPage ? getPage(activeSlideTargetPage) : null;
  const pageSlideActive = pageSlide.active || pageSlide.settling;
  const pageTransitionActive = Boolean(pageTransition && pageTransition.page !== page);

  useEffect(() => {
    if (!sliderInteracting) setSliderPreviewPage(null);
  }, [page, sliderInteracting]);

  useEffect(() => () => {
    window.clearTimeout(copyToastTimer.current);
    window.clearTimeout(pageSlideTimer.current);
    window.clearTimeout(pageTransitionTimer.current);
  }, []);

  useEffect(() => {
    if (isReaderLandscape) return;
    window.clearTimeout(pageSlideTimer.current);
    setPageSlide(PAGE_SLIDE_IDLE);
  }, [page, isReaderLandscape]);

  usePagePersistence({ page, pageData, debounceMs: isReaderLandscape ? 320 : 0 });

  useEffect(() => {
    if (isReaderLandscape) return undefined;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (isReaderKeyboardEventFromUi(event)) return;
      if (pageSlideBlocked()) return;

      event.preventDefault();
      goReaderPage(event.key === 'ArrowLeft' ? page + 1 : page - 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    page,
    translationTarget,
    ayahTooltipVisible,
    shareSheetVisible,
    audioPlayerVisible,
    isReaderLandscape,
  ]);

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
  }, [annotationVersion]);

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
      goReaderPage(audioTarget.page);
      if (keepControlsVisible) setControlsVisible(true);
    }
  }, [audioTarget?.surahNumber, audioTarget?.ayahNumber]);

  function getPageSlideWidth() {
    return readerShellRef.current?.getBoundingClientRect().width || window.innerWidth || 390;
  }

  function startPageTransition(nextPage) {
    const safeNextPage = clampPage(nextPage);
    if (safeNextPage === page) return;

    window.clearTimeout(pageTransitionTimer.current);
    setPageSlide(PAGE_SLIDE_IDLE);
    setPageTransition({
      page,
      pageData,
      direction: safeNextPage > page ? 1 : -1,
    });
    pageTransitionTimer.current = window.setTimeout(() => {
      setPageTransition(null);
    }, PAGE_SLIDE_SETTLE_MS + 40);
  }

  function goReaderPage(nextPage, pendingAyah = null, options = {}) {
    const safeNextPage = clampPage(nextPage);
    const { skipSlideTransition, ...goPageOptions } = options || {};

    if (!skipSlideTransition && !isReaderLandscape) {
      startPageTransition(safeNextPage);
    }

    goPage(safeNextPage, pendingAyah, goPageOptions);
  }

  function goPreviousReaderPageWithSlide() {
    if (!isReaderLandscape && previousReaderPage && previousReaderPage !== page) {
      startPageTransition(previousReaderPage);
    }

    goPreviousReaderPage();
  }

  function pageSlideBlocked() {
    return Boolean(translationTarget || ayahTooltipVisible || shareSheetVisible || audioPlayerVisible);
  }

  function handlePageSlideMove(deltaX) {
    if (pageSlideBlocked()) {
      cancelPageSlide();
      return;
    }

    const width = getPageSlideWidth();
    const direction = deltaX >= 0 ? 1 : -1;
    const targetPage = clampPage(page + direction);
    const boundedOffset = Math.max(-width, Math.min(width, deltaX));
    const offset = targetPage === page ? boundedOffset * 0.28 : boundedOffset;

    window.clearTimeout(pageTransitionTimer.current);
    setPageTransition(null);
    setPageSlide({
      active: true,
      settling: false,
      offset,
      targetPage: targetPage === page ? null : targetPage,
      direction,
    });
  }

  function handlePageSlideEnd({ deltaX, committed }) {
    suppressTapUntil.current = Date.now() + 450;

    const width = getPageSlideWidth();
    const direction = deltaX >= 0 ? 1 : -1;
    const targetPage = clampPage(page + direction);
    const canCommit = committed && targetPage !== page && !pageSlideBlocked();
    const settleOffset = canCommit ? direction * width : 0;

    window.clearTimeout(pageSlideTimer.current);
    setPageSlide((current) => ({
      active: true,
      settling: true,
      offset: settleOffset,
      targetPage: canCommit ? targetPage : current.targetPage,
      direction,
    }));

    pageSlideTimer.current = window.setTimeout(() => {
      if (canCommit) {
        goReaderPage(targetPage, null, { skipSlideTransition: true });
      }
      setPageSlide(PAGE_SLIDE_IDLE);
    }, PAGE_SLIDE_SETTLE_MS);

    return true;
  }

  function cancelPageSlide() {
    window.clearTimeout(pageSlideTimer.current);
    setPageSlide((current) => ({
      ...current,
      settling: true,
      offset: 0,
    }));
    pageSlideTimer.current = window.setTimeout(() => {
      setPageSlide(PAGE_SLIDE_IDLE);
    }, PAGE_SLIDE_SETTLE_MS);
  }

  function openAudioPanel(targetLine = null) {
    if (!targetLine && audioPlayerActive && !audioPlayerVisible) {
      showAudioPlayer();
      return;
    }

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

  function showCopyToast() {
    window.clearTimeout(copyToastTimer.current);
    setCopyToastVisible(true);
    copyToastTimer.current = window.setTimeout(() => {
      setCopyToastVisible(false);
    }, 1300);
  }

  function selectAyah(sourcePage, line, lineIndex, selection) {
    if (readerInteractionsBlocked || isAyahInteractionSuppressed()) {
      suppressTapUntil.current = Date.now() + 700;
      dismissVisibleReaderUi();
      return;
    }

    const ayahNumber = Number(selection?.ayahNumber || line.ayahStart);
    const wordIndex = Number.isInteger(selection?.wordIndex)
      ? selection.wordIndex
      : null;
    const ayah = getSurahAyahs(line.surahNumber)
      .find((candidate) => candidate.ayahNumber === ayahNumber);
    const ayahKey = `${line.surahNumber}:${ayahNumber}`;

    suppressTapUntil.current = Date.now() + 700;
    setTranslationTarget(null);
    openAyahSheet({
      page: sourcePage,
      surah: line.surahNumber,
      ayah: ayahNumber,
      surahNumber: line.surahNumber,
      ayahNumber,
      lineIndex,
      wordIndex,
      selectedWord: selection?.selectedWord || '',
      selectedWordId: selection?.selectedWordId || '',
      selectedWordRect: selection?.selectedWordRect || null,
      ayahRect: selection?.ayahRect || null,
      pointer: selection?.pointer || null,
      ayahKey,
      reference: ayahKey,
      text: ayah?.text || line.text,
    });
  }

  function openTranslationCard(sourcePage, line, lineIndex, selection) {
    if (line.type !== 'ayah' || !line.surahNumber || !line.ayahStart) return;
    if (readerInteractionsBlocked || isAyahInteractionSuppressed()) {
      dismissVisibleReaderUi();
      return;
    }

    const ayahNumber = Number(selection?.ayahNumber || line.ayahStart);
    setTranslationTarget({
      page: sourcePage,
      surahNumber: line.surahNumber,
      ayahNumber,
      lineIndex,
    });
  }

  function suppressAyahInteractions(duration = 700) {
    suppressAyahInteractionUntil.current = Date.now() + duration;
  }

  function isAyahInteractionSuppressed() {
    return Date.now() < suppressAyahInteractionUntil.current;
  }

  function dismissVisibleReaderUi() {
    suppressAyahInteractions();
    if (translationTarget) setTranslationTarget(null);
    if (ayahTooltipVisible) closeAyahSheet();
    if (shareSheetVisible) closeShareSheet();
    if (controlsVisible) setControlsVisible(false);
    if (audioPlayerVisible) hideAudioPlayer();
  }

  function hideReaderChrome() {
    setControlsVisible(false);
    hideAudioPlayer();
  }

  function showReaderChrome() {
    if (audioPlayerActive) {
      showAudioPlayer();
    } else {
      setControlsVisible(true);
    }
  }

  function toggleReaderChrome() {
    if (controlsVisible || audioPlayerVisible) {
      hideReaderChrome();
      return;
    }

    showReaderChrome();
  }

  function handleReaderPointerDownCapture(event) {
    if (event.target.closest('[data-reader-ui]')) return;
    if (readerInteractionsBlocked) suppressAyahInteractions();
  }

  function handleReaderTap(event) {
    if (Date.now() < suppressTapUntil.current) return;
    if (event.target.closest('[data-reader-ui]')) return;

    if (audioPlayerVisible) {
      hideAudioPlayer();
      return;
    }

    if (controlsVisible && event.target.closest('.reader-page')) {
      setControlsVisible(false);
      return;
    }

    if (event.target.closest('[data-reader-toggle-zone]')) {
      toggleReaderChrome();
      return;
    }

    if (event.target.closest('.reader-page')) {
      hideReaderChrome();
    }
  }

  function renderMushafPage(renderedPageData, { interactive = true, layoutMode = 'portrait' } = {}) {
    const renderedPage = renderedPageData.page;
    const activeAudioAyah = audioPlayerActive && audioTarget?.page === renderedPage
      ? audioTarget
      : null;

    return (
      <MushafPage
        pageData={renderedPageData}
        settings={settings}
        savedHighlights={savedHighlights}
        bookmarkMarkers={bookmarkMarkers}
        pendingAyah={interactive ? pendingAyah : null}
        quarterFlashTarget={interactive ? quarterFlashTarget : null}
        selectedAyah={interactive ? selectedAyah : null}
        activeAudioAyah={activeAudioAyah}
        interactionsBlocked={!interactive || readerInteractionsBlocked}
        enableTextHighlights={interactive}
        onBlockedInteraction={interactive ? dismissVisibleReaderUi : undefined}
        layoutMode={layoutMode}
        onSelectAyah={interactive ? (line, lineIndex, selection) => selectAyah(renderedPage, line, lineIndex, selection) : () => {}}
        onTapAyah={interactive ? (line, lineIndex, selection) => openTranslationCard(renderedPage, line, lineIndex, selection) : () => {}}
      />
    );
  }

  const pageSlideDirection = pageTransitionActive
    ? pageTransition.direction
    : pageSlide.direction;
  const pageSlideClasses = [
    'reader-page-slide-viewport',
    pageSlideActive ? 'is-dragging' : '',
    pageSlide.settling ? 'is-settling' : '',
    pageTransitionActive ? 'is-transitioning' : '',
    pageSlideDirection > 0 ? 'is-next' : '',
    pageSlideDirection < 0 ? 'is-previous' : '',
  ].filter(Boolean).join(' ');

  const portraitReader = (
    <>
      <div
        ref={readerShellRef}
        className={`reader-shell relative mx-auto flex h-dvh max-w-[576px] flex-col overflow-hidden bg-[#fffaf1] text-[#13100a] shadow-2xl shadow-slate-900/10 ${audioPlayerActive ? 'reader-shell-audio-active' : ''} ${audioPlayerActive && !audioPlayerVisible ? 'reader-shell-audio-collapsed' : ''}`}
      >
        <div className="reader-top-hit-zone" data-reader-toggle-zone aria-hidden="true" />
        <div className="reader-bottom-hit-zone" data-reader-toggle-zone aria-hidden="true" />
        <ReaderPassiveHeader meta={meta} displayPage={displayPage} />

        <ReaderTopControls
          visible={controlsVisible}
          onBack={() => goBack()}
          onBookmarks={openBookmarks}
          onIndex={openIndex}
          onSettings={openSettings}
          onChromeTap={hideReaderChrome}
        />

        <div
          className={pageSlideClasses}
          style={{ '--reader-page-slide-x': `${pageSlide.offset}px` }}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {pageTransitionActive && (
            <div className="reader-page-slide reader-page-slide-leaving" aria-hidden="true">
              {renderMushafPage(pageTransition.pageData, { interactive: false })}
            </div>
          )}

          <div className="reader-page-slide reader-page-slide-current">
            {renderMushafPage(pageData)}
          </div>

          {activeSlideTargetPageData && !pageTransitionActive && (
            <div
              className={`reader-page-slide reader-page-slide-adjacent ${pageSlide.direction > 0 ? 'is-next' : 'is-previous'}`}
              aria-hidden="true"
            >
              {renderMushafPage(activeSlideTargetPageData, { interactive: false })}
            </div>
          )}
        </div>

        <ReaderFooterMeta displayPage={footerDisplayPage} progress={juzProgress} />
      </div>

      <AnimatePresence>
        {controlsVisible && (
          <ReaderBottomControls
            page={page}
            displayPage={footerDisplayPage}
            goPage={goReaderPage}
            onPreviousPage={goPreviousReaderPageWithSlide}
            onSearch={openSearch}
            onAudio={() => openAudioPanel()}
            compact={audioPlayerActive}
            juzProgress={juzProgress}
            onChromeTap={hideReaderChrome}
            onPreviewPageChange={setSliderPreviewPage}
            onSliderInteractionChange={setSliderInteracting}
          />
        )}
      </AnimatePresence>
    </>
  );

  const landscapeReader = (
    <ReaderLandscapeView
      page={page}
      meta={meta}
      displayPage={displayPage}
      navigationRevision={readerNavigationRevision}
      pendingAyah={pendingAyah}
      pendingQuarterFlash={pendingQuarterFlash}
      selectedAyah={selectedAyah}
      audioTarget={audioTarget}
      audioPlayerActive={audioPlayerActive}
      audioPlayerVisible={audioPlayerVisible}
      controlsVisible={controlsVisible}
      footerDisplayPage={footerDisplayPage}
      juzProgress={juzProgress}
      onBack={() => goBack()}
      onBookmarks={openBookmarks}
      onIndex={openIndex}
      onSettings={openSettings}
      onSearch={openSearch}
      onAudio={() => openAudioPanel()}
      onPreviousPage={goPreviousReaderPageWithSlide}
      onGoPage={goReaderPage}
      onSyncPage={syncReaderPageFromScroll}
      onHideChrome={hideReaderChrome}
      onReaderScrolled={() => {
        suppressTapUntil.current = Date.now() + 320;
        if (ayahTooltipVisible) closeAyahSheet();
        if (controlsVisible) setControlsVisible(false);
      }}
      onPreviewPageChange={setSliderPreviewPage}
      onSliderInteractionChange={setSliderInteracting}
      renderMushafPage={renderMushafPage}
    />
  );

  return (
    <section
      className={`fixed inset-0 overflow-hidden bg-reader text-slate-950 ${isReaderLandscape ? 'reader-landscape-mode' : 'reader-portrait-mode'}`}
      onPointerDownCapture={handleReaderPointerDownCapture}
      onClick={handleReaderTap}
    >
      {isReaderLandscape ? landscapeReader : portraitReader}

      <AnimatePresence>
        {translationTarget && (
          <AyahTranslationCard
            target={translationTarget}
            translationId={settings.translation}
            onClose={() => setTranslationTarget(null)}
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
            onCopied={showCopyToast}
            onAnnotationsChanged={annotationsChanged}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {copyToastVisible && (
          <div className="reader-copy-toast" data-reader-ui role="status">
            Copied
          </div>
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
  if (
    Number(pendingQuarterFlash?.targetPage) === page &&
    pendingQuarterFlash.targetSurah &&
    pendingQuarterFlash.targetAyah
  ) {
    return {
      surahNumber: pendingQuarterFlash.targetSurah,
      ayahNumber: pendingQuarterFlash.targetAyah,
    };
  }
  if (selectedAyah?.page === page) return selectedAyah;
  if (audioTarget?.page === page) return audioTarget;
  return firstPageAyah;
}

function isReaderKeyboardEventFromUi(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-reader-ui]')) return true;
  if (target.closest('[contenteditable="true"]')) return true;

  return target.matches('input, textarea, select, button, a');
}
