import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clampPage, getPage, getPageMeta, getSurah, totalPages } from '../../../lib/quran';
import { getCurrentIndoPakJuzProgress } from '../../../data/indoPakParaQuarters';

const PAGE_STEP = 10;
const BAR_RADIUS = 18;
const MAX_INERTIA_FRAMES = 10;
const RTL_PAGE_DIRECTION = -1;

export function PageWaveSlider({ page, goPage, onPreviewChange }) {
  const [previewPage, setPreviewPage] = useState(page);
  const [dragOffset, setDragOffset] = useState(0);
  const [interacting, setInteracting] = useState(false);

  const interactionRef = useRef(null);
  const previewPageRef = useRef(page);
  const inertiaRef = useRef(0);
  const lastHapticPageRef = useRef(page);

  const preview = useMemo(() => getPagePreview(previewPage), [previewPage]);

  useEffect(() => {
    onPreviewChange?.(interacting ? { page: previewPage, ...preview } : null);
  }, [interacting, previewPage, preview, onPreviewChange]);

  useEffect(() => {
    if (interacting) return;
    previewPageRef.current = page;
    lastHapticPageRef.current = page;
    setPreviewPage(page);
    setDragOffset(0);
  }, [page, interacting]);

  useEffect(() => () => cancelAnimationFrame(inertiaRef.current), []);

  const bars = useMemo(() => (
    Array.from({ length: BAR_RADIUS * 2 + 1 }, (_, index) => {
      const visualOffset = index - BAR_RADIUS;
      const pageNumber = previewPage + visualOffset;

      if (pageNumber < 1 || pageNumber > totalPages) return null;

      const x = Math.round(visualOffset * PAGE_STEP + Math.round(dragOffset));

      const normalizedDistance = Math.abs(visualOffset) / BAR_RADIUS;
      const eased = Math.pow(Math.max(0, 1 - normalizedDistance), 1.55);

      return {
        pageNumber,
        x,
        height: 4 + eased * 44,
        opacity: 0.05 + eased * 0.95,
      };
    }).filter(Boolean)
  ), [previewPage, dragOffset]);

  function showPage(nextPage, offset = 0) {
    const safePage = clampPage(nextPage);

    previewPageRef.current = safePage;
    setPreviewPage(safePage);
    setDragOffset(offset);

    if (safePage !== lastHapticPageRef.current) {
      lastHapticPageRef.current = safePage;
      window.navigator?.vibrate?.(6);
    }
  }

  function updateFromDelta(delta) {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const rawPageOffset = (delta * RTL_PAGE_DIRECTION) / PAGE_STEP;
    const nextPage = clampPage(interaction.basePage + Math.round(rawPageOffset));

    const consumed =
      (nextPage - interaction.basePage) * PAGE_STEP * RTL_PAGE_DIRECTION;

    const remainder = delta - consumed;
    const boundedRemainder = Math.max(
      -PAGE_STEP / 2,
      Math.min(PAGE_STEP / 2, remainder)
    );

    interaction.velocity = delta - interaction.lastDelta;
    interaction.lastDelta = delta;

    showPage(nextPage, boundedRemainder);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    cancelAnimationFrame(inertiaRef.current);

    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;

    const tappedOffset = Math.round(
      ((event.clientX - centerX) * RTL_PAGE_DIRECTION) / PAGE_STEP
    );

    const tappedPage = clampPage(previewPageRef.current + tappedOffset);

    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      basePage: tappedPage,
      lastDelta: 0,
      velocity: 0,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);

    setInteracting(true);
    showPage(tappedPage, 0);

    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;

    updateFromDelta(event.clientX - interactionRef.current.startX);

    event.preventDefault();
  }

  function commitPage(nextPage) {
    setInteracting(false);
    setDragOffset(0);

    if (nextPage !== page) {
      goPage(nextPage, null, { keepControlsVisible: true });
    }
  }

  function handlePointerUp(event) {
    const interaction = interactionRef.current;
    if (interaction?.pointerId !== event.pointerId) return;

    updateFromDelta(event.clientX - interaction.startX);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const releaseVelocity = Math.max(
      -30,
      Math.min(30, interaction.velocity || 0)
    );

    interactionRef.current = null;

    if (Math.abs(releaseVelocity) < 3.5) {
      commitPage(previewPageRef.current);
      return;
    }

    let frame = 0;
    let velocity = releaseVelocity * 0.65;
    const basePage = previewPageRef.current;
    let virtualDelta = 0;

    function runInertia() {
      frame += 1;
      virtualDelta += velocity;
      velocity *= 0.72;

      const pageOffset = Math.round(
        (virtualDelta * RTL_PAGE_DIRECTION) / PAGE_STEP
      );

      const nextPage = clampPage(basePage + pageOffset);

      const consumed =
        pageOffset * PAGE_STEP * RTL_PAGE_DIRECTION;

      const offset = Math.max(
        -PAGE_STEP / 2,
        Math.min(PAGE_STEP / 2, virtualDelta - consumed)
      );

      showPage(nextPage, offset);

      if (frame < MAX_INERTIA_FRAMES && Math.abs(velocity) > 0.28) {
        inertiaRef.current = requestAnimationFrame(runInertia);
      } else {
        commitPage(previewPageRef.current);
      }
    }

    inertiaRef.current = requestAnimationFrame(runInertia);
  }

  function handlePointerCancel(event) {
    if (interactionRef.current?.pointerId !== event.pointerId) return;

    interactionRef.current = null;
    setInteracting(false);
    showPage(page, 0);
  }

  function handleKeyDown(event) {
    let nextPage = null;

    if (event.key === 'ArrowLeft' || event.key === 'PageDown') {
      nextPage = clampPage(page + 1);
    }

    if (event.key === 'ArrowRight' || event.key === 'PageUp') {
      nextPage = clampPage(page - 1);
    }

    if (event.key === 'Home') nextPage = 1;
    if (event.key === 'End') nextPage = totalPages;

    if (nextPage === null) return;

    event.preventDefault();

    showPage(nextPage, 0);

    if (nextPage !== page) {
      goPage(nextPage, null, { keepControlsVisible: true });
    }
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
      <div className="reader-wave-bars" aria-hidden="true">
        {bars.map((bar) => (
          <span
            key={`${bar.pageNumber}-${bar.x}`}
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
  const meta = getPageMeta(pageNumber);

  const ayahLines = pageData?.lines?.filter((line) => (
    line.surahNumber &&
    line.ayahStart !== null &&
    line.ayahEnd !== null &&
    Number.isFinite(Number(line.ayahStart)) &&
    Number.isFinite(Number(line.ayahEnd))
  )) || [];

  if (!ayahLines.length) {
    return {
      surahLabel: 'Quran',
      rangeLabel: '',
      juzProgress: getCurrentIndoPakJuzProgress(
        pageNumber,
        1,
        1,
        meta.juz
      ),
    };
  }

  const first = ayahLines[0];
  const last = ayahLines[ayahLines.length - 1];

  const firstSurah = getSurah(first.surahNumber);
  const lastSurah = getSurah(last.surahNumber);

  const sameSurah = first.surahNumber === last.surahNumber;
  const firstAyah = Number(first.ayahStart);
  const lastAyah = Number(last.ayahEnd);

  const juzProgress = getCurrentIndoPakJuzProgress(
    pageNumber,
    first.surahNumber,
    firstAyah,
    meta.juz
  );

  if (sameSurah) {
    return {
      surahLabel: firstSurah?.name || `Surah ${first.surahNumber}`,
      rangeLabel:
        firstAyah === lastAyah
          ? `Ayah ${firstAyah}`
          : `Ayahs ${firstAyah}-${lastAyah}`,
      juzProgress,
    };
  }

  return {
    surahLabel:
      `${firstSurah?.name || `Surah ${first.surahNumber}`} - ` +
      `${lastSurah?.name || `Surah ${last.surahNumber}`}`,
    rangeLabel:
      `${first.surahNumber}:${firstAyah} - ` +
      `${last.surahNumber}:${lastAyah}`,
    juzProgress,
  };
}