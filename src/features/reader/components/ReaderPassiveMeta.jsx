import React from 'react';
import { getHizbLabel } from '../../../utils/quranLabels';

export function ReaderPassiveHeader({ meta, displayPage }) {
  return (
    <div className="reader-passive-header pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8">
      <span>{meta.surah.name}</span>
      <span>{displayPage}</span>
    </div>
  );
}

export function ReaderFooterMeta({ page, displayPage }) {
  return (
    <div className="reader-footer-meta pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-between px-8">
      <span>{displayPage}</span>
      <span>{getHizbLabel(page)}</span>
    </div>
  );
}
