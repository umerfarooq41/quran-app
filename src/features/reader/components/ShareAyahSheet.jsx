import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Download,
  Headphones,
  Image as ImageIcon,
  Palette,
  Pause,
  Play,
  Maximize2,
  Type,
} from 'lucide-react';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import { getTranslationOption, loadTranslationEntry } from '../../../lib/translations';
import { useAppStore } from '../../../store/useAppStore';
import { getSurahNameMeta } from '../../../data/surahNames';
import { generateQuranShareImage } from '../../../lib/shareCanvas';
import { generateQuranShareVideo } from '../../../lib/shareVideoExport';
import { getReciterImageUrl, normalizeLocalReciters } from '../../../lib/localAudio';
import { findWordAtTime } from '../../../lib/fullSurahAudio';
import { getQuranWordsForAyah } from '../../../lib/quranWordMap';
import {
  SHARE_BACKGROUND_ASSETS,
  SHARE_MEDIA_MODES,
  SHARE_MEDIA_TABS,
  SHARE_BISMILLAH_TEXT,
  buildShareComposition,
  findShareAyahAtTime,
  loadShareVideoTimeline,
  shouldIncludeShareBismillah,
} from '../../../lib/shareMedia';
import { surahArabicNames } from '../../../utils/quranLabels';
import { Header, Screen } from '../../../components/common/AppChrome';


export function ShareQuranScreen({ ayah, onClose }) {
  const settingsTranslationId = useAppStore((state) => state.settings.translation);
  const settingsReciterId = useAppStore((state) => state.settings.reciter);
  const translationOption = useMemo(
    () => getTranslationOption(settingsTranslationId),
    [settingsTranslationId],
  );
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(ayah.surahNumber);
  const surah = getSurah(selectedSurahNumber);
  const surahMeta = getSurahNameMeta(selectedSurahNumber);
  const surahAyahs = useMemo(() => getSurahAyahs(selectedSurahNumber), [selectedSurahNumber]);
  const fromOptions = surahAyahs;
  const surahOptions = useMemo(() => (
    Array.from({ length: 114 }, (_, index) => {
      const number = index + 1;
      const item = getSurah(number);
      return item ? { value: number, label: `${item.name} (${number})` } : null;
    }).filter(Boolean)
  ), []);
  const reciters = useMemo(() => normalizeLocalReciters(), []);

  const [mode, setMode] = useState(SHARE_MEDIA_MODES.IMAGE);
  const [activeTab, setActiveTab] = useState('background');
  const [fromAyah, setFromAyah] = useState(ayah.ayahNumber);
  const [toAyah, setToAyah] = useState(ayah.ayahNumber);
  const [openRangePicker, setOpenRangePicker] = useState(null);
  const [selectedReciter, setSelectedReciter] = useState(() => (
    reciters.some((reciter) => reciter.id === settingsReciterId)
      ? settingsReciterId
      : reciters[0]?.id || ''
  ));
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(
    SHARE_BACKGROUND_ASSETS[0]?.id || '',
  );
  const [textScale, setTextScale] = useState(1);
  const [translationScale, setTranslationScale] = useState(1);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationsByAyah, setTranslationsByAyah] = useState({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [status, setStatus] = useState('');

  const [imageBlob, setImageBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [preparingImage, setPreparingImage] = useState(true);

  const [videoTimeline, setVideoTimeline] = useState(null);
  const [videoTimelineStatus, setVideoTimelineStatus] = useState('');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoElapsedMs, setVideoElapsedMs] = useState(0);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoExportProgress, setVideoExportProgress] = useState(0);

  const audioRef = useRef(null);
  const bismillahAudioRef = useRef(null);
  const previewPhaseRef = useRef('main');
  const rafRef = useRef(0);

  const lastSourceAyahRef = useRef(`${ayah.surahNumber}:${ayah.ayahNumber}`);

  useEffect(() => {
    const nextKey = `${ayah.surahNumber}:${ayah.ayahNumber}`;
    if (lastSourceAyahRef.current === nextKey) return;
    lastSourceAyahRef.current = nextKey;
    stopVideoPreview();
    setSelectedSurahNumber(ayah.surahNumber);
    setFromAyah(ayah.ayahNumber);
    setToAyah(ayah.ayahNumber);
    setOpenRangePicker(null);
    setVideoElapsedMs(0);
  }, [ayah.surahNumber, ayah.ayahNumber]);

  const maxRange = mode === SHARE_MEDIA_MODES.IMAGE ? 5 : 10;
  const fromIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === fromAyah));
  const toOptions = surahAyahs.slice(fromIndex, fromIndex + maxRange);
  const range = useMemo(
    () => surahAyahs.filter((item) => item.ayahNumber >= fromAyah && item.ayahNumber <= toAyah),
    [surahAyahs, fromAyah, toAyah],
  );


  const arabicSurahName = surahArabicNames[selectedSurahNumber] || surah?.name || '';
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
    surahNumber: selectedSurahNumber,
    fromAyah,
    toAyah,
    backgroundAsset: selectedBackground,
    orientation: 'portrait',
    reciterId: selectedReciter,
    showTranslation,
    translationId: settingsTranslationId,
    style: {
      textColor: '#ffffff',
      overlayOpacity: 0.42,
      alignment: 'center',
      textScale,
      translationScale,
    },
  }), [
    mode,
    selectedSurahNumber,
    fromAyah,
    toAyah,
    selectedBackground,
    selectedReciter,
    textScale,
    translationScale,
    showTranslation,
    settingsTranslationId,
  ]);

  const showBismillah = shouldIncludeShareBismillah(selectedSurahNumber, fromAyah);
  const videoInBismillah = Boolean(videoTimeline?.bismillahDurationMs)
    && videoElapsedMs < Number(videoTimeline.bismillahDurationMs);

  const activeVideoEntry = useMemo(
    () => findShareAyahAtTime(videoTimeline?.timeline, videoElapsedMs),
    [videoTimeline, videoElapsedMs],
  );
  const activeVideoAyah = useMemo(() => {
    const ayahNumber = Number(activeVideoEntry?.ayahNumber) || fromAyah;
    return surahAyahs.find((item) => item.ayahNumber === ayahNumber) || range[0] || ayah;
  }, [activeVideoEntry, fromAyah, surahAyahs, range, ayah]);

  const activeVideoWord = useMemo(
    () => findWordAtTime(activeVideoEntry, videoElapsedMs),
    [activeVideoEntry, videoElapsedMs],
  );
  const activeVideoWords = useMemo(
    () => getQuranWordsForAyah(selectedSurahNumber, activeVideoAyah?.ayahNumber),
    [selectedSurahNumber, activeVideoAyah?.ayahNumber],
  );

  useEffect(() => {
    let cancelled = false;

    if (!showTranslation || !range.length) {
      setTranslationsByAyah({});
      setTranslationLoading(false);
      return undefined;
    }

    setTranslationLoading(true);
    Promise.all(
      range.map(async (rangeAyah) => {
        try {
          const entry = await loadTranslationEntry(
            settingsTranslationId,
            selectedSurahNumber,
            rangeAyah.ayahNumber,
            { includeTafsir: false },
          );
          return [rangeAyah.ayahNumber, entry?.plainText || ''];
        } catch {
          return [rangeAyah.ayahNumber, ''];
        }
      }),
    )
      .then((entries) => {
        if (!cancelled) setTranslationsByAyah(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setTranslationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showTranslation, settingsTranslationId, selectedSurahNumber, range]);

  useEffect(() => {
    let cancelled = false;
    setStatus('');
    setPreparingImage(true);

    generateQuranShareImage({
      surahName: arabicSurahName,
      surahNumber: selectedSurahNumber,
      ayahs: range,
      surahMeaning: surahMeta?.meaning || '',
      orientation: 'portrait',
      textScale,
      translationScale,
      backgroundAsset: selectedBackground,
      showTranslation,
      translationsByAyah,
      translationDirection: translationOption?.direction || 'ltr',
      showBismillah,
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
  }, [
    arabicSurahName,
    selectedSurahNumber,
    range,
    surahMeta?.meaning,
    textScale,
    translationScale,
    selectedBackground,
    showTranslation,
    translationsByAyah,
    translationOption?.direction,
    showBismillah,
  ]);

  useEffect(() => {
    if (!imageBlob) return undefined;
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
    if (bismillahAudioRef.current) {
      bismillahAudioRef.current.pause();
      bismillahAudioRef.current.src = '';
    }
  }, []);

  function changeFrom(nextValue) {
    const nextFrom = Number(nextValue);
    const nextIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === nextFrom));
    const maxTo = surahAyahs[Math.min(surahAyahs.length - 1, nextIndex + maxRange - 1)]?.ayahNumber || nextFrom;
    setFromAyah(nextFrom);
    setToAyah((current) => Math.min(maxTo, Math.max(nextFrom, current)));
  }

  function changeSurah(nextSurahNumber) {
    const next = Number(nextSurahNumber);
    if (!Number.isInteger(next) || next < 1 || next > 114) return;
    stopVideoPreview();
    setOpenRangePicker(null);
    setSelectedSurahNumber(next);
    setFromAyah(1);
    setToAyah(1);
    setVideoElapsedMs(0);
  }

  function stopVideoPreview() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (audioRef.current) audioRef.current.pause();
    if (bismillahAudioRef.current) bismillahAudioRef.current.pause();
    setVideoPlaying(false);
  }

  function seekVideoPreview(nextElapsedMs) {
    const durationMs = Number(videoTimeline?.durationMs) || 0;
    const nextMs = Math.max(0, Math.min(durationMs, Number(nextElapsedMs) || 0));
    const preRollMs = Number(videoTimeline?.bismillahDurationMs) || 0;
    setVideoElapsedMs(nextMs);

    if (nextMs < preRollMs && videoTimeline?.bismillah) {
      previewPhaseRef.current = 'bismillah';
      if (audioRef.current) audioRef.current.pause();
      if (bismillahAudioRef.current) {
        bismillahAudioRef.current.currentTime = (
          Number(videoTimeline.bismillah.sourceStartMs) + nextMs
        ) / 1000;
        if (videoPlaying) {
          bismillahAudioRef.current.play().catch(() => {});
        }
      }
      return;
    }

    previewPhaseRef.current = 'main';
    if (bismillahAudioRef.current) bismillahAudioRef.current.pause();
    if (audioRef.current && videoTimeline?.sourceStartMs != null) {
      audioRef.current.currentTime = (
        Number(videoTimeline.sourceStartMs) + Math.max(0, nextMs - preRollMs)
      ) / 1000;
      if (videoPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
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

    let bismillahAudio = bismillahAudioRef.current;
    if (videoTimeline?.bismillah?.audioUrl && !bismillahAudio) {
      bismillahAudio = new Audio();
      bismillahAudio.preload = 'auto';
      bismillahAudioRef.current = bismillahAudio;
    }

    try {
      setStatus('');
      if (audio.src !== new URL(videoTimeline.audioUrl, window.location.href).href) {
        audio.src = videoTimeline.audioUrl;
        audio.load();
      }
      await waitForMediaReady(audio);

      if (bismillahAudio && videoTimeline?.bismillah?.audioUrl) {
        if (bismillahAudio.src !== new URL(videoTimeline.bismillah.audioUrl, window.location.href).href) {
          bismillahAudio.src = videoTimeline.bismillah.audioUrl;
          bismillahAudio.load();
        }
        await waitForMediaReady(bismillahAudio);
      }

      const preRollMs = Number(videoTimeline.bismillahDurationMs) || 0;
      if (preRollMs > 0 && videoElapsedMs < preRollMs && bismillahAudio) {
        previewPhaseRef.current = 'bismillah';
        bismillahAudio.currentTime = (
          Number(videoTimeline.bismillah.sourceStartMs) + videoElapsedMs
        ) / 1000;
        await bismillahAudio.play();
      } else {
        previewPhaseRef.current = 'main';
        audio.currentTime = (
          Number(videoTimeline.sourceStartMs) + Math.max(0, videoElapsedMs - preRollMs)
        ) / 1000;
        await audio.play();
      }
      setVideoPlaying(true);
    } catch (error) {
      setVideoPlaying(false);
      setStatus(error?.message || 'Recitation audio could not be played.');
      return;
    }

    const tick = () => {
      const preRollMs = Number(videoTimeline.bismillahDurationMs) || 0;
      if (previewPhaseRef.current === 'bismillah' && bismillahAudio) {
        const preElapsed = Math.max(
          0,
          (bismillahAudio.currentTime * 1000) - Number(videoTimeline.bismillah.sourceStartMs),
        );
        setVideoElapsedMs(Math.min(preRollMs, preElapsed));

        if (
          preElapsed >= preRollMs - 20
          || bismillahAudio.currentTime * 1000 >= Number(videoTimeline.bismillah.sourceEndMs) - 20
          || bismillahAudio.ended
        ) {
          bismillahAudio.pause();
          previewPhaseRef.current = 'main';
          audio.currentTime = Number(videoTimeline.sourceStartMs) / 1000;
          audio.play().catch((error) => {
            stopVideoPreview();
            setStatus(error?.message || 'Recitation audio could not continue after Bismillah.');
          });
        }
      } else {
        const mainElapsed = Math.max(
          0,
          (audio.currentTime * 1000) - Number(videoTimeline.sourceStartMs),
        );
        const elapsed = preRollMs + mainElapsed;
        setVideoElapsedMs(elapsed);
        if (
          elapsed >= videoTimeline.durationMs
          || audio.currentTime * 1000 >= Number(videoTimeline.sourceEndMs) - 20
          || audio.ended
        ) {
          audio.pause();
          setVideoPlaying(false);
          setVideoElapsedMs(0);
          previewPhaseRef.current = preRollMs > 0 ? 'bismillah' : 'main';
          return;
        }
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
    link.download = `quran-${selectedSurahNumber}-${fromAyah}-${toAyah}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadVideo() {
    if (!videoTimeline?.audioUrl || !videoTimeline?.timeline?.length) {
      setStatus('This reciter does not have usable timing data for video export.');
      return;
    }
    if (!selectedBackground?.videoSrc) {
      setStatus('Select a video background first.');
      return;
    }
    if (showTranslation && translationLoading) {
      setStatus('Wait for the selected translation to finish loading.');
      return;
    }

    stopVideoPreview();
    setStatus('');
    setExportingVideo(true);
    setVideoExportProgress(0);

    try {
      const blob = await generateQuranShareVideo({
        composition,
        timeline: videoTimeline,
        ayahs: range,
        translationsByAyah,
        translationDirection: translationOption?.direction || 'ltr',
        surahName: arabicSurahName,
        surahMeaning: surahMeta?.meaning || '',
        highlightColor: selectedBackground?.accentColor || '#d8b36a',
        translationScale,
        onProgress: setVideoExportProgress,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quran-${selectedSurahNumber}-${fromAyah}-${toAyah}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setVideoExportProgress(1);
    } catch (error) {
      setStatus(error?.message || 'Video could not be generated on this device.');
    } finally {
      setExportingVideo(false);
    }
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
          setOpenRangePicker(null);
          if (nextMode === SHARE_MEDIA_MODES.IMAGE) {
            const startIndex = Math.max(0, surahAyahs.findIndex((item) => item.ayahNumber === fromAyah));
            const imageMaxTo = surahAyahs[Math.min(surahAyahs.length - 1, startIndex + 4)]?.ayahNumber || fromAyah;
            setToAyah((current) => Math.min(imageMaxTo, Math.max(fromAyah, current)));
          }
          setMode(nextMode);
        }} />

        <section
          className={`share-media-live-preview is-${mode} is-portrait tab-${activeTab}`}
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
              ) : selectedBackground?.imageSrc ? (
                <img
                  src={selectedBackground.imageSrc}
                  alt="Selected Quran share background"
                  className="quran-share-generated-image is-background-placeholder"
                />
              ) : null}
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
              onSeek={seekVideoPreview}
              textScale={textScale}
              translationScale={translationScale}
              showAyahCard
              showTranslation={showTranslation}
              translation={translationsByAyah[activeVideoAyah?.ayahNumber] || ''}
              translationDirection={translationOption?.direction || 'ltr'}
              surahNumber={selectedSurahNumber}
              wordItems={activeVideoWords}
              activeWordPosition={activeVideoWord?.position || null}
              highlightColor={selectedBackground?.accentColor || '#d8b36a'}
              orientation="portrait"
              isBismillah={videoInBismillah}
              bismillahText={SHARE_BISMILLAH_TEXT}
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
              maxRange={maxRange}
              surahOptions={surahOptions}
              selectedSurahNumber={selectedSurahNumber}
              selectedSurahName={surah?.name || `Surah ${selectedSurahNumber}`}
              onSurahChange={changeSurah}
              fromAyah={fromAyah}
              toAyah={toAyah}
              fromOptions={fromOptions}
              toOptions={toOptions}
              openRangePicker={openRangePicker}
              onToggleRange={setOpenRangePicker}
              onChangeFrom={(nextValue) => {
                changeFrom(nextValue);
                setOpenRangePicker(null);
              }}
              onChangeTo={(nextValue) => {
                setToAyah(Number(nextValue));
                setOpenRangePicker(null);
              }}
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
              textScale={textScale}
              onTextScaleChange={setTextScale}
              translationScale={translationScale}
              onTranslationScaleChange={setTranslationScale}
              showTranslation={showTranslation}
              onShowTranslationChange={setShowTranslation}
              translationOption={translationOption}
              translationLoading={translationLoading}
            />
          )}

        </section>
        <button
          type="button"
          className="share-media-final-action"
          onClick={mode === SHARE_MEDIA_MODES.IMAGE ? downloadImage : downloadVideo}
          disabled={
            mode === SHARE_MEDIA_MODES.IMAGE
              ? preparingImage || !imageBlob || range.length < 1 || range.length > 5
              : exportingVideo
                || !videoTimeline?.audioUrl
                || !videoTimeline?.timeline?.length
                || !selectedBackground?.videoSrc
                || (showTranslation && translationLoading)
          }
        >
          <Download size={19} />
          {mode === SHARE_MEDIA_MODES.IMAGE
            ? preparingImage ? 'Preparing Image…' : 'Download Image'
            : exportingVideo
              ? `Creating Video ${Math.round(videoExportProgress * 100)}%`
              : 'Download Video'}
        </button>
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
  onSeek,
  textScale,
  translationScale,
  showAyahCard,
  showTranslation,
  translation,
  translationDirection,
  surahNumber,
  wordItems,
  activeWordPosition,
  highlightColor,
  orientation,
  isBismillah = false,
  bismillahText = SHARE_BISMILLAH_TEXT,
}) {
  const backgroundSrc = background?.videoSrc || '';
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(true);
  const [autoFitScale, setAutoFitScale] = useState(1);
  const [cardMetrics, setCardMetrics] = useState({ top: 0, maxHeight: 0 });

  useEffect(() => {
    if (!fullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen || !fullscreenControlsVisible) return undefined;
    const timer = window.setTimeout(() => {
      setFullscreenControlsVisible(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [fullscreen, fullscreenControlsVisible]);

  useEffect(() => {
    setAutoFitScale(1);
  }, [
    showAyahCard,
    ayah?.ayahNumber,
    ayah?.text,
    translation,
    showTranslation,
    textScale,
    translationScale,
    fullscreen,
    wordItems?.length,
  ]);

  useEffect(() => {
    if (!showAyahCard) return undefined;

    let firstFrame = 0;
    let secondFrame = 0;

    const measure = () => {
      const stage = stageRef.current;
      const card = cardRef.current;
      if (!stage || !card) return;

      const stageRect = stage.getBoundingClientRect();
      const isLandscape = orientation === 'landscape';

      // Match shareVideoExport.js exactly. Playback controls are preview-only
      // chrome and never reserve export composition space.
      const safeTop = stageRect.height * (isLandscape ? 0.18 : 0.165);
      const safeBottom = stageRect.height * (isLandscape ? 0.93 : 0.91);
      const maxHeight = Math.max(96, safeBottom - safeTop);

      // scrollHeight gives the full natural card height even when CSS max-height is active.
      const contentHeight = Math.max(
        card.scrollHeight,
        card.getBoundingClientRect().height,
      );

      if (contentHeight > maxHeight + 2 && autoFitScale > 0.58) {
        const ratio = Math.max(
          0.58,
          Math.min(autoFitScale, autoFitScale * (maxHeight / contentHeight) * 0.985),
        );
        if (ratio < autoFitScale - 0.005) {
          setAutoFitScale(Number(ratio.toFixed(3)));
          return;
        }
      }

      const fittedHeight = Math.min(contentHeight, maxHeight);

      // Center-first growth model:
      // 1. Short/medium cards stay exactly centered in the media.
      // 2. They grow equally upward and downward from that center.
      // 3. Once the upper edge reaches the protected title zone, the top locks
      //    there and any additional height grows downward only.
      const previewCenterY = stageRect.height / 2;
      const centeredTop = previewCenterY - (fittedHeight / 2);
      const symmetricHeightBeforeTitle = Math.max(0, (previewCenterY - safeTop) * 2);
      const top = fittedHeight <= symmetricHeightBeforeTitle
        ? centeredTop
        : safeTop;

      setCardMetrics({ top, maxHeight });
    };

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(measure);
    });

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
    };
  }, [
    showAyahCard,
    ayah?.ayahNumber,
    ayah?.text,
    translation,
    showTranslation,
    textScale,
    translationScale,
    fullscreen,
    wordItems?.length,
    autoFitScale,
  ]);

  function toggleFullscreen(event) {
    event?.stopPropagation?.();
    setFullscreen((value) => {
      const next = !value;
      setFullscreenControlsVisible(true);
      return next;
    });
  }

  function revealFullscreenControls() {
    if (!fullscreen) return;
    setFullscreenControlsVisible(true);
  }

  const stage = (
    <div
      ref={stageRef}
      className={[
        'share-video-preview-stage',
        orientation === 'landscape' ? 'is-landscape' : 'is-portrait',
        fullscreen ? 'is-fullscreen' : '',
        fullscreen && !fullscreenControlsVisible ? 'is-controls-hidden' : '',
      ].filter(Boolean).join(' ')}
      onClick={revealFullscreenControls}
    >
      {backgroundSrc ? (
        <video
          className="share-video-preview-background"
          src={backgroundSrc}
          poster={background?.imageSrc || undefined}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        <div className="share-video-preview-fallback" aria-hidden="true" />
      )}

      <div className="share-video-preview-overlay" />

      <div className="share-video-preview-header">
        <strong>سُورَةُ {surahName}</strong>
        {surahMeaning && <span>{surahMeaning}</span>}
      </div>

      {isBismillah && (
        <div
          className="share-video-preview-bismillah"
          dir="rtl"
          style={{ '--share-text-scale': textScale }}
        >
          {bismillahText}
        </div>
      )}

      {showAyahCard && !isBismillah && (
        <div
          ref={cardRef}
          className="share-video-preview-ayah-card"
          key={ayah?.ayahNumber}
          style={{
            '--share-text-scale': textScale * autoFitScale,
            '--share-translation-scale': translationScale * autoFitScale,
            '--share-card-top': `${cardMetrics.top || 96}px`,
            '--share-card-max-height': `${cardMetrics.maxHeight || 360}px`,
          }}
        >
          <div className="share-video-preview-ayah" dir="rtl">
            {wordItems?.length
              ? wordItems.map((word) => (
                  <React.Fragment key={word.id}>
                    <span
                      className={Number(word.position) === Number(activeWordPosition) ? 'is-reciting' : ''}
                      style={Number(word.position) === Number(activeWordPosition)
                        ? { color: highlightColor }
                        : undefined}
                    >
                      {word.text}
                    </span>{' '}
                  </React.Fragment>
                ))
              : ayah?.text || ''}
          </div>

          {showTranslation && translation && (
            <div className="share-video-preview-translation" dir={translationDirection}>
              {translation}
            </div>
          )}

          <div className={`share-video-preview-reference ${showTranslation && translation ? 'is-translation-sized' : 'is-arabic-sized'}`}>
            {surahNumber}:{ayah?.ayahNumber}
          </div>
        </div>
      )}

      <div
        className="share-video-preview-controls"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-video-preview-control-row">
          <button
            type="button"
            className="share-video-preview-play"
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause video preview' : 'Play video preview'}
          >
            {playing
              ? <Pause size={20} fill="currentColor" />
              : <Play size={20} fill="currentColor" />}
          </button>

          <span className="share-video-preview-inline-time">
            {formatMediaTime(elapsedMs)} / {formatMediaTime(durationMs)}
          </span>

          <button
            type="button"
            className="share-video-preview-fullscreen"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}
          >
            <Maximize2 size={20} />
          </button>
        </div>

        <input
          className="share-video-preview-seek"
          type="range"
          min="0"
          max={Math.max(1, durationMs || 1)}
          step="50"
          value={Math.min(elapsedMs, Math.max(1, durationMs || 1))}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Seek video preview"
        />
      </div>
    </div>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        className={`share-video-fullscreen-shell ${
          orientation === 'landscape' ? 'is-landscape' : 'is-portrait'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Video export preview"
      >
        {stage}
      </div>,
      document.body,
    );
  }

  return stage;

}

function AudioSettings({
  mode,
  maxRange,
  surahOptions,
  selectedSurahNumber,
  selectedSurahName,
  onSurahChange,
  fromAyah,
  toAyah,
  fromOptions,
  toOptions,
  openRangePicker,
  onToggleRange,
  onChangeFrom,
  onChangeTo,
  reciters,
  selectedReciter,
  onReciterChange,
}) {
  const [reciterOpen, setReciterOpen] = useState(false);
  const [reciterOpensUp, setReciterOpensUp] = useState(false);
  const pickerRef = useRef(null);
  const selected = reciters.find((reciter) => reciter.id === selectedReciter) || reciters[0] || null;

  useEffect(() => {
    if (!reciterOpen || !pickerRef.current) return undefined;

    const updateDirection = () => {
      const rect = pickerRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const menuHeight = Math.min(300, Math.max(54, reciters.length * 54));
      const roomBelow = viewportHeight - rect.bottom;
      const roomAbove = rect.top;
      setReciterOpensUp(roomBelow < menuHeight + 12 && roomAbove > roomBelow);
    };

    const closeOnOutsidePress = (event) => {
      if (!pickerRef.current?.contains(event.target)) setReciterOpen(false);
    };

    updateDirection();
    window.visualViewport?.addEventListener('resize', updateDirection);
    window.addEventListener('resize', updateDirection);
    document.addEventListener('pointerdown', closeOnOutsidePress);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateDirection);
      window.removeEventListener('resize', updateDirection);
      document.removeEventListener('pointerdown', closeOnOutsidePress);
    };
  }, [reciterOpen, reciters.length]);

  return (
    <div className="share-audio-settings-stack">
      <div className="share-media-section-heading share-reference-heading">
        <strong>Ayahs</strong>
        <span>Max {maxRange} Ayahs</span>
      </div>

      <SurahField
        value={selectedSurahNumber}
        label={selectedSurahName}
        options={surahOptions}
        open={openRangePicker === 'surah'}
        onToggle={() => {
          setReciterOpen(false);
          onToggleRange((current) => current === 'surah' ? null : 'surah');
        }}
        onSelect={onSurahChange}
      />

      <div className="share-reference-range-row">
        <RangeField
          label="From"
          value={fromAyah}
          options={fromOptions}
          open={openRangePicker === 'from'}
          onToggle={() => {
            setReciterOpen(false);
            onToggleRange((current) => current === 'from' ? null : 'from');
          }}
          onSelect={onChangeFrom}
          compact
        />
        <span className="share-range-to-label">to</span>
        <RangeField
          label="To"
          value={toAyah}
          options={toOptions}
          open={openRangePicker === 'to'}
          onToggle={() => {
            setReciterOpen(false);
            onToggleRange((current) => current === 'to' ? null : 'to');
          }}
          onSelect={onChangeTo}
          compact
        />
      </div>

      {mode === SHARE_MEDIA_MODES.VIDEO && (
        <div
          ref={pickerRef}
          className={`share-reciter-picker${reciterOpensUp ? ' opens-up' : ''}`}
        >
          <div className="share-media-section-heading share-reference-reciter-heading">
            <strong>Reciter</strong>
          </div>

          <button
            type="button"
            className="share-reciter-trigger"
            aria-expanded={reciterOpen}
            onClick={() => {
              onToggleRange(null);
              setReciterOpen((value) => !value);
            }}
          >
            {selected && (
              <img className="share-reciter-avatar" src={getReciterImageUrl(selected)} alt="" />
            )}
            <span>{selected?.name || 'Select reciter'}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>

          {reciterOpen && (
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
                      setReciterOpen(false);
                    }}
                  >
                    <img className="share-reciter-avatar" src={getReciterImageUrl(reciter)} alt="" />
                    <span>{reciter.name}</span>
                    {isSelected && <Check size={17} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
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
  textScale,
  onTextScaleChange,
  translationScale,
  onTranslationScaleChange,
  showTranslation,
  onShowTranslationChange,
  translationOption,
  translationLoading,
}) {
  const arabicPercent = Math.round(textScale * 100);
  const translationPercent = Math.round(translationScale * 100);

  return (
    <div className="share-text-reference-controls">
      <FontSizeStepper
        label="Quran font size"
        value={`${arabicPercent}%`}
        onDecrease={() => onTextScaleChange((value) => Math.max(0.75, Number((value - 0.05).toFixed(2))))}
        onIncrease={() => onTextScaleChange((value) => Math.min(1.35, Number((value + 0.05).toFixed(2))))}
        decreaseDisabled={textScale <= 0.75}
        increaseDisabled={textScale >= 1.35}
      />

      <div className="share-translation-inline-row">
        <div>
          <strong>Translation</strong>
          <span>
            {translationOption
              ? `${translationOption.language === 'Ur' ? 'Urdu' : 'English'} · ${translationOption.shortName || translationOption.label}`
              : 'Uses the translation selected in Settings'}
          </span>
          {translationLoading && showTranslation && <small>Loading translation…</small>}
        </div>
        <button
          type="button"
          className={`share-translation-toggle${showTranslation ? ' is-on' : ''}`}
          role="switch"
          aria-checked={showTranslation}
          onClick={() => onShowTranslationChange((value) => !value)}
          aria-label="Include translation"
        >
          <span />
        </button>
      </div>

      {showTranslation && (
        <FontSizeStepper
          label="Translation font size"
          value={`${translationPercent}%`}
          onDecrease={() => onTranslationScaleChange((value) => Math.max(0.75, Number((value - 0.05).toFixed(2))))}
          onIncrease={() => onTranslationScaleChange((value) => Math.min(1.35, Number((value + 0.05).toFixed(2))))}
          decreaseDisabled={translationScale <= 0.75}
          increaseDisabled={translationScale >= 1.35}
        />
      )}
    </div>
  );
}

function FontSizeStepper({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
}) {
  return (
    <div className="share-font-stepper-group">
      <strong>{label}</strong>
      <div className="share-font-stepper">
        <button type="button" onClick={onDecrease} disabled={decreaseDisabled} aria-label={`Decrease ${label}`}>
          −
        </button>
        <span>{value}</span>
        <button type="button" onClick={onIncrease} disabled={increaseDisabled} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function SurahField({ value, label, options, open, onToggle, onSelect }) {
  const fieldRef = useRef(null);
  const [opensUp, setOpensUp] = useState(false);

  useEffect(() => {
    if (!open || !fieldRef.current) return undefined;
    const updateDirection = () => {
      const rect = fieldRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const menuHeight = Math.min(320, Math.max(52, options.length * 52));
      const roomBelow = viewportHeight - rect.bottom;
      const roomAbove = rect.top;
      setOpensUp(roomBelow < menuHeight + 12 && roomAbove > roomBelow);
    };
    updateDirection();
    window.visualViewport?.addEventListener('resize', updateDirection);
    window.addEventListener('resize', updateDirection);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateDirection);
      window.removeEventListener('resize', updateDirection);
    };
  }, [open, options.length]);

  return (
    <div ref={fieldRef} className={`share-surah-field${opensUp ? ' opens-up' : ''}`}>
      <button type="button" className="share-surah-trigger" aria-expanded={open} onClick={onToggle}>
        <span>{label}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="share-surah-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={Number(option.value) === Number(value) ? 'is-selected' : ''}
              onClick={() => onSelect(option.value)}
            >
              <span>{option.label}</span>
              {Number(option.value) === Number(value) && <Check size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RangeField({ label, value, options, open, onToggle, onSelect, compact = false }) {
  const fieldRef = useRef(null);
  const selectedOptionRef = useRef(null);
  const [opensUp, setOpensUp] = useState(false);

  useEffect(() => {
    if (!open || !fieldRef.current) return undefined;

    const updateDirection = () => {
      const rect = fieldRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const estimatedMenuHeight = Math.min(280, Math.max(48, options.length * 48));
      const roomBelow = viewportHeight - rect.bottom;
      const roomAbove = rect.top;

      setOpensUp(
        roomBelow < estimatedMenuHeight + 12 &&
        roomAbove > roomBelow
      );
    };

    updateDirection();
    window.visualViewport?.addEventListener('resize', updateDirection);
    window.addEventListener('resize', updateDirection);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateDirection);
      window.removeEventListener('resize', updateDirection);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      selectedOptionRef.current?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, value]);

  return (
    <div
      ref={fieldRef}
      className={`share-range-field${opensUp ? ' opens-up' : ''}${compact ? ' is-compact' : ''}`}
    >
      <span>{label}</span>
      <button
        type="button"
        className="share-range-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{compact ? value : `Ayah ${value}`}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="share-range-menu">
          {options.map((item) => (
            <button
              key={item.ayahNumber}
              ref={item.ayahNumber === value ? selectedOptionRef : null}
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

function waitForMediaReady(media) {
  if (!media) return Promise.reject(new Error('Audio player is unavailable.'));
  if (media.readyState >= 1) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Recitation audio took too long to load.'));
    }, 10000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      media.removeEventListener('loadedmetadata', handleReady);
      media.removeEventListener('canplay', handleReady);
      media.removeEventListener('error', handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Recitation audio could not be loaded.'));
    };

    media.addEventListener('loadedmetadata', handleReady, { once: true });
    media.addEventListener('canplay', handleReady, { once: true });
    media.addEventListener('error', handleError, { once: true });
  });
}

function formatMediaTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTabIcon(id) {
  if (id === 'audio') return Headphones;
  if (id === 'background') return ImageIcon;
  if (id === 'text') return Type;
  return Palette;
}

