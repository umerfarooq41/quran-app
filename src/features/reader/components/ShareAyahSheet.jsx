import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import { generateQuranShareImage } from '../../../lib/shareCanvas';
import { surahArabicNames } from '../../../utils/quranLabels';
import { BackButton } from '../../../components/common/AppChrome';

const SHARE_BACKGROUND = '#ead8b8';

export function ShareAyahSheet({ ayah, onClose }) {
  const surah = getSurah(ayah.surahNumber);
  const surahAyahs = useMemo(() => getSurahAyahs(ayah.surahNumber), [ayah.surahNumber]);
  const selectedIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === ayah.ayahNumber));
  const fromOptions = useMemo(
    () => getFromOptions(surahAyahs, selectedIndex),
    [surahAyahs, selectedIndex],
  );
  const [fromAyah, setFromAyah] = useState(ayah.ayahNumber);
  const [toAyah, setToAyah] = useState(ayah.ayahNumber);
  const background = SHARE_BACKGROUND;
  const [openRangePicker, setOpenRangePicker] = useState(null);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const [imageBlob, setImageBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [preparingImage, setPreparingImage] = useState(true);

  const fromIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === fromAyah));
  const toOptions = surahAyahs.slice(fromIndex, fromIndex + 10);
  const range = useMemo(
    () => surahAyahs.filter(
      (item) => item.ayahNumber >= fromAyah && item.ayahNumber <= toAyah,
    ),
    [surahAyahs, fromAyah, toAyah],
  );
  const arabicSurahName = surahArabicNames[ayah.surahNumber] || surah?.name || '';
  const selectedReference = fromAyah === toAyah
    ? `${ayah.surahNumber}:${fromAyah}`
    : `${ayah.surahNumber}:${fromAyah}-${toAyah}`;

  useEffect(() => {
    let cancelled = false;

    setStatus('');
    setPreparingImage(true);
    setImageBlob(null);
    generateQuranShareImage({
      surahName: arabicSurahName,
      surahNumber: ayah.surahNumber,
      ayahs: range,
      background,
    })
      .then((blob) => {
        if (!cancelled) setImageBlob(blob);
      })
      .catch((error) => {
        if (!cancelled) setStatus(error?.message || 'Share image could not be generated.');
      })
      .finally(() => {
        if (!cancelled) setPreparingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [arabicSurahName, ayah.surahNumber, range, background]);

  useEffect(() => {
    if (!imageBlob) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(imageBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  function changeFrom(nextValue) {
    const nextFrom = Number(nextValue);
    const nextIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === nextFrom));
    const maxTo = surahAyahs[Math.min(surahAyahs.length - 1, nextIndex + 9)]?.ayahNumber || nextFrom;

    setFromAyah(nextFrom);
    setToAyah((current) => Math.min(maxTo, Math.max(nextFrom, current)));
  }

  async function shareImage() {
    setStatus('');

    try {
      if (!imageBlob) {
        setStatus('Share image is still being prepared.');
        return;
      }

      const file = new File(
        [imageBlob],
        `quran-${ayah.surahNumber}-${fromAyah}-${toAyah}.png`,
        { type: 'image/png' },
      );
      const shareData = {
        title: `${surah?.name || 'Quran'} ${fromAyah}-${toAyah}`,
        files: [file],
      };

      if (!navigator.share) {
        setStatus('Image sharing is not available in this browser.');
        return;
      }

      if (navigator.canShare && !navigator.canShare(shareData)) {
        setStatus('This browser cannot share generated image files.');
        return;
      }

      setSharing(true);
      await navigator.share(shareData);
      setStatus('Share sheet opened');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setStatus(error?.message || 'Share image could not be generated.');
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="share-sheet-backdrop" data-reader-ui onClick={onClose}>
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
        className="share-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="share-sheet-header">
          <BackButton onClick={onClose} label="Back from share" />
          <h2>Share Quran Image</h2>
          <span className="share-header-spacer" aria-hidden="true" />
        </header>

        <section className="share-range-card">
          <h3>Verse range</h3>
          <div className="share-range-selectors">
            <div className="share-range-field">
              <span>From</span>
              <button
                type="button"
                className="share-range-trigger"
                aria-expanded={openRangePicker === 'from'}
                onClick={() => setOpenRangePicker((current) => current === 'from' ? null : 'from')}
              >
                <span>Ayah {fromAyah}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              {openRangePicker === 'from' && (
                <div className="share-range-menu">
                  {fromOptions.map((item) => (
                    <button
                      key={item.ayahNumber}
                      type="button"
                      className={item.ayahNumber === fromAyah ? 'is-selected' : ''}
                      onClick={() => { changeFrom(item.ayahNumber); setOpenRangePicker(null); }}
                    >
                      <span>Ayah {item.ayahNumber}</span>
                      {item.ayahNumber === fromAyah && <Check size={17} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="share-range-field">
              <span>To</span>
              <button
                type="button"
                className="share-range-trigger"
                aria-expanded={openRangePicker === 'to'}
                onClick={() => setOpenRangePicker((current) => current === 'to' ? null : 'to')}
              >
                <span>Ayah {toAyah}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              {openRangePicker === 'to' && (
                <div className="share-range-menu">
                  {toOptions.map((item) => (
                    <button
                      key={item.ayahNumber}
                      type="button"
                      className={item.ayahNumber === toAyah ? 'is-selected' : ''}
                      onClick={() => { setToAyah(item.ayahNumber); setOpenRangePicker(null); }}
                    >
                      <span>Ayah {item.ayahNumber}</span>
                      {item.ayahNumber === toAyah && <Check size={17} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p>Maximum range: 10 ayahs</p>
        </section>

        <div className="quran-share-preview quran-share-generated-preview">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${surah?.name || 'Quran'} ${selectedReference}`}
              className="quran-share-generated-image"
            />
          ) : (
            <div className="quran-share-preview-loading" aria-live="polite">
              Preparing preview…
            </div>
          )}
        </div>

        <button
          type="button"
          className="share-image-button"
          onClick={shareImage}
          disabled={sharing || preparingImage || !imageBlob || range.length === 0}
        >
          <Share2 size={19} />
          {preparingImage ? 'Preparing image…' : sharing ? 'Sharing…' : 'Share'}
        </button>

        {status && <p className="share-sheet-status">{status}</p>}
      </motion.section>
    </div>
  );
}

function getFromOptions(ayahs, selectedIndex) {
  if (selectedIndex < 4) {
    return ayahs.slice(selectedIndex, selectedIndex + 10);
  }

  let start = selectedIndex - 4;
  if (start + 10 > ayahs.length) {
    start = Math.max(0, ayahs.length - 10);
  }

  return ayahs.slice(start, start + 10);
}

function cleanAyahText(text = '') {
  return String(text)
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}
