import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Headphones,
  Image as ImageIcon,
  Palette,
  Type,
  Volume2,
} from 'lucide-react';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import { getSurahNameMeta } from '../../../data/surahNames';
import { generateQuranShareImage } from '../../../lib/shareCanvas';
import { getReciterImageUrl, normalizeLocalReciters } from '../../../lib/localAudio';
import {
  SHARE_BACKGROUND_ASSETS,
  SHARE_MEDIA_MODES,
  SHARE_MEDIA_TABS,
  buildShareComposition,
  findShareAyahAtTime,
  loadShareVideoTimeline,
} from '../../../lib/shareMedia';
import { surahArabicNames } from '../../../utils/quranLabels';
import { Header, Screen } from '../../../components/common/AppChrome';


export function ShareQuranScreen({ ayah, onClose }) {
  const surah = getSurah(ayah.surahNumber);
  const surahMeta = getSurahNameMeta(ayah.surahNumber);
  const surahAyahs = useMemo(() => getSurahAyahs(ayah.surahNumber), [ayah.surahNumber]);
  const selectedIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === ayah.ayahNumber));
  const fromOptions = useMemo(() => getFromOptions(surahAyahs, selectedIndex), [surahAyahs, selectedIndex]);
  const reciters = useMemo(() => normalizeLocalReciters(), []);

  const [mode, setMode] = useState(SHARE_MEDIA_MODES.IMAGE);
  const [activeTab, setActiveTab] = useState('background');
  const [fromAyah, setFromAyah] = useState(ayah.ayahNumber);
  const [toAyah, setToAyah] = useState(ayah.ayahNumber);
  const [openRangePicker, setOpenRangePicker] = useState(null);
  const [selectedReciter, setSelectedReciter] = useState(reciters[0]?.id || '');
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(
    SHARE_BACKGROUND_ASSETS[0]?.id || '',
  );
  const [orientation, setOrientation] = useState('portrait');
  const [textScale, setTextScale] = useState(1);
  const [status, setStatus] = useState('');

  const [imageBlob, setImageBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [preparingImage, setPreparingImage] = useState(true);

  const [videoTimeline, setVideoTimeline] = useState(null);
  const [videoTimelineStatus, setVideoTimelineStatus] = useState('');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoElapsedMs, setVideoElapsedMs] = useState(0);

  const audioRef = useRef(null);
  const rafRef = useRef(0);

  const fromIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === fromAyah));
  const toOptions = surahAyahs.slice(fromIndex, fromIndex + 10);
  const range = useMemo(
    () => surahAyahs.filter((item) => item.ayahNumber >= fromAyah && item.ayahNumber <= toAyah),
    [surahAyahs, fromAyah, toAyah],
  );

  const arabicSurahName = surahArabicNames[ayah.surahNumber] || surah?.name || '';
  const selectedBackground = useMemo(
    () => SHARE_BACKGROUND_ASSETS.find((item) => item.id === selectedBackgroundId) || null,
    [selectedBackgroundId],
  );
  const selectedReciterMeta = useMemo(
    () => reciters.find((item) => item.id === selectedReciter) || reciters[0] || null,
    [reciters, selectedReciter],
  );

  const composition = useMemo(() => buildShareComposition({
    mode,
    surahNumber: ayah.surahNumber,
    fromAyah,
    toAyah,
    backgroundAsset: selectedBackground,
    orientation,
    reciterId: selectedReciter,
    showTranslation: false,
    translationId: null,
    style: {
      textColor: '#ffffff',
      overlayOpacity: 0.42,
      alignment: 'center',
      textScale,
    },
  }), [
    mode,
    ayah.surahNumber,
    fromAyah,
    toAyah,
    selectedBackground,
    orientation,
    selectedReciter,
    textScale,
  ]);

  const activeVideoEntry = useMemo(
    () => findShareAyahAtTime(videoTimeline?.timeline, videoElapsedMs),
    [videoTimeline, videoElapsedMs],
  );
  const activeVideoAyah = useMemo(() => {
    const ayahNumber = Number(activeVideoEntry?.ayahNumber) || fromAyah;
    return surahAyahs.find((item) => item.ayahNumber === ayahNumber) || range[0] || ayah;
  }, [activeVideoEntry, fromAyah, surahAyahs, range, ayah]);

  useEffect(() => {
    let cancelled = false;
    setStatus('');
    setPreparingImage(true);
    setImageBlob(null);

    generateQuranShareImage({
      surahName: arabicSurahName,
      surahNumber: ayah.surahNumber,
      ayahs: range,
      surahMeaning: surahMeta?.meaning || '',
      orientation,
      textScale,
      backgroundAsset: selectedBackground,
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
  }, [arabicSurahName, ayah.surahNumber, range, surahMeta?.meaning, orientation, textScale, selectedBackground]);

  useEffect(() => {
    if (!imageBlob) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  useEffect(() => {
    let cancelled = false;
    setVideoTimeline(null);
    setVideoElapsedMs(0);
    setVideoTimelineStatus(mode === SHARE_MEDIA_MODES.VIDEO ? 'Preparing audio timeline…' : '');

    if (mode !== SHARE_MEDIA_MODES.VIDEO) return undefined;

    loadShareVideoTimeline(composition)
      .then((timeline) => {
        if (cancelled) return;
        setVideoTimeline(timeline);
        setVideoTimelineStatus(timeline ? '' : 'This reciter has no full-Surah timing data.');
      })
      .catch((error) => {
        if (!cancelled) setVideoTimelineStatus(error?.message || 'Audio timeline unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [composition, mode]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  function changeFrom(nextValue) {
    const nextFrom = Number(nextValue);
    const nextIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === nextFrom));
    const maxTo = surahAyahs[Math.min(surahAyahs.length - 1, nextIndex + 9)]?.ayahNumber || nextFrom;
    setFromAyah(nextFrom);
    setToAyah((current) => Math.min(maxTo, Math.max(nextFrom, current)));
  }

  function stopVideoPreview() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (audioRef.current) audioRef.current.pause();
    setVideoPlaying(false);
  }

  async function toggleVideoPreview() {
    if (!videoTimeline?.audioUrl || !videoTimeline.timeline?.length) {
      setStatus('Video preview needs a reciter with full-Surah timing data.');
      return;
    }

    if (videoPlaying) {
      stopVideoPreview();
      return;
    }

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    if (audio.src !== videoTimeline.audioUrl) {
      audio.src = videoTimeline.audioUrl;
      audio.crossOrigin = 'anonymous';
    }

    const sourceStartSeconds = videoTimeline.sourceStartMs / 1000;
    audio.currentTime = sourceStartSeconds + (videoElapsedMs / 1000);
    await audio.play();
    setVideoPlaying(true);

    const tick = () => {
      const elapsed = Math.max(0, (audio.currentTime * 1000) - videoTimeline.sourceStartMs);
      setVideoElapsedMs(elapsed);
      if (elapsed >= videoTimeline.durationMs || audio.ended) {
        audio.pause();
        setVideoPlaying(false);
        setVideoElapsedMs(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function downloadImage() {
    if (!imageBlob) {
      setStatus('Image is still being prepared.');
      return;
    }
    const url = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quran-${ayah.surahNumber}-${fromAyah}-${toAyah}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Screen className="share-quran-screen app-page-shell bg-fluent">
      <div className="app-fixed-header">
        <Header title="Share Quran" onBack={onClose} backLabel="Back from Share Quran" />
      </div>

      <div className="app-scroll-content share-quran-page-content" data-reader-ui>
        <ModeSwitch mode={mode} onChange={(nextMode) => {
          stopVideoPreview();
          setVideoElapsedMs(0);
          setMode(nextMode);
        }} />

        <section
          className={`share-media-live-preview is-${mode} is-${orientation}`}
          aria-label={`${mode} preview`}
        >
          {mode === SHARE_MEDIA_MODES.IMAGE ? (
            <div className="share-image-preview-stage">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`${surah?.name || 'Quran'} ${fromAyah}-${toAyah}`}
                  className="quran-share-generated-image"
                />
              ) : (
                <div className="quran-share-preview-loading">Preparing preview…</div>
              )}
            </div>
          ) : (
            <VideoPreview
              background={selectedBackground}
              surahName={arabicSurahName}
              surahMeaning={surahMeta?.meaning || ''}
              ayah={activeVideoAyah}
              playing={videoPlaying}
              elapsedMs={videoElapsedMs}
              durationMs={videoTimeline?.durationMs || 0}
              onTogglePlay={toggleVideoPreview}
              textScale={textScale}
            />
          )}
        </section>

        <nav className="share-media-tabs" aria-label="Share Quran media settings">
          {SHARE_MEDIA_TABS.map((tab) => {
            const Icon = getTabIcon(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="share-media-settings-card">
          {activeTab === 'audio' && (
            <AudioSettings
              mode={mode}
              reciters={reciters}
              selectedReciter={selectedReciter}
              onReciterChange={(value) => {
                stopVideoPreview();
                setVideoElapsedMs(0);
                setSelectedReciter(value);
              }}
            />
          )}

          {activeTab === 'background' && (
            <BackgroundSettings
              assets={SHARE_BACKGROUND_ASSETS}
              selectedId={selectedBackgroundId}
              onSelect={setSelectedBackgroundId}
            />
          )}

          {activeTab === 'text' && (
            <TextSettings
              mode={mode}
              fromAyah={fromAyah}
              toAyah={toAyah}
              textScale={textScale}
              onTextScaleChange={setTextScale}
            />
          )}

          {activeTab === 'style' && (
            <StyleSettings orientation={orientation} onOrientationChange={setOrientation} />
          )}
        </section>

        <section className="share-range-card share-media-range-card">
          <div className="share-media-range-title">
            <div>
              <h3>Ayahs</h3>
              <p>Maximum 10 ayahs</p>
            </div>
            <span>{surah?.name || `Surah ${ayah.surahNumber}`}</span>
          </div>

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
        </section>

        {mode === SHARE_MEDIA_MODES.VIDEO && (
          <div className="share-selected-reciter">
            <Volume2 size={17} />
            <span>{selectedReciterMeta?.name || 'Reciter'}</span>
          </div>
        )}

        <button
          type="button"
          className="share-media-final-action"
          onClick={mode === SHARE_MEDIA_MODES.IMAGE ? downloadImage : undefined}
          disabled={
            mode === SHARE_MEDIA_MODES.IMAGE
              ? preparingImage || !imageBlob || range.length === 0
              : true
          }
        >
          <Download size={19} />
          {mode === SHARE_MEDIA_MODES.IMAGE
            ? preparingImage ? 'Preparing Image…' : 'Download Image'
            : 'Download Video'}
        </button>

        {mode === SHARE_MEDIA_MODES.VIDEO && (
          <p className="share-media-export-note">
            Video preview is timeline-driven now. Offline video export will activate after your local background clips are added and the encoder layer is enabled.
          </p>
        )}

        {(status || videoTimelineStatus) && (
          <p className="share-sheet-status">{status || videoTimelineStatus}</p>
        )}
      </div>
    </Screen>
  );
}

function ModeSwitch({ mode, onChange }) {
  return (
    <div className="share-media-mode-switch" role="group" aria-label="Share media type">
      <button
        type="button"
        className={mode === SHARE_MEDIA_MODES.IMAGE ? 'is-active' : ''}
        onClick={() => onChange(SHARE_MEDIA_MODES.IMAGE)}
      >
        <ImageIcon size={17} />
        Image
      </button>
      <button
        type="button"
        className={mode === SHARE_MEDIA_MODES.VIDEO ? 'is-active' : ''}
        onClick={() => onChange(SHARE_MEDIA_MODES.VIDEO)}
      >
        <Headphones size={17} />
        Video
      </button>
    </div>
  );
}

function VideoPreview({
  background,
  surahName,
  surahMeaning,
  ayah,
  playing,
  elapsedMs,
  durationMs,
  onTogglePlay,
  textScale,
}) {
  return (
    <div className="share-video-preview-stage">
      {background?.videoSrc ? (
        <video
          className="share-video-preview-background"
          src={background.videoSrc}
          poster={background.imageSrc || undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className="share-video-preview-fallback" />
      )}

      <div className="share-video-preview-overlay" />
      <div className="share-video-preview-header">
        <strong>{`سُورَةُ ${surahName}`}</strong>
        {surahMeaning && <span>{surahMeaning}</span>}
      </div>

      <div
        className="share-video-preview-ayah-card"
        key={ayah?.ayahNumber}
        style={{ '--share-text-scale': textScale }}
      >
        <div className="share-video-preview-ayah">
          {ayah?.text || ''}
        </div>
      </div>

      <button type="button" className="share-video-preview-play" onClick={onTogglePlay}>
        {playing ? 'Pause' : 'Preview'}
      </button>

      <div className="share-video-preview-progress">
        <span style={{ width: `${durationMs ? Math.min(100, (elapsedMs / durationMs) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

function AudioSettings({ mode, reciters, selectedReciter, onReciterChange }) {
  const [open, setOpen] = useState(false);
  const selected = reciters.find((reciter) => reciter.id === selectedReciter) || reciters[0] || null;

  if (mode === SHARE_MEDIA_MODES.IMAGE) {
    return (
      <div className="share-media-simple-message">
        <Headphones size={21} />
        <div>
          <strong>Audio is for video only</strong>
          <span>Image mode includes all selected ayahs without recitation.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="share-reciter-picker">
      <div className="share-media-section-heading">
        <strong>Reciter</strong>
        <span>Choose from the same reciters available in Settings.</span>
      </div>

      <button
        type="button"
        className="share-reciter-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {selected && (
          <img
            className="share-reciter-avatar"
            src={getReciterImageUrl(selected)}
            alt=""
          />
        )}
        <span>{selected?.name || 'Select reciter'}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="share-reciter-menu">
          {reciters.map((reciter) => {
            const isSelected = reciter.id === selectedReciter;
            return (
              <button
                key={reciter.id}
                type="button"
                className={isSelected ? 'is-selected' : ''}
                onClick={() => {
                  onReciterChange(reciter.id);
                  setOpen(false);
                }}
              >
                <img
                  className="share-reciter-avatar"
                  src={getReciterImageUrl(reciter)}
                  alt=""
                />
                <span>{reciter.name}</span>
                {isSelected && <Check size={17} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BackgroundSettings({ assets, selectedId, onSelect }) {
  return (
    <>
      <div className="share-media-section-heading">
        <strong>Background</strong>
        <span>Your own short looping clips</span>
      </div>

      {assets.length ? (
        <div className="share-background-grid">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className={selectedId === asset.id ? 'is-selected' : ''}
              onClick={() => onSelect(asset.id)}
            >
              {asset.imageSrc
                ? <img src={asset.imageSrc} alt={`${asset.label} background`} />
                : <span>{asset.label}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="share-background-empty">
          <ImageIcon size={22} />
          <strong>Background library ready</strong>
          <span>Add your licensed/AI-generated clips to the share background manifest.</span>
        </div>
      )}
    </>
  );
}

function TextSettings({
  mode,
  fromAyah,
  toAyah,
  textScale,
  onTextScaleChange,
}) {
  const percent = Math.round(textScale * 100);

  return (
    <div className="share-text-settings">
      <div className="share-media-section-heading">
        <strong>Quran text size</strong>
        <span>
          {mode === SHARE_MEDIA_MODES.VIDEO
            ? 'One ayah is shown at a time in the center.'
            : `Ayahs ${fromAyah}–${toAyah} are composed together.`}
        </span>
      </div>

      <div className="share-text-size-control">
        <button
          type="button"
          aria-label="Decrease Quran text size"
          onClick={() => onTextScaleChange((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))))}
          disabled={textScale <= 0.75}
        >
          −
        </button>

        <div>
          <strong>{percent}%</strong>
          <span>Arabic text</span>
        </div>

        <button
          type="button"
          aria-label="Increase Quran text size"
          onClick={() => onTextScaleChange((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))}
          disabled={textScale >= 1.35}
        >
          +
        </button>
      </div>
    </div>
  );
}

function StyleSettings({ orientation, onOrientationChange }) {
  return (
    <div className="share-media-control-group">
      <div className="share-media-section-heading">
        <strong>Orientation</strong>
        <span>Used by both preview and future export layouts.</span>
      </div>
      <div className="share-orientation-switch">
        <button
          type="button"
          className={orientation === 'landscape' ? 'is-active' : ''}
          onClick={() => onOrientationChange('landscape')}
        >
          Landscape
        </button>
        <button
          type="button"
          className={orientation === 'portrait' ? 'is-active' : ''}
          onClick={() => onOrientationChange('portrait')}
        >
          Portrait
        </button>
      </div>
    </div>
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

function getTabIcon(id) {
  if (id === 'audio') return Headphones;
  if (id === 'background') return ImageIcon;
  if (id === 'text') return Type;
  return Palette;
}

function getFromOptions(ayahs, selectedIndex) {
  if (selectedIndex < 4) return ayahs.slice(selectedIndex, selectedIndex + 10);

  let start = selectedIndex - 4;
  if (start + 10 > ayahs.length) start = Math.max(0, ayahs.length - 10);
  return ayahs.slice(start, start + 10);
}
