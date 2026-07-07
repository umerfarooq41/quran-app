import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSurah, getSurahAyahs, surahs } from '../../../lib/quran';
import { getTranslationOption, loadTranslationEntry } from '../../../lib/translations';

const MISSING_TRANSLATION = 'Translation not available.';

export function AyahTranslationCard({ target, translationId, onClose }) {
  const [activeTarget, setActiveTarget] = useState(() => normalizeTarget(target));
  const [translation, setTranslation] = useState({ plainText: '', footnotes: [] });
  const [translationLoaded, setTranslationLoaded] = useState(false);
  const [footnotesOpen, setFootnotesOpen] = useState(false);
  const ayah = useMemo(() => getAyah(activeTarget), [
    activeTarget?.surahNumber,
    activeTarget?.ayahNumber,
  ]);
  const reference = formatCardReference(activeTarget);
  const translationOption = getTranslationOption(translationId);
  const previousTarget = useMemo(() => getAdjacentAyahTarget(activeTarget, -1), [
    activeTarget?.surahNumber,
    activeTarget?.ayahNumber,
  ]);
  const nextTarget = useMemo(() => getAdjacentAyahTarget(activeTarget, 1), [
    activeTarget?.surahNumber,
    activeTarget?.ayahNumber,
  ]);

  useEffect(() => {
    setActiveTarget(normalizeTarget(target));
  }, [target?.surahNumber, target?.ayahNumber]);

  useEffect(() => {
    let mounted = true;

    if (!activeTarget?.surahNumber || !activeTarget?.ayahNumber) return undefined;

    setTranslation({ plainText: '', footnotes: [] });
    setTranslationLoaded(false);
    setFootnotesOpen(false);

    loadTranslationEntry(translationId, activeTarget.surahNumber, activeTarget.ayahNumber)
      .then((entry) => {
        if (mounted) setTranslation(entry || { plainText: '', footnotes: [] });
      })
      .catch(() => {
        if (mounted) setTranslation({ plainText: '', footnotes: [] });
      })
      .finally(() => {
        if (mounted) setTranslationLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [activeTarget?.surahNumber, activeTarget?.ayahNumber, translationId]);

  if (!activeTarget) return null;

  function moveTo(nextTarget) {
    if (nextTarget) setActiveTarget(nextTarget);
  }

  return (
    <div className="ayah-translation-backdrop" data-reader-ui onClick={onClose}>
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: .9 }}
        className="ayah-translation-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayah-translation-reference"
        onClick={(event) => event.stopPropagation()}
      >
        <header id="ayah-translation-reference" className="ayah-translation-header">
          {reference}
        </header>

        <div className="ayah-translation-body" data-translation-language={translationOption.language || 'En'}>
          <p className="ayah-translation-arabic" dir="rtl">
            {ayah?.text || ''}
          </p>

          <p className="ayah-translation-text" dir={translationOption.direction || 'ltr'}>
            {translationLoaded ? (translation.plainText || MISSING_TRANSLATION) : ''}
          </p>

          {translationLoaded && translation.footnotes?.length > 0 && (
            <div className="ayah-translation-footnote-wrap" dir={translationOption.direction || 'ltr'}>
              <button
                type="button"
                className="ayah-translation-footnote-toggle"
                aria-expanded={footnotesOpen}
                onClick={() => setFootnotesOpen((open) => !open)}
              >
                <span>{footnotesOpen ? 'Hide footnotes' : `Show footnotes (${translation.footnotes.length})`}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>

              {footnotesOpen && (
                <div className="ayah-translation-footnotes">
                  {translation.footnotes.map((footnote) => (
                    <p key={footnote.id}>
                      <span>{footnote.number}</span>
                      {footnote.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="ayah-translation-footer">
          <button
            type="button"
            onClick={() => moveTo(previousTarget)}
            disabled={!previousTarget}
          >
            <ChevronLeft size={17} aria-hidden="true" />
            <span>Previous Ayah</span>
          </button>
          <button
            type="button"
            onClick={() => moveTo(nextTarget)}
            disabled={!nextTarget}
          >
            <span>Next Ayah</span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </footer>
      </motion.section>
    </div>
  );
}

function normalizeTarget(target) {
  const surahNumber = Number(target?.surahNumber);
  const ayahNumber = Number(target?.ayahNumber);

  if (!surahNumber || !ayahNumber) return null;

  return { surahNumber, ayahNumber };
}

function getAyah(target) {
  if (!target) return null;

  return getSurahAyahs(target.surahNumber)
    .find((item) => item.ayahNumber === target.ayahNumber) || null;
}

function formatCardReference(target) {
  if (!target) return '';

  const surah = getSurah(target.surahNumber);
  return `${surah?.name || 'Surah'} ${target.surahNumber}:${target.ayahNumber}`;
}

function getAdjacentAyahTarget(target, direction) {
  if (!target) return null;

  const surahNumber = Number(target.surahNumber);
  const ayahNumber = Number(target.ayahNumber);
  const ayahs = getSurahAyahs(surahNumber);
  const currentIndex = ayahs.findIndex((item) => item.ayahNumber === ayahNumber);

  if (direction < 0) {
    if (currentIndex > 0) {
      return { surahNumber, ayahNumber: ayahs[currentIndex - 1].ayahNumber };
    }

    for (let nextSurah = surahNumber - 1; nextSurah >= 1; nextSurah -= 1) {
      const previousSurahAyahs = getSurahAyahs(nextSurah);
      const previousAyah = previousSurahAyahs.at(-1);
      if (previousAyah) {
        return { surahNumber: nextSurah, ayahNumber: previousAyah.ayahNumber };
      }
    }

    return null;
  }

  if (currentIndex >= 0 && currentIndex < ayahs.length - 1) {
    return { surahNumber, ayahNumber: ayahs[currentIndex + 1].ayahNumber };
  }

  for (let nextSurah = surahNumber + 1; nextSurah <= surahs.length; nextSurah += 1) {
    const nextSurahAyahs = getSurahAyahs(nextSurah);
    const nextAyah = nextSurahAyahs[0];
    if (nextAyah) {
      return { surahNumber: nextSurah, ayahNumber: nextAyah.ayahNumber };
    }
  }

  return null;
}
