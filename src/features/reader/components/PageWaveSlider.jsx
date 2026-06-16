import React, { useState } from 'react';
import { getPageMeta, totalPages } from '../../../lib/quran';

export function PageWaveSlider({ page, goPage }) {
  const [dragPage, setDragPage] = useState(page);
  const [dragging, setDragging] = useState(false);
  const previewMeta = getPageMeta(dragPage || page);
  const bars = Array.from({ length: 33 }, (_, index) => {
    const center = 16;
    const distance = Math.abs(index - center);
    const height = Math.max(9, 35 - distance * 1.35);
    const opacity = Math.max(0.18, 1 - distance * 0.045);

    return { height, opacity };
  });

  function commit(nextPage) {
    const value = Number(nextPage) || page;
    setDragPage(value);
    goPage(value);
  }

  return (
    <div className="reader-wave-slider">
      {dragging && (
        <div className="reader-wave-tooltip">
          {previewMeta?.surah?.name || 'Qur’an'} / {dragPage}/{totalPages}
        </div>
      )}

      <div className="reader-wave-bars" aria-hidden="true">
        {bars.map((bar, index) => (
          <span
            key={index}
            style={{
              height: `${bar.height}px`,
              opacity: bar.opacity,
            }}
          />
        ))}
      </div>

      <div className="reader-wave-marker" aria-hidden="true" />

      <input
        aria-label="Page"
        type="range"
        min="1"
        max={totalPages}
        value={dragging ? dragPage : page}
        onPointerDown={() => {
          setDragPage(page);
          setDragging(true);
        }}
        onPointerUp={(event) => {
          setDragging(false);
          commit(event.currentTarget.value);
        }}
        onPointerCancel={() => setDragging(false)}
        onChange={(event) => setDragPage(Number(event.target.value))}
      />
    </div>
  );
}
