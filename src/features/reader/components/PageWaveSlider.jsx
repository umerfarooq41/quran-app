import React from 'react';
import { totalPages } from '../../../lib/quran';

export function PageWaveSlider({ page, goPage }) {
  const bars = Array.from({ length: 33 }, (_, index) => {
    const center = 16;
    const distance = Math.abs(index - center);
    const height = Math.max(9, 35 - distance * 1.35);
    const opacity = Math.max(0.18, 1 - distance * 0.045);

    return { height, opacity };
  });

  return (
    <div className="reader-wave-slider">
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
        value={page}
        onChange={(e) => goPage(Number(e.target.value))}
      />
    </div>
  );
}
