import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Search, SkipBack, SkipForward, Undo2, X } from 'lucide-react';
import { getHizbLabel } from '../../../utils/quranLabels';
import { PageWaveSlider } from './PageWaveSlider';

export function ReaderBottomControls({ page, displayPage, goPage, onHome, onSearch }) {
  const [audioOpen, setAudioOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      className="reader-bottom-controls"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <motion.button
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="reader-listen-pill"
        onClick={() => setAudioOpen((value) => !value)}
        aria-expanded={audioOpen}
      >
        <span className="reader-listen-play">
          <Play size={22} fill="currentColor" />
        </span>
        <span>Listen to the Holy Qur&apos;an</span>
      </motion.button>

      <AnimatePresence>
        {audioOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="reader-audio-panel"
          >
            <div className="reader-audio-head">
              <div>
                <strong>Holy Qur&apos;an</strong>
                <span>Page {displayPage}</span>
              </div>
              <button onClick={() => setAudioOpen(false)} aria-label="Close audio controls">
                <X size={18} />
              </button>
            </div>

            <div className="reader-audio-actions">
              <button onClick={() => goPage(page - 1)} aria-label="Previous page">
                <SkipBack size={20} />
              </button>
              <button className="reader-audio-main" onClick={() => setPlaying((value) => !value)} aria-label="Play or pause">
                {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              <button onClick={() => goPage(page + 1)} aria-label="Next page">
                <SkipForward size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 42 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 340, damping: 32 }}
        className="reader-bottom-sheet"
      >
        <div className="reader-bottom-meta">
          <span>{displayPage}</span>
          <span>{getHizbLabel(page)}</span>
        </div>

        <PageWaveSlider page={page} goPage={goPage} />

        <div className="reader-bottom-actions">
          <button onClick={onHome} aria-label="Return">
            <Undo2 size={30} strokeWidth={1.8} />
          </button>

          <span>{displayPage}</span>

          <button onClick={onSearch} aria-label="Search">
            <Search size={30} strokeWidth={1.8} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
