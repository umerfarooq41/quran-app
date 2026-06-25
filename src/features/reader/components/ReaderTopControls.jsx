import React from 'react';
import { Bookmark, Menu, Settings } from 'lucide-react';
import { BackButton } from '../../../components/common/AppChrome';

export function ReaderTopControls({ visible, onBack, onBookmarks, onIndex, onSettings, onChromeTap }) {
  return (
    <header
      data-reader-ui
      className={`reader-topbar ${visible ? 'reader-topbar-visible' : ''}`}
      onClick={(event) => {
        if (event.target.closest('button')) return;
        onChromeTap?.();
      }}
    >
      <div className="reader-control-row">
        <BackButton className="reader-back-pill" onClick={onBack} />

        <div className="reader-top-actions">
          <button className="reader-top-icon" onClick={onBookmarks} aria-label="Open library">
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
