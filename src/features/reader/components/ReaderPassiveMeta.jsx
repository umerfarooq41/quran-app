import React from 'react';
import { getHizbLabel, getJuzLabel } from '../../../utils/quranLabels';

export function ReaderPassiveHeader({ meta }) {
  return (
    <div className="reader-passive-header" aria-hidden="true">
      <span className="reader-meta-label reader-meta-surah">{meta.surah.name}</span>
      <span className="reader-meta-label reader-meta-juz">'{getJuzLabel(meta.juz)}</span>
    </div>
  );
}

export function ReaderFooterMeta({ page, displayPage }) {
  return (
    <div className="reader-footer-meta" aria-hidden="true">
      <span className="reader-meta-label reader-meta-page">{displayPage}</span>
      <span className="reader-meta-label reader-meta-rub">{getHizbLabel(page)}</span>
    </div>
  );
}
