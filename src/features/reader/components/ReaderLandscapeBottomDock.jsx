import React, { useEffect, useState } from 'react';
import { Play, Search, Undo2 } from 'lucide-react';
import { PageWaveSlider } from './PageWaveSlider';

export function ReaderLandscapeBottomDock({
  page,
  displayPage,
  goPage,
  onPreviousPage,
  onSearch,
  onAudio,
  progress,
  onPreviewPageChange,
  onSliderInteractionChange,
  onChromeTap,
}) {
  const [preview, setPreview] = useState(null);

  useEffect(() => () => {
    onPreviewPageChange?.(null);
    onSliderInteractionChange?.(false);
  }, [onPreviewPageChange, onSliderInteractionChange]);

  function handlePreview(nextPreview) {
    setPreview(nextPreview);
    onPreviewPageChange?.(nextPreview?.page ?? null);
    onSliderInteractionChange?.(Boolean(nextPreview));
  }

  return (
    <div
      className="reader-landscape-bottom-controls"
      data-reader-ui
      onClick={(event) => {
        if (event.target.closest('button, input, [role="slider"]')) return;
        onChromeTap?.();
      }}
    >
      {preview && (
        <div className="reader-wave-tooltip reader-landscape-wave-tooltip" role="status">
          <strong>{preview.surahLabel}</strong>
          {preview.rangeLabel && <span>{preview.rangeLabel}</span>}
          <span>Page {preview.page}</span>
        </div>
      )}

      <div className="reader-landscape-dock-meta" aria-hidden="true">
        <span>{preview?.page ?? displayPage}</span>
        <span>{preview?.juzProgress ?? progress}</span>
      </div>

      <button type="button" onClick={onPreviousPage} aria-label="Previous reader page">
        <Undo2 size={21} strokeWidth={1.9} />
      </button>

      <div className="reader-landscape-wave-wrap">
        <PageWaveSlider page={page} goPage={goPage} onPreviewChange={handlePreview} />
      </div>

      <button type="button" onClick={onSearch} aria-label="Search">
        <Search size={21} strokeWidth={1.9} />
      </button>

      <button type="button" onClick={onAudio} aria-label="Play Quran audio">
        <Play size={21} fill="currentColor" strokeWidth={1.7} />
      </button>
    </div>
  );
}
