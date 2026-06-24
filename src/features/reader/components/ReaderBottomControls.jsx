import React from 'react';
import { motion } from 'framer-motion';
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
{!compact && (
        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
        initial={{ opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 42 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 340, damping: 32 }}
        className="reader-bottom-sheet"
      >
        <div className="reader-bottom-meta">
          <span>{displayPage}</span>
          <span>{juzProgress}</span>
        </div>

        <PageWaveSlider
          page={page}
          goPage={goPage}
          onPreviewChange={onPreviewPageChange}
          onInteractionChange={onSliderInteractionChange}
        />

        <div className="reader-bottom-actions">
          <button onClick={onPreviousPage} aria-label="Previous reader page">
            <Undo2 size={34} strokeWidth={1.8} />
          </button>

          <span>{displayPage}</span>

          <button onClick={onSearch} aria-label="Search">
            <Search size={34} strokeWidth={1.8} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
