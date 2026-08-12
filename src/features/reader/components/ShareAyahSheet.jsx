import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Share2 } from 'lucide-react';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import { generateQuranShareImage } from '../../../lib/shareCanvas';
import { surahArabicNames } from '../../../utils/quranLabels';
import { Header, Screen } from '../../../components/common/AppChrome';

const SHARE_BACKGROUND = '#ead8b8';

export function ShareQuranScreen({ ayah, onClose }) {
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
    <Screen className="share-quran-screen app-page-shell bg-fluent">
      <div className="app-fixed-header">
        <Header title="Share Quran" onBack={onClose} backLabel="Back from Share Quran" />
      </div>

      <div className="app-scroll-content share-quran-page-content" data-reader-ui>
        <section className="share-range-card">
          <h3>Verse range</h3>
          <div className="share-range-selectors">
            <RangeField
              label="From"
              value={fromAyah}
              options={fromOptions}
              open={openRangePicker === 'from'}
              onToggle={() => setOpenRangePicker((current) => current === 'from' ? null : 'from')}
              onSelect={(nextValue) => {
                changeFrom(nextValue);
                setOpenRangePicker(null);
              }}
            />

            <RangeField
              label="To"
              value={toAyah}
              options={toOptions}
              open={openRangePicker === 'to'}
              onToggle={() => setOpenRangePicker((current) => current === 'to' ? null : 'to')}
              onSelect={(nextValue) => {
                setToAyah(Number(nextValue));
                setOpenRangePicker(null);
              }}
            />
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
      </div>
    </Screen>
  );
}

function RangeField({ label, value, options, open, onToggle, onSelect }) {
  return (
    <div className="share-range-field">
      <span>{label}</span>
      <button
        type="button"
        className="share-range-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Ayah {value}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="share-range-menu">
          {options.map((item) => (
            <button
              key={item.ayahNumber}
              type="button"
              className={item.ayahNumber === value ? 'is-selected' : ''}
              onClick={() => onSelect(item.ayahNumber)}
            >
              <span>Ayah {item.ayahNumber}</span>
              {item.ayahNumber === value && <Check size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
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
