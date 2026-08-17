import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSurah, getSurahAyahs, surahs } from '../../../lib/quran';
import {
  getTranslationOption,
  loadTranslationEntry,
  prefetchTranslationEntry,
} from '../../../lib/translations';
import { useAppStore } from '../../../store/useAppStore';
import { WordByWordTranslation } from './WordByWordTranslation';

const MISSING_TRANSLATION = 'Translation not available.';

export function AyahTranslationCard({ target, translationId, onClose }) {
  const wordByWordEnabled = useAppStore((state) => state.settings.wordByWordTranslation);
  const wordByWordLanguage = useAppStore((state) => state.settings.wordByWordLanguage);
  const [activeTarget, setActiveTarget] = useState(() => normalizeTarget(target));
  const [translation, setTranslation] = useState({ plainText: '', parts: [], footnotes: [] });
  const [translationLoaded, setTranslationLoaded] = useState(false);
  const [footnotesOpen, setFootnotesOpen] = useState(false);
  const bodyRef = useRef(null);
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

  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTarget?.surahNumber, activeTarget?.ayahNumber]);

  useEffect(() => {
    let mounted = true;

    if (!activeTarget?.surahNumber || !activeTarget?.ayahNumber) return undefined;

    const { surahNumber, ayahNumber } = activeTarget;
    setTranslation({ plainText: '', parts: [], footnotes: [] });
    setTranslationLoaded(false);
    setFootnotesOpen(false);

    // Show the selected translation as soon as it is ready. Matching tafsir is
    // loaded in parallel and merged later, so optional tafsir never blocks the
    // translation card.
    loadTranslationEntry(translationId, surahNumber, ayahNumber, {
      includeTafsir: false,
    })
      .then((entry) => {
        if (!mounted) return;
        setTranslation(entry || { plainText: '', parts: [], footnotes: [] });
        setTranslationLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setTranslation({ plainText: '', parts: [], footnotes: [] });
        setTranslationLoaded(true);
      });

    // This shares the same chapter-level translation request and separately
    // preloads the matching tafsir chapter. When it resolves, replace the card
    // entry only if this ayah is still active.
    loadTranslationEntry(translationId, surahNumber, ayahNumber, {
      includeTafsir: true,
    })
      .then((entry) => {
        if (mounted && entry) setTranslation(entry);
      })
      .catch(() => {
        // Translation-only content remains visible when tafsir is unavailable.
      });

    return () => {
      mounted = false;
    };
  }, [activeTarget?.surahNumber, activeTarget?.ayahNumber, translationId]);

  useEffect(() => {
    if (!activeTarget?.surahNumber || !activeTarget?.ayahNumber) return;

    // Warm both directions after every navigation. Requests are deduplicated at
    // chapter level, so moving between ayahs in the same Surah is instant and a
    // Surah-boundary move starts loading the neighbouring chapter beforehand.
    [previousTarget, nextTarget].filter(Boolean).forEach((targetToPrefetch) => {
      prefetchTranslationEntry(
        translationId,
        targetToPrefetch.surahNumber,
        targetToPrefetch.ayahNumber,
        { includeTafsir: true },
      );
    });
  }, [
    activeTarget?.surahNumber,
    activeTarget?.ayahNumber,
    previousTarget?.surahNumber,
    previousTarget?.ayahNumber,
    nextTarget?.surahNumber,
    nextTarget?.ayahNumber,
    translationId,
  ]);


  if (!activeTarget) return null;

  function moveTo(nextTarget) {
    if (!nextTarget) return;

    // Reset immediately before changing the ayah. The keyed body below then
    // mounts a fresh scroll container at scrollTop 0, so a long tafsir from
    // the previous ayah can never leave the next ayah visually blank.
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
      bodyRef.current.scrollLeft = 0;
    }
    setFootnotesOpen(false);
    setActiveTarget(nextTarget);
  }

  return (
    <div className="ayah-translation-backdrop" data-reader-ui onClick={onClose}>
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: .9 }}
        className={wordByWordEnabled ? 'ayah-translation-card has-word-by-word' : 'ayah-translation-card'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayah-translation-reference"
        onClick={(event) => event.stopPropagation()}
      >
        <header id="ayah-translation-reference" className="ayah-translation-header">
          {reference}
        </header>

        <div
          key={`${activeTarget.surahNumber}:${activeTarget.ayahNumber}`}
          ref={bodyRef}
          className="ayah-translation-body"
          data-translation-language={translationOption.language || 'En'}
        >
          <p className="ayah-translation-arabic" dir="rtl">
            {ayah?.text || ''}
          </p>

          <WordByWordTranslation
            surahNumber={activeTarget.surahNumber}
            ayahNumber={activeTarget.ayahNumber}
            enabled={wordByWordEnabled}
            language={wordByWordLanguage}
          />

          <p className="ayah-translation-text" dir={translationOption.direction || 'ltr'}>
            {translationLoaded
              ? renderTranslationText(translation, () => setFootnotesOpen(true))
              : ''}
          </p>

          {translationLoaded && translation.footnotes?.length > 0 && (
            <div className="ayah-translation-footnote-wrap" dir={translationOption.direction || 'ltr'}>
              <button
                type="button"
                className="ayah-translation-footnote-toggle"
                aria-expanded={footnotesOpen}
                onClick={() => setFootnotesOpen((open) => !open)}
              >
                <span>{footnotesOpen ? 'Hide Tafsir' : getNotesButtonLabel()}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>

              {footnotesOpen && (
                <div className="ayah-translation-footnotes">
                  {translation.footnotes?.length > 0 && (
                    <section className="ayah-translation-note-section">
                      {translation.footnotes.map((footnote) => (
                        <p key={footnote.id} className="ayah-translation-note-row">
                          <span className="ayah-translation-note-number">{footnote.number}</span>
                          <span className="ayah-translation-note-content">{footnote.text}</span>
                        </p>
                      ))}
                    </section>
                  )}
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


function renderTranslationText(translation, onFootnoteOpen) {
  const parts = Array.isArray(translation?.parts) ? translation.parts : [];

  if (!parts.length) return translation?.plainText || MISSING_TRANSLATION;

  return parts.map((part, index) => {
    if (part.type === 'footnote') {
      return (
        <button
          type="button"
          key={`${part.id || 'footnote'}-${index}`}
          className="ayah-translation-inline-footnote"
          aria-label={`Open footnote ${part.number}`}
          onClick={onFootnoteOpen}
        >
          {part.number}
        </button>
      );
    }

    return <React.Fragment key={`text-${index}`}>{part.text} </React.Fragment>;
  });
}

function getNotesButtonLabel() {
  return 'Show Tafsir';
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
