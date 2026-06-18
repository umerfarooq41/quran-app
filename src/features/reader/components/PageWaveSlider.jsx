import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clampPage, getPage, getSurah, totalPages } from '../../../lib/quran';

const PAGE_STEP = 8;
const BAR_RADIUS = 38;

export function PageWaveSlider({ page, goPage }) {
  const [previewPage, setPreviewPage] = useState(page);
  const [dragOffset, setDragOffset] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const interactionRef = useRef(null);
  const previewPageRef = useRef(page);
  const preview = useMemo(() => getPagePreview(previewPage), [previewPage]);

  useEffect(() => {
    if (interacting) return;
    previewPageRef.current = page;
    setPreviewPage(page);
    setDragOffset(0);
  }, [page, interacting]);

  const bars = useMemo(() => (
    Array.from({ length: BAR_RADIUS * 2 + 1 }, (_, index) => {
      const offset = index - BAR_RADIUS;
      const pageNumber = previewPage + offset;
      if (pageNumber < 1 || pageNumber > totalPages) return null;

      const x = offset * PAGE_STEP + dragOffset;
      const distance = Math.abs(x);
      const fadeDistance = BAR_RADIUS * PAGE_STEP;
      const proximity = Math.max(0, 1 - distance / fadeDistance);
      const variation = ((pageNumber * 17) % 9) - 4;

      return {
        pageNumber,
        x,
        height: Math.max(9, 12 + proximity * 17 + variation),
        opacity: Math.max(0.06, proximity ** 1.8),
      };
    }).filter(Boolean)
  ), [previewPage, dragOffset]);

  function showPage(nextPage, offset = 0) {
    const safePage = clampPage(nextPage);
    previewPageRef.current = safePage;
    setPreviewPage(safePage);
    setDragOffset(offset);
  }

  function updatePointer(clientX) {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const delta = clientX - interaction.startX;
    const rawPageOffset = -delta / PAGE_STEP;
    const nextPage = clampPage(interaction.basePage + Math.round(rawPageOffset));
    const remainder = delta + (nextPage - interaction.basePage) * PAGE_STEP;
    const boundedRemainder = Math.max(-PAGE_STEP / 2, Math.min(PAGE_STEP / 2, remainder));

    showPage(nextPage, boundedRemainder);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const tappedOffset = Math.round((event.clientX - (bounds.left + bounds.width / 2)) / PAGE_STEP);
    const tappedPage = clampPage(page + tappedOffset);

    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      basePage: tappedPage,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteracting(true);
    showPage(tappedPage, 0);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    updatePointer(event.clientX);
    event.preventDefault();
  }

  function handlePointerUp(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;

    updatePointer(event.clientX);
    const nextPage = previewPageRef.current;
    interactionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setInteracting(false);
    setDragOffset(0);

    if (nextPage !== page) goPage(nextPage);
  }

  function handlePointerCancel(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;

    interactionRef.current = null;
    setInteracting(false);
    showPage(page, 0);
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
    if (nextPage !== page) goPage(nextPage);
  }

  return (
    <div
      className={`reader-wave-slider ${interacting ? 'is-interacting' : ''}`}
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
      {interacting && (
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
