import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Search, Undo2 } from 'lucide-react';
import { PageWaveSlider } from './PageWaveSlider';

export function ReaderBottomControls({
  page,
  displayPage,
  goPage,
  onPreviousPage,
  onSearch,
  onAudio,
  compact = false,
  juzProgress,
  onChromeTap,
  onPreviewPageChange,
  onSliderInteractionChange,
}) {
  const reduceMotion = useReducedMotion();
  const [sliderPreview, setSliderPreview] = useState(null);
  const footerPage = sliderPreview?.page ?? displayPage;
  const footerProgress = sliderPreview?.juzProgress ?? juzProgress;
  const tooltip = useMemo(() => sliderPreview, [sliderPreview]);

  useEffect(() => () => {
    onPreviewPageChange?.(null);
    onSliderInteractionChange?.(false);
  }, [onPreviewPageChange, onSliderInteractionChange]);

  function handleSliderPreviewChange(preview) {
    setSliderPreview(preview);
    onPreviewPageChange?.(preview?.page ?? null);
    onSliderInteractionChange?.(Boolean(preview));
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      data-reader-ui
      className="reader-bottom-controls"
      onClick={(event) => {
        if (event.target.closest('button, input, [role="slider"]')) return;
        onChromeTap?.();
      }}
    >
      {tooltip && (
        <div className="reader-wave-tooltip reader-wave-tooltip--floating" role="status">
          <strong>{tooltip.surahLabel}</strong>
          {tooltip.rangeLabel && <span>{tooltip.rangeLabel}</span>}
          <span>Page {tooltip.page}</span>
        </div>
      )}

      {!compact && (
        <motion.button
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="reader-listen-pill"
          onClick={onAudio}
        >
          <span className="reader-listen-play">
            <Play size={26} fill="currentColor" />
          </span>
          <span>Listen to the Holy Qur&apos;an</span>
        </motion.button>
      )}

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="reader-bottom-sheet"
      >
        <div className="reader-bottom-meta">
          <span>{footerPage}</span>
          <span>{footerProgress}</span>
        </div>

        <PageWaveSlider page={page} goPage={goPage} onPreviewChange={handleSliderPreviewChange} />

        <div className="reader-bottom-actions">
          <button onClick={onPreviousPage} aria-label="Previous reader page">
            <Undo2 size={34} strokeWidth={1.8} />
          </button>


          <button onClick={onSearch} aria-label="Search" style={{ marginInlineStart: 'auto' }}>
            <Search size={34} strokeWidth={1.8} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
