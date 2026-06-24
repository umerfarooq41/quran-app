import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clampPage, getPage, getSurah, totalPages } from '../../../lib/quran';

const PAGE_STEP = 8;
const BAR_RADIUS = 42;
const MAX_MOMENTUM_VELOCITY = 4.8;
const MOMENTUM_FRICTION = 0.92;
const MOMENTUM_STOP_VELOCITY = 0.08;

export function PageWaveSlider({ page, goPage, onPreviewChange, onInteractionChange }) {
  const [previewPage, setPreviewPage] = useState(page);
  const [dragOffset, setDragOffset] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const interactionRef = useRef(null);
  const previewPageRef = useRef(page);
  const offsetRef = useRef(0);
  const momentumRef = useRef(null);
  const lastHapticPageRef = useRef(page);
  const preview = useMemo(() => getPagePreview(previewPage), [previewPage]);

  const cancelMomentum = useCallback(() => {
    if (!momentumRef.current) return;
    window.cancelAnimationFrame(momentumRef.current.frame);
    momentumRef.current = null;
  }, []);

  const showPage = useCallback((nextPage, offset = 0, haptic = true) => {
    const safePage = clampPage(nextPage);
    const safeOffset = Math.max(-PAGE_STEP / 2, Math.min(PAGE_STEP / 2, offset));

    previewPageRef.current = safePage;
    offsetRef.current = safeOffset;
    setPreviewPage(safePage);
    setDragOffset(safeOffset);
    onPreviewChange?.(safePage);

    if (haptic && safePage !== lastHapticPageRef.current) {
      lastHapticPageRef.current = safePage;
      if (window.navigator?.vibrate) window.navigator.vibrate(8);
    }
  }, [onPreviewChange]);

  useEffect(() => {
    if (interacting || momentumRef.current) return;
    lastHapticPageRef.current = page;
    showPage(page, 0, false);
  }, [page, interacting, showPage]);

  useEffect(() => () => cancelMomentum(), [cancelMomentum]);

  const bars = useMemo(() => (
    Array.from({ length: BAR_RADIUS * 2 + 1 }, (_, index) => {
      const offset = index - BAR_RADIUS;
      const pageNumber = previewPage + offset;
      if (pageNumber < 1 || pageNumber > totalPages) return null;

      const x = offset * PAGE_STEP + dragOffset;
      const distance = Math.abs(x);
      const fadeDistance = BAR_RADIUS * PAGE_STEP;
      const proximity = Math.max(0, 1 - distance / fadeDistance);
      const shaped = proximity ** 1.55;

      return {
        pageNumber,
        x,
        height: 7 + shaped * 35,
        opacity: 0.1 + shaped * 0.9,
      };
    }).filter(Boolean)
  ), [previewPage, dragOffset]);

  function applyDelta(basePage, delta) {
    const rawPageOffset = -delta / PAGE_STEP;
    const nextPage = clampPage(basePage + Math.round(rawPageOffset));
    const remainder = delta + (nextPage - basePage) * PAGE_STEP;
    showPage(nextPage, remainder);
  }

  function finishInteraction(commitPage) {
    cancelMomentum();
    setInteracting(false);
    onInteractionChange?.(false);
    showPage(commitPage, 0, false);
    if (commitPage !== page) goPage(commitPage, null, { keepControlsVisible: true });
  }

  function runMomentum(initialVelocity) {
    let velocity = Math.max(-MAX_MOMENTUM_VELOCITY, Math.min(MAX_MOMENTUM_VELOCITY, initialVelocity));
    let virtualOffset = offsetRef.current;
    let virtualPage = previewPageRef.current;
    let lastTime = performance.now();

    const step = (time) => {
      const elapsed = Math.min(32, time - lastTime) / 16.67;
      lastTime = time;
      virtualOffset += velocity * elapsed;

      while (virtualOffset <= -PAGE_STEP / 2 && virtualPage < totalPages) {
        virtualPage += 1;
        virtualOffset += PAGE_STEP;
      }
      while (virtualOffset >= PAGE_STEP / 2 && virtualPage > 1) {
        virtualPage -= 1;
        virtualOffset -= PAGE_STEP;
      }

      showPage(virtualPage, virtualOffset);
      velocity *= MOMENTUM_FRICTION ** elapsed;

      if (Math.abs(velocity) < MOMENTUM_STOP_VELOCITY) {
        momentumRef.current = null;
        finishInteraction(virtualPage);
        return;
      }

      momentumRef.current = { frame: window.requestAnimationFrame(step) };
    };

    momentumRef.current = { frame: window.requestAnimationFrame(step) };
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelMomentum();

    const bounds = event.currentTarget.getBoundingClientRect();
    const tappedOffset = Math.round((event.clientX - (bounds.left + bounds.width / 2)) / PAGE_STEP);
    const tappedPage = clampPage(page + tappedOffset);

    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      basePage: tappedPage,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteracting(true);
    onInteractionChange?.(true);
    showPage(tappedPage, 0, false);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    const interaction = interactionRef.current;
    if (interaction?.pointerId !== event.pointerId) return;

    const now = performance.now();
    const elapsed = Math.max(1, now - interaction.lastTime);
    interaction.velocity = (event.clientX - interaction.lastX) / elapsed * 16.67;
    interaction.lastX = event.clientX;
    interaction.lastTime = now;
    applyDelta(interaction.basePage, event.clientX - interaction.startX);
    event.preventDefault();
  }

  function handlePointerUp(event) {
    const interaction = interactionRef.current;
    if (interaction?.pointerId !== event.pointerId) return;

    handlePointerMove(event);
    const velocity = interaction.velocity;
    interactionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (Math.abs(velocity) > 0.65) {
      runMomentum(velocity);
      return;
    }

    finishInteraction(previewPageRef.current);
  }

  function handlePointerCancel(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;

    interactionRef.current = null;
    finishInteraction(page);
  }

  function handleKeyDown(event) {
    let nextPage = null;

    if (event.key === 'ArrowLeft' || event.key === 'PageUp') nextPage = clampPage(page - 1);
    if (event.key === 'ArrowRight' || event.key === 'PageDown') nextPage = clampPage(page + 1);
    if (event.key === 'Home') nextPage = 1;
    if (event.key === 'End') nextPage = totalPages;
    if (nextPage === null) return;

    event.preventDefault();
    showPage(nextPage, 0);
    if (nextPage !== page) goPage(nextPage, null, { keepControlsVisible: true });
  }

  return (
    <div
      className={`reader-wave-slider ${interacting || momentumRef.current ? 'is-interacting' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Quran page navigation"
      aria-valuemin={1}
      aria-valuemax={totalPages}
      aria-valuenow={previewPage}
      aria-valuetext={`${preview.surahLabel}, ${preview.rangeLabel}, page ${previewPage}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {(interacting || momentumRef.current) && (
        <div className="reader-wave-tooltip" role="status">
          <strong>{preview.surahLabel}</strong>
          {preview.rangeLabel && <span>{preview.rangeLabel}</span>}
          <span>Page {previewPage}</span>
        </div>
      )}

      <div className="reader-wave-bars" aria-hidden="true">
        {bars.map((bar) => (
          <span
            key={bar.pageNumber}
            data-page={bar.pageNumber}
            style={{
              left: `calc(50% + ${bar.x}px)`,
              height: `${bar.height}px`,
              opacity: bar.opacity,
            }}
          />
        ))}
      </div>

      <div className="reader-wave-marker" aria-hidden="true" />
    </div>
  );
}

function getPagePreview(pageNumber) {
  const pageData = getPage(pageNumber);
  const ayahLines = pageData?.lines?.filter((line) => (
    line.surahNumber &&
    line.ayahStart !== null &&
    line.ayahEnd !== null &&
    Number.isFinite(Number(line.ayahStart)) &&
    Number.isFinite(Number(line.ayahEnd))
  )) || [];

  if (!ayahLines.length) {
    return { surahLabel: 'Quran', rangeLabel: '' };
  }

  const first = ayahLines[0];
  const last = ayahLines[ayahLines.length - 1];
  const firstSurah = getSurah(first.surahNumber);
  const lastSurah = getSurah(last.surahNumber);
  const sameSurah = first.surahNumber === last.surahNumber;
  const firstAyah = Number(first.ayahStart);
  const lastAyah = Number(last.ayahEnd);

  if (sameSurah) {
    return {
      surahLabel: firstSurah?.name || `Surah ${first.surahNumber}`,
      rangeLabel: firstAyah === lastAyah
        ? `Ayah ${firstAyah}`
        : `Ayahs ${firstAyah}-${lastAyah}`,
    };
  }

  return {
    surahLabel: `${firstSurah?.name || `Surah ${first.surahNumber}`} - ${lastSurah?.name || `Surah ${last.surahNumber}`}`,
    rangeLabel: `${first.surahNumber}:${firstAyah} - ${last.surahNumber}:${lastAyah}`,
  };
}
