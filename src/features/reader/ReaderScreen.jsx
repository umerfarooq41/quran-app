import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { db } from '../../lib/db';
import { getCurrentIndoPakJuzProgress } from '../../data/indoPakParaQuarters';
import { clampPage, findPageForReference, getMushafPageNumber, getPage, getPageMeta, getSurah, getSurahAyahs } from '../../lib/quran';
import { clearPageTrace, getPageTraceText, OVERLAY_TYPES, useAppStore } from '../../store/useAppStore';
import { AyahActionSheet } from './components/AyahActionSheet';
import { AyahTranslationCard } from './components/AyahTranslationCard';
import { MushafPage } from './components/MushafPage';
import { ReaderBottomControls } from './components/ReaderBottomControls';
import { ReaderFooterMeta, ReaderPassiveHeader } from './components/ReaderPassiveMeta';
import { ReaderTopControls } from './components/ReaderTopControls';
import { usePagePersistence } from './hooks/usePagePersistence';
import { useReaderGestures } from './hooks/useReaderGestures';

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
    goPage,
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
    openSharePage,
    audioTarget,
    audioPlayerActive,
    audioPlayerVisible,
    audioPlaying,
    followRecitation,
    playingVerseKey,
    playingWordPosition,
    playingWordOccurrenceIndex,
    openAudioPlayer,
    showAudioPlayer,
    hideAudioPlayer,
    pendingAyah,
    pendingQuarterFlash,
    clearPendingAyah,
    clearPendingQuarterFlash,
    lastReadTarget,
    setLastReadTarget,
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    previousReaderPage: state.previousReaderPage,
    goPage: state.goPage,
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
    openSharePage: state.openSharePage,
    audioTarget: state.audioTarget,
    audioPlayerActive: state.audioPlayerActive,
    audioPlayerVisible: state.audioPlayerVisible,
    audioPlaying: state.audioPlaying,
    followRecitation: state.followRecitation,
    playingVerseKey: state.playingVerseKey,
    playingWordPosition: state.playingWordPosition,
    playingWordOccurrenceIndex: state.playingWordOccurrenceIndex,
    openAudioPlayer: state.openAudioPlayer,
    showAudioPlayer: state.showAudioPlayer,
    hideAudioPlayer: state.hideAudioPlayer,
    pendingAyah: state.pendingAyah,
    pendingQuarterFlash: state.pendingQuarterFlash,
    clearPendingAyah: state.clearPendingAyah,
    clearPendingQuarterFlash: state.clearPendingQuarterFlash,
    lastReadTarget: state.lastReadTarget,
    setLastReadTarget: state.setLastReadTarget,
  })));
  const [sliderPreviewPage, setSliderPreviewPage] = useState(null);
  const [sliderInteracting, setSliderInteracting] = useState(false);
  const [translationTarget, setTranslationTarget] = useState(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [pageTraceCount, setPageTraceCount] = useState(() => (
    import.meta.env.DEV && typeof window !== 'undefined' && Array.isArray(window.__QURAN_PAGE_TRACE__)
      ? window.__QURAN_PAGE_TRACE__.length
      : 0
  ));
  const [pageTraceStatus, setPageTraceStatus] = useState('');
  const [pageSlide, setPageSlide] = useState(PAGE_SLIDE_IDLE);
  const [pageTransition, setPageTransition] = useState(null);
  const [audioFollowEnabled, setAudioFollowEnabled] = useState(() => (
    followRecitation
    && (!audioPlayerActive || !audioTarget?.page || Number(audioTarget.page) === Number(page))
  ));
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
  const readerInteractionsBlocked = Boolean(
    controlsVisible ||
      audioPlayerVisible ||
      translationTarget ||
      ayahTooltipVisible
  );
  const activeSlideTargetPage = pageSlide.targetPage && pageSlide.targetPage !== page
    ? pageSlide.targetPage
    : null;
  const activeSlideTargetPageData = activeSlideTargetPage ? getPage(activeSlideTargetPage) : null;
  const pageSlideActive = pageSlide.active || pageSlide.settling;
  const pageTransitionActive = Boolean(pageTransition && pageTransition.page !== page);
  const showReturnToAudioChip = Boolean(
    audioPlayerActive &&
      audioPlaying &&
      !audioFollowEnabled &&
      audioTarget?.pageIsAuthoritative &&
      playingVerseKey &&
      audioTarget?.page &&
      Number(audioTarget.page) !== Number(page)
  );
  const playingSurah = audioTarget?.surahNumber
    ? getSurah(audioTarget.surahNumber)
    : null;

  useEffect(() => {
    if (!sliderInteracting) setSliderPreviewPage(null);
  }, [page, sliderInteracting]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const syncTraceCount = () => {
      setPageTraceCount(Array.isArray(window.__QURAN_PAGE_TRACE__) ? window.__QURAN_PAGE_TRACE__.length : 0);
    };

    window.addEventListener('quran:page-trace', syncTraceCount);
    window.addEventListener('quran:page-trace-cleared', syncTraceCount);
    syncTraceCount();

    return () => {
      window.removeEventListener('quran:page-trace', syncTraceCount);
      window.removeEventListener('quran:page-trace-cleared', syncTraceCount);
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(copyToastTimer.current);
    window.clearTimeout(pageSlideTimer.current);
    window.clearTimeout(pageTransitionTimer.current);
  }, []);

  useEffect(() => {
    window.clearTimeout(pageSlideTimer.current);
    setPageSlide(PAGE_SLIDE_IDLE);
  }, [page]);

  usePagePersistence({ page, pageData, lastReadTarget, setLastReadTarget });

  useEffect(() => {
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
    audioPlayerVisible,
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
    if (
      audioPlayerActive &&
      followRecitation &&
      audioFollowEnabled &&
      playingVerseKey &&
      playingWordPosition &&
      audioTarget?.pageIsAuthoritative &&
      audioTarget?.page &&
      Number(audioTarget.page) !== Number(page)
    ) {
      const keepControlsVisible = controlsVisible;
      goReaderPage(audioTarget.page, null, { navigationSource: 'audio' });
      if (keepControlsVisible) setControlsVisible(true);
    }
  }, [
    audioTarget?.surahNumber,
    audioTarget?.ayahNumber,
    audioTarget?.page,
    audioPlayerActive,
    followRecitation,
    audioFollowEnabled,
    playingVerseKey,
    playingWordPosition,
    audioTarget?.pageIsAuthoritative,
    controlsVisible,
    page,
    setControlsVisible,
  ]);

  useEffect(() => {
    if (!audioPlayerActive) {
      setAudioFollowEnabled(followRecitation);
      return;
    }

    if (!followRecitation) {
      setAudioFollowEnabled(false);
    }
  }, [audioPlayerActive, followRecitation]);

  useEffect(() => {
    if (!followRecitation || !audioPlayerActive) return;

    // Turning Follow Recitation back on is allowed to navigate only after the
    // audio engine has confirmed the current Mushaf page from an actual timed
    // Quran word. Never follow a requested/seek target during source loading.
    if (
      playingVerseKey
      && playingWordPosition
      && audioTarget?.pageIsAuthoritative
      && audioTarget?.page
    ) {
      setAudioFollowEnabled(true);
      if (Number(audioTarget.page) !== Number(page)) {
        goReaderPage(audioTarget.page, null, { navigationSource: 'audio' });
      }
    }
  }, [followRecitation]);

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

  function updateAudioFollowForDestination(nextPage, navigationSource = 'user') {
    if (!audioPlayerActive) return;

    if (navigationSource === 'return-to-audio') {
      setAudioFollowEnabled(true);
      return;
    }

    // Audio-driven navigation, including the one intentional move to the
    // selected ayah's true start page, must not be mistaken for manual
    // browsing. Timed-word authority will take over after playback starts.
    if (navigationSource === 'audio' || navigationSource === 'audio-start') return;

    // Manual browsing suspends following while the user is away. If they
    // manually navigate back to the page confirmed by the current timed word,
    // reconnect automatically; audio timing updates alone never do this.
    setAudioFollowEnabled(Boolean(
      audioTarget?.pageIsAuthoritative
      && audioTarget?.page
      && Number(nextPage) === Number(audioTarget.page)
    ));
  }

  function goReaderPage(nextPage, pendingAyah = null, options = {}) {
    const safeNextPage = clampPage(nextPage);
    const {
      skipSlideTransition,
      navigationSource = 'user',
      ...goPageOptions
    } = options || {};

    updateAudioFollowForDestination(safeNextPage, navigationSource);

    if (!skipSlideTransition) {
      startPageTransition(safeNextPage);
    }

    goPage(safeNextPage, pendingAyah, goPageOptions);
  }

  function goPreviousReaderPageWithSlide() {
    if (previousReaderPage && previousReaderPage !== page) {
      updateAudioFollowForDestination(previousReaderPage, 'user');
      startPageTransition(previousReaderPage);
    }

    goPreviousReaderPage();
  }

  function pageSlideBlocked() {
    return Boolean(translationTarget || ayahTooltipVisible || audioPlayerVisible);
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

  function startPlaybackTarget(rawTarget, { navigateToAyahStart = false } = {}) {
    if (!rawTarget?.surahNumber || !rawTarget?.ayahNumber) return;

    const ayahStartPage = findPageForReference(rawTarget.surahNumber, rawTarget.ayahNumber)
      || rawTarget.page
      || page;
    const target = {
      ...rawTarget,
      page: ayahStartPage,
      pageIsAuthoritative: false,
    };

    // Fresh playback always begins at the selected ayah's true beginning.
    // Navigate only when that beginning is on another Mushaf page. After audio
    // starts, timed-word synchronization becomes authoritative for page turns.
    if (navigateToAyahStart && Number(ayahStartPage) !== Number(page)) {
      goReaderPage(ayahStartPage, null, { navigationSource: 'audio-start' });
    }

    // Start in follow mode, but the follow effect below is gated on an
    // authoritative timed word. The non-authoritative seek target therefore
    // cannot move the reader; once timing is established, normal following
    // begins without a separate effect that could override manual browsing.
    setAudioFollowEnabled(followRecitation);
    openAudioPlayer(target);
    window.dispatchEvent(new CustomEvent('quran:audio-user-play-request', {
      detail: { target },
    }));
  }

  function playFromPageStart() {
    if (audioPlayerActive && !audioPlayerVisible) {
      showAudioPlayer();
      return;
    }

    // The first ayah represented on the visible page is the playback target.
    // If that ayah began on the previous page, startPlaybackTarget moves back
    // to its true beginning before recitation starts.
    const firstLine = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
    if (!firstLine) return;

    startPlaybackTarget({
      page,
      surahNumber: firstLine.surahNumber,
      ayahNumber: firstLine.ayahStart,
      reference: `${firstLine.surahNumber}:${firstLine.ayahStart}`,
      arabic: firstLine.text,
    }, { navigateToAyahStart: true });
  }

  function playSelectedAyah(targetLine) {
    if (!targetLine) return;

    // Playback must not inherit the long-press selection overlay. From this
    // point the timed recitation state alone controls ayah/word highlighting.
    closeAyahSheet();

    // Long Press -> Play starts exactly the selected ayah. Stay on the current
    // page when its beginning is here; move back only when the ayah actually
    // begins on an earlier page.
    startPlaybackTarget(targetLine, { navigateToAyahStart: true });
  }

  function returnToPlayingAyah() {
    if (
      !audioPlaying
      || !playingVerseKey
      || !audioTarget?.pageIsAuthoritative
      || !audioTarget?.page
    ) return;

    setAudioFollowEnabled(true);
    goReaderPage(audioTarget.page, null, { navigationSource: 'return-to-audio' });
  }

  async function copyPageTrace() {
    const trace = getPageTraceText();
    try {
      await navigator.clipboard.writeText(trace);
      setPageTraceStatus('Copied');
    } catch {
      window.prompt('Copy page trace', trace);
      setPageTraceStatus('Select all and copy');
    }
    window.setTimeout(() => setPageTraceStatus(''), 1800);
  }

  function resetPageTrace() {
    clearPageTrace();
    setPageTraceStatus('Cleared');
    window.setTimeout(() => setPageTraceStatus(''), 1200);
  }

  function annotationsChanged() {
    setAnnotationVersion((version) => version + 1);
  }

  function showSharePage(targetAyah) {
    openSharePage(targetAyah);
  }

  function showCopyToast() {
    window.clearTimeout(copyToastTimer.current);
    setCopyToastVisible(true);
    copyToastTimer.current = window.setTimeout(() => {
      setCopyToastVisible(false);
    }, 1300);
  }

  function selectAyah(line, lineIndex, selection) {
    if (readerInteractionsBlocked || isAyahInteractionSuppressed()) {
      suppressTapUntil.current = Date.now() + 700;
      dismissVisibleReaderUi();
      return;
    }

    const surahNumber = Number(selection?.surahNumber || line.surahNumber);
    const ayahNumber = Number(selection?.ayahNumber || line.ayahStart);
    const wordIndex = Number.isInteger(selection?.wordIndex)
      ? selection.wordIndex
      : null;
    const ayah = getSurahAyahs(surahNumber)
      .find((candidate) => candidate.ayahNumber === ayahNumber);
    const ayahKey = `${surahNumber}:${ayahNumber}`;

    suppressTapUntil.current = Date.now() + 700;
    setTranslationTarget(null);
    openAyahSheet({
      page,
      surah: surahNumber,
      ayah: ayahNumber,
      surahNumber,
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

  function openTranslationCard(line, lineIndex, selection) {
    if (line.type !== 'ayah' || !line.surahNumber || !line.ayahStart) return;
    if (readerInteractionsBlocked || isAyahInteractionSuppressed()) {
      dismissVisibleReaderUi();
      return;
    }

    const surahNumber = Number(selection?.surahNumber || line.surahNumber);
    const ayahNumber = Number(selection?.ayahNumber || line.ayahStart);
    setTranslationTarget({
      page,
      surahNumber,
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

  function renderMushafPage(renderedPageData, { interactive = true } = {}) {
    const renderedPage = renderedPageData.page;
    return (
      <MushafPage
        pageData={renderedPageData}
        settings={settings}
        savedHighlights={savedHighlights}
        bookmarkMarkers={bookmarkMarkers}
        pendingAyah={interactive ? pendingAyah : null}
        quarterFlashTarget={interactive ? quarterFlashTarget : null}
        selectedAyah={interactive ? selectedAyah : null}
        playingVerseKey={playingVerseKey}
        playingWordPosition={playingWordPosition}
        playingWordOccurrenceIndex={playingWordOccurrenceIndex}
        interactionsBlocked={!interactive || readerInteractionsBlocked}
        enableTextHighlights={interactive}
        onBlockedInteraction={interactive ? dismissVisibleReaderUi : undefined}
        onSelectAyah={interactive ? selectAyah : () => {}}
        onTapAyah={interactive ? openTranslationCard : () => {}}
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

  return (
    <section
      className="fixed inset-0 overflow-hidden bg-reader text-slate-950"
      onPointerDownCapture={handleReaderPointerDownCapture}
      onClick={handleReaderTap}
    >
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

      {import.meta.env.DEV && (
        <div
          data-reader-ui
          style={{
            position: 'fixed',
            zIndex: 9999,
            top: 'max(8px, env(safe-area-inset-top))',
            right: '8px',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '6px',
            borderRadius: '10px',
            background: 'rgba(17, 24, 39, .88)',
            color: '#fff',
            fontSize: '11px',
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          }}
        >
          <span>Trace {pageTraceCount}</span>
          <button type="button" onClick={copyPageTrace} style={{ padding: '4px 7px', borderRadius: '6px', background: '#fff', color: '#111827' }}>
            Copy Trace
          </button>
          <button type="button" onClick={resetPageTrace} style={{ padding: '4px 7px', borderRadius: '6px', background: '#fff', color: '#111827' }}>
            Clear
          </button>
          {pageTraceStatus && <span>{pageTraceStatus}</span>}
        </div>
      )}

      {showReturnToAudioChip && (
        <button
          type="button"
          className="reader-return-to-audio-chip"
          data-reader-ui
          onClick={returnToPlayingAyah}
          aria-label={`Return to reciting ayah ${audioTarget.surahNumber}:${audioTarget.ayahNumber}`}
        >
          <span className="reader-return-to-audio-dot" aria-hidden="true" />
          <span className="reader-return-to-audio-text">
            <strong>Return to recitation</strong>
            <span>
              {playingSurah?.name || `Surah ${audioTarget.surahNumber}`}
              {' '}
              {audioTarget.surahNumber}:{audioTarget.ayahNumber}
            </span>
          </span>
        </button>
      )}

      <AnimatePresence>
        {controlsVisible && (
          <ReaderBottomControls
            page={page}
            displayPage={footerDisplayPage}
            goPage={goReaderPage}
            onPreviousPage={goPreviousReaderPageWithSlide}
            onSearch={openSearch}
            onAudio={playFromPageStart}
            compact={audioPlayerActive}
            juzProgress={juzProgress}
            onChromeTap={hideReaderChrome}
            onPreviewPageChange={setSliderPreviewPage}
            onSliderInteractionChange={setSliderInteracting}
          />
        )}
      </AnimatePresence>

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
            onPlay={playSelectedAyah}
            onShare={showSharePage}
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
