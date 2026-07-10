import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';
import { clampPage, getMushafPageNumber, getPage, totalPages } from '../../../lib/quran';
import { ReaderFooterMeta, ReaderPassiveHeader } from './ReaderPassiveMeta';
import { ReaderTopControls } from './ReaderTopControls';
import { ReaderLandscapeBottomDock } from './ReaderLandscapeBottomDock';

const WINDOW_RADIUS = 3;
const TOP_READING_ZONE = 0.26;

export function ReaderLandscapeView({
  page,
  meta,
  displayPage,
  navigationRevision,
  pendingAyah,
  pendingQuarterFlash,
  selectedAyah,
  audioTarget,
  audioPlayerActive,
  audioPlayerVisible,
  controlsVisible,
  footerDisplayPage,
  juzProgress,
  onBack,
  onBookmarks,
  onIndex,
  onSettings,
  onSearch,
  onAudio,
  onPreviousPage,
  onGoPage,
  onSyncPage,
  onHideChrome,
  onReaderScrolled,
  onPreviewPageChange,
  onSliderInteractionChange,
  renderMushafPage,
}) {
  const scrollerRef = useRef(null);
  const scrollFrameRef = useRef(0);
  const touchStartRef = useRef(null);
  const manualScrollRef = useRef(false);
  const pendingAnchorRef = useRef(null);
  const previousMetricsRef = useRef(null);
  const lastNavigationRevisionRef = useRef(-1);
  const [metrics, setMetrics] = useState(getLandscapeMetrics);
  const [windowRange, setWindowRange] = useState(() => getWindowRange(page));
  const [audioFollow, setAudioFollow] = useState(true);

  const pageBlockHeight = metrics.pageContentHeight + metrics.pageGap;
  const topSpacerHeight = (windowRange.start - 1) * pageBlockHeight;
  const bottomSpacerHeight = (totalPages - windowRange.end) * pageBlockHeight;
  const renderedPages = useMemo(() => {
    const pages = [];
    for (let pageNumber = windowRange.start; pageNumber <= windowRange.end; pageNumber += 1) {
      pages.push(getPage(pageNumber));
    }
    return pages;
  }, [windowRange.start, windowRange.end]);

  useEffect(() => {
    const updateMetrics = () => {
      const scroller = scrollerRef.current;
      if (scroller && previousMetricsRef.current) {
        pendingAnchorRef.current = getLogicalAnchor(scroller.scrollTop, previousMetricsRef.current);
      }
      setMetrics(getLandscapeMetrics());
    };

    window.addEventListener('resize', updateMetrics);
    window.addEventListener('orientationchange', updateMetrics);
    window.visualViewport?.addEventListener('resize', updateMetrics);

    return () => {
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      window.visualViewport?.removeEventListener('resize', updateMetrics);
    };
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (pendingAnchorRef.current) {
      const anchor = pendingAnchorRef.current;
      pendingAnchorRef.current = null;
      scroller.scrollTop = scrollTopForAnchor(anchor, metrics);
    }

    previousMetricsRef.current = metrics;
    updateVisibleState(scroller, metrics, onSyncPage, setWindowRange);
  }, [metrics, onSyncPage]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || lastNavigationRevisionRef.current === navigationRevision) return;

    lastNavigationRevisionRef.current = navigationRevision;
    const target = getExplicitTarget({
      page,
      pendingAyah,
      pendingQuarterFlash,
      selectedAyah,
      audioTarget,
    });
    const targetTop = getTargetScrollTop(target.page, target.lineIndex, metrics, scroller.clientHeight);

    setWindowRange(getWindowRange(target.page));
    window.requestAnimationFrame(() => {
      scroller.scrollTop = targetTop;
      updateVisibleState(scroller, metrics, onSyncPage, setWindowRange);
    });
  }, [
    navigationRevision,
    page,
    pendingAyah?.surahNumber,
    pendingAyah?.ayahNumber,
    pendingQuarterFlash?.targetPage,
    pendingQuarterFlash?.targetSurah,
    pendingQuarterFlash?.targetAyah,
    selectedAyah?.page,
    selectedAyah?.surahNumber,
    selectedAyah?.ayahNumber,
    audioTarget?.page,
    audioTarget?.surahNumber,
    audioTarget?.ayahNumber,
    metrics,
    onSyncPage,
  ]);

  useEffect(() => {
    if (!audioPlayerActive || !audioTarget?.page || !audioTarget?.surahNumber || !audioTarget?.ayahNumber) return;
    if (!audioFollow) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const lineIndex = findTargetLineIndex(
      getPage(audioTarget.page),
      audioTarget.surahNumber,
      audioTarget.ayahNumber,
    );
    const targetTop = metrics.streamTopInset + ((clampPage(audioTarget.page) - 1) * pageBlockHeight) + (lineIndex * metrics.rowHeight);
    const visibleTop = scroller.scrollTop + scroller.clientHeight * 0.16;
    const visibleBottom = scroller.scrollTop + scroller.clientHeight * 0.76;

    if (targetTop < visibleTop || targetTop + metrics.rowHeight > visibleBottom) {
      setWindowRange(getWindowRange(audioTarget.page));
      scroller.scrollTo({
        top: getTargetScrollTop(audioTarget.page, lineIndex, metrics, scroller.clientHeight, 0.34),
        behavior: 'smooth',
      });
    }
  }, [
    audioTarget?.page,
    audioTarget?.surahNumber,
    audioTarget?.ayahNumber,
    audioPlayerActive,
    audioFollow,
    metrics,
    pageBlockHeight,
  ]);

  useEffect(() => {
    if (!audioPlayerActive) setAudioFollow(true);
  }, [audioPlayerActive]);

  useEffect(() => () => window.cancelAnimationFrame(scrollFrameRef.current), []);

  function scheduleScrollUpdate() {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateVisibleState(scroller, metrics, onSyncPage, setWindowRange);
      if (manualScrollRef.current) {
        manualScrollRef.current = false;
        if (audioPlayerActive) setAudioFollow(false);
        onReaderScrolled?.();
      }
    });
  }

  function markManualScroll() {
    manualScrollRef.current = true;
  }

  function handleTouchStart(event) {
    const touch = event.touches?.[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchMove(event) {
    const start = touchStartRef.current;
    const touch = event.touches?.[0];
    if (!start || !touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) markManualScroll();
  }

  function returnToPlayingAyah() {
    if (!audioTarget?.page) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const lineIndex = findTargetLineIndex(
      getPage(audioTarget.page),
      audioTarget.surahNumber,
      audioTarget.ayahNumber,
    );
    setAudioFollow(true);
    setWindowRange(getWindowRange(audioTarget.page));
    scroller.scrollTo({
      top: getTargetScrollTop(audioTarget.page, lineIndex, metrics, scroller.clientHeight, 0.34),
      behavior: 'smooth',
    });
  }

  return (
    <div className={`reader-shell reader-shell-landscape ${audioPlayerActive ? 'reader-shell-audio-active' : ''} ${audioPlayerActive && !audioPlayerVisible ? 'reader-shell-audio-collapsed' : ''}`}>
      <div className="reader-top-hit-zone" data-reader-toggle-zone aria-hidden="true" />
      <div className="reader-bottom-hit-zone" data-reader-toggle-zone aria-hidden="true" />

      <ReaderPassiveHeader meta={meta} displayPage={displayPage} />
      <ReaderTopControls
        visible={controlsVisible}
        onBack={onBack}
        onBookmarks={onBookmarks}
        onIndex={onIndex}
        onSettings={onSettings}
        onChromeTap={onHideChrome}
      />

      <div
        ref={scrollerRef}
        className="reader-landscape-scroll"
        style={{
          '--reader-landscape-row-height': `${metrics.rowHeight}px`,
          '--reader-landscape-font-size': `${metrics.fontSize}px`,
          '--reader-landscape-page-gap': `${metrics.pageGap}px`,
        }}
        onScroll={scheduleScrollUpdate}
        onWheel={markManualScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') markManualScroll();
        }}
      >
        <div className="reader-landscape-leading-space" style={{ height: `${metrics.streamTopInset}px` }} aria-hidden="true" />
        <div className="reader-landscape-spacer" style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />

        {renderedPages.map((pageData) => (
          <div
            key={pageData.page}
            className="landscape-mushaf-page-block"
            data-landscape-page={pageData.page}
            style={{ height: `${pageBlockHeight}px` }}
          >
            {renderMushafPage(pageData, { layoutMode: 'landscape-stream' })}
            <div className="landscape-page-separator" aria-hidden="true">
              <span />
              <b>{getMushafPageNumber(pageData.page)}</b>
              <span />
            </div>
          </div>
        ))}

        <div className="reader-landscape-spacer" style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
        <div className="reader-landscape-trailing-space" style={{ height: `${metrics.streamBottomInset}px` }} aria-hidden="true" />
      </div>

      <ReaderFooterMeta displayPage={footerDisplayPage} progress={juzProgress} />

      {!audioFollow && audioPlayerActive && audioTarget && (
        <button
          type="button"
          className="reader-return-to-audio"
          data-reader-ui
          onClick={returnToPlayingAyah}
        >
          <Headphones size={17} aria-hidden="true" />
          <span>Return to playing ayah</span>
        </button>
      )}

      {controlsVisible && (
        <ReaderLandscapeBottomDock
          page={page}
          displayPage={footerDisplayPage}
          goPage={onGoPage}
          onPreviousPage={onPreviousPage}
          onSearch={onSearch}
          onAudio={onAudio}
          progress={juzProgress}
          onChromeTap={onHideChrome}
          onPreviewPageChange={onPreviewPageChange}
          onSliderInteractionChange={onSliderInteractionChange}
        />
      )}
    </div>
  );
}

function getLandscapeMetrics() {
  const viewportHeight = Math.max(280, window.visualViewport?.height || window.innerHeight || 390);
  const rowHeight = clamp(64, viewportHeight * 0.205, 90);
  const fontSize = clamp(25, rowHeight * 0.405, 36);
  const pageGap = clamp(18, viewportHeight * 0.055, 24);
  const streamTopInset = 48;
  const streamBottomInset = 64;

  return {
    viewportHeight,
    rowHeight,
    fontSize,
    pageGap,
    streamTopInset,
    streamBottomInset,
    pageContentHeight: rowHeight * 16,
    pageBlockHeight: (rowHeight * 16) + pageGap,
  };
}

function getWindowRange(centerPage) {
  const safePage = clampPage(centerPage);
  return {
    start: Math.max(1, safePage - WINDOW_RADIUS),
    end: Math.min(totalPages, safePage + WINDOW_RADIUS),
  };
}

function updateVisibleState(scroller, metrics, onSyncPage, setWindowRange) {
  const blockHeight = metrics.pageBlockHeight;
  const readingPoint = Math.max(0, scroller.scrollTop + scroller.clientHeight * 0.48 - metrics.streamTopInset);
  const visiblePage = clampPage(Math.floor(readingPoint / blockHeight) + 1);

  onSyncPage(visiblePage);
  setWindowRange((current) => {
    if (visiblePage >= current.start + 1 && visiblePage <= current.end - 1) return current;
    const next = getWindowRange(visiblePage);
    return next.start === current.start && next.end === current.end ? current : next;
  });
}

function getLogicalAnchor(scrollTop, metrics) {
  const blockHeight = metrics.pageBlockHeight;
  const adjustedScrollTop = Math.max(0, scrollTop - metrics.streamTopInset);
  const pageIndex = Math.max(0, Math.min(totalPages - 1, Math.floor(adjustedScrollTop / blockHeight)));
  const withinPage = Math.max(0, adjustedScrollTop - pageIndex * blockHeight);
  const lineIndex = Math.max(0, Math.min(15, Math.floor(withinPage / metrics.rowHeight)));
  const lineOffset = Math.max(0, Math.min(1, (withinPage - lineIndex * metrics.rowHeight) / metrics.rowHeight));

  return { page: pageIndex + 1, lineIndex, lineOffset };
}

function scrollTopForAnchor(anchor, metrics) {
  return metrics.streamTopInset + ((clampPage(anchor.page) - 1) * metrics.pageBlockHeight)
    + (anchor.lineIndex * metrics.rowHeight)
    + (anchor.lineOffset * metrics.rowHeight);
}

function getExplicitTarget({ page, pendingAyah, pendingQuarterFlash, selectedAyah, audioTarget }) {
  const safePage = clampPage(page);
  const pageData = getPage(safePage);
  const target = (
    Number(pendingQuarterFlash?.targetPage) === safePage && pendingQuarterFlash?.targetSurah
      ? { surahNumber: pendingQuarterFlash.targetSurah, ayahNumber: pendingQuarterFlash.targetAyah }
      : pendingAyah?.surahNumber
        ? pendingAyah
        : selectedAyah?.page === safePage
          ? selectedAyah
          : audioTarget?.page === safePage
            ? audioTarget
            : null
  );

  return {
    page: safePage,
    lineIndex: target
      ? findTargetLineIndex(pageData, target.surahNumber, target.ayahNumber)
      : 0,
  };
}

function getTargetScrollTop(page, lineIndex, metrics, viewportHeight, zone = TOP_READING_ZONE) {
  const absoluteTop = metrics.streamTopInset + ((clampPage(page) - 1) * metrics.pageBlockHeight)
    + (Math.max(0, Math.min(15, lineIndex)) * metrics.rowHeight);
  const maxScroll = Math.max(0, metrics.streamTopInset + totalPages * metrics.pageBlockHeight + metrics.streamBottomInset - viewportHeight);
  return Math.max(0, Math.min(maxScroll, absoluteTop - viewportHeight * zone));
}

function findTargetLineIndex(pageData, surahNumber, ayahNumber) {
  const safeSurah = Number(surahNumber);
  const safeAyah = Number(ayahNumber);
  if (!safeSurah || !safeAyah) return 0;

  const exactIndex = pageData.lines.findIndex((line) => (
    Number(line.surahNumber) === safeSurah
    && Number(line.ayahStart) <= safeAyah
    && Number(line.ayahEnd || line.ayahStart) >= safeAyah
  ));

  return exactIndex >= 0 ? exactIndex : 0;
}

function clamp(minimum, value, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
