import React from 'react';
import { ArrowLeft, Bookmark, Menu, Settings } from 'lucide-react';

export function ReaderTopControls({ visible, onBack, onBookmark, onIndex, onSettings }) {
  return (
    <header
      data-reader-ui
      className={`reader-topbar ${visible ? 'reader-topbar-visible' : ''}`}
    >
      <div className="reader-control-row">
        <button className="reader-back-pill" onClick={onBack} aria-label="Back to home">
          <ArrowLeft size={24} />
        </button>

        <div className="reader-top-actions">
          <button className="reader-top-icon" onClick={onBookmark} aria-label="Bookmark">
            <Bookmark size={30} strokeWidth={1.7} />
          </button>

          <button className="reader-top-icon" onClick={onIndex} aria-label="Index">
            <Menu size={32} strokeWidth={1.7} />
          </button>

          <button className="reader-top-icon" onClick={onSettings} aria-label="Settings">
            <Settings size={30} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </header>
  );
}
