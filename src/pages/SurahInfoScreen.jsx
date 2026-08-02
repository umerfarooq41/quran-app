import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getSurah, getSurahInfo } from '../lib/quran';
import { parseQuranInternalHref, sanitizeSurahHtml } from '../lib/sanitizeHtml';
import { BackButton } from '../components/common/AppChrome';

export default function SurahInfoScreen() {
  const selectedSurah = useAppStore((state) => state.selectedSurah);
  const closeSurahInfo = useAppStore((state) => state.closeSurahInfo);
  const goAyah = useAppStore((state) => state.goAyah);
  const translationId = useAppStore((state) => state.settings.translation);
  const translationLanguage = String(translationId || '').startsWith('en-') ? 'en' : 'ur';
  const surah = getSurah(selectedSurah);
  const localizedInfo = getSurahInfo(selectedSurah, translationLanguage);
  const cleanHtml = useMemo(() => sanitizeSurahHtml(localizedInfo?.text || ''), [localizedInfo?.text]);

  function handleContentClick(event) {
    const link = event.target.closest('a[data-quran-link]');
    if (!link) return;

    const reference = parseQuranInternalHref(link.getAttribute('href'));
    if (!reference) return;

    event.preventDefault();
    goAyah(
      reference.surahNumber,
      reference.ayahNumber,
      findPageForReference(reference.surahNumber, reference.ayahNumber),
    );
  }

  return (
    <main className="surah-info-screen">
      <header className="surah-info-topbar">
        <BackButton onClick={closeSurahInfo} label="Back from Surah info" />
        <h1>Surah Info</h1>
        <span className="surah-info-header-spacer" aria-hidden="true" />
      </header>

      <section className="surah-info-content">
        <div className="surah-info-title-row">
          <div>
            <p className="surah-info-kicker">Surah {surah?.number}</p>
            <h2>{surah?.name}</h2>
            <p className="surah-info-meta">{surah?.verses} ayahs · {surah?.revelation} · Juz {surah?.juz}</p>
          </div>
          <span className="surah-info-icon" aria-hidden="true"><BookOpen size={24} /></span>
        </div>

        {cleanHtml ? (
          <div
            className="surah-info-html"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        ) : (
          <p className="surah-info-empty">Surah information will be expanded in the next design pass.</p>
        )}
      </section>
    </main>
  );
}
