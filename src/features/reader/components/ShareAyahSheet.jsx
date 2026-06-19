import React, { useEffect, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import { generateQuranShareImage } from '../../../lib/shareCanvas';
import { surahArabicNames } from '../../../utils/quranLabels';
import { BackButton } from '../../../components/common/AppChrome';

const BACKGROUNDS = [
  { id: 'sand', color: '#ead8b8', label: 'Sand' },
  { id: 'sage', color: '#cddccf', label: 'Sage' },
  { id: 'sky', color: '#cbddea', label: 'Sky' },
  { id: 'rose', color: '#ead0d0', label: 'Rose' },
  { id: 'slate', color: '#ccd0d8', label: 'Slate' },
];

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
  const [background, setBackground] = useState(BACKGROUNDS[0].color);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const [imageBlob, setImageBlob] = useState(null);
  const [preparingImage, setPreparingImage] = useState(true);

  const fromIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === fromAyah));
  const toOptions = surahAyahs.slice(fromIndex, fromIndex + 10);
  const range = useMemo(
    () => surahAyahs.filter(
      (item) => item.ayahNumber >= fromAyah && item.ayahNumber <= toAyah,
    ),
    [surahAyahs, fromAyah, toAyah],
  );
  const previewFont = range.length >= 8
    ? '.68rem'
    : range.length >= 5
      ? '.82rem'
      : range.length >= 3
        ? '1rem'
        : '1.25rem';
  const arabicSurahName = `سُورَةُ ${surahArabicNames[ayah.surahNumber] || surah?.name || ''}`;

  useEffect(() => {
    let cancelled = false;

    setStatus('');
    setPreparingImage(true);
    setImageBlob(null);
    generateQuranShareImage({
      surahName: arabicSurahName,
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
  }, [arabicSurahName, range, background]);

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
          <div>
            <p>Share Quran image</p>
            <h2>{surah?.name}</h2>
          </div>
          <span className="share-header-spacer" aria-hidden="true" />
        </header>

        <section className="share-range-card">
          <h3>Verse range</h3>
          <div className="share-range-selectors">
            <label>
              <span>From</span>
              <select value={fromAyah} onChange={(event) => changeFrom(event.target.value)}>
                {fromOptions.map((item) => (
                  <option key={item.ayahNumber} value={item.ayahNumber}>
                    Ayah {item.ayahNumber}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>To</span>
              <select value={toAyah} onChange={(event) => setToAyah(Number(event.target.value))}>
                {toOptions.map((item) => (
                  <option key={item.ayahNumber} value={item.ayahNumber}>
                    Ayah {item.ayahNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>Maximum range: 10 ayahs</p>
        </section>

        <section className="share-background-picker">
          <h3>Background</h3>
          <div>
            {BACKGROUNDS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={background === option.color ? 'is-active' : ''}
                style={{ '--share-color': option.color }}
                onClick={() => setBackground(option.color)}
                aria-label={option.label}
              />
            ))}
          </div>
        </section>

        <div
          className="quran-share-preview"
          style={{
            '--share-background': background,
            '--share-preview-font': previewFont,
          }}
        >
          <div className="quran-share-frame">
            <h3 dir="rtl">{arabicSurahName}</h3>
            <div className="quran-share-divider"><span /></div>
            <div className="quran-share-ayahs" dir="rtl">
              {range.map((item) => (
                <p key={item.ayahNumber}>
                  {cleanAyahText(item.text)}
                  <span> ۝ {toArabicNumber(item.ayahNumber)}</span>
                </p>
              ))}
            </div>
            <footer>Quran App</footer>
          </div>
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
