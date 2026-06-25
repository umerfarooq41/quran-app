import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pause, Play, Repeat, Search, SkipBack, SkipForward, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { VIEWS } from '../../../app/routes';
import { findPageForReference, getSurah, quranAyahs } from '../../../lib/quran';
import { getAudioUrl, getDefaultReciterId, normalizeLocalReciters } from '../../../lib/localAudio';
import { useAppStore } from '../../../store/useAppStore';

const SPEEDS = [1, 1.25, 1.5, 2];
const PRELOAD_THRESHOLD_SECONDS = 6;

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}

function getReciterImageSrc(reciter) {
  const name = getReciterDisplayName(reciter);
  const ext = reciter?.id === 'mishari-rashid-al-afasy' ? 'jpeg' : 'png';
  return `/reciters/${encodeURIComponent(name)}.${ext}`;
}

export function ReaderAudioPanel() {
  const {
    view,
    settings,
    updateSettings,
    audioTarget: ayah,
    audioPosition: currentTime,
    audioDuration: duration,
    audioPlaying: playing,
    audioRepeat: repeat,
    audioPlayerVisible,
    audioReciter,
    audioPlaybackRate,
    closeAudioPlayer,
    setAudioTarget,
    setAudioQueue,
    setAudioProgress,
    setAudioPlaying,
    setAudioRepeat,
  } = useAppStore(useShallow((state) => ({
    view: state.view,
    settings: state.settings,
    updateSettings: state.updateSettings,
    audioTarget: state.audioTarget,
    audioPosition: state.audioPosition,
    audioDuration: state.audioDuration,
    audioPlaying: state.audioPlaying,
    audioRepeat: state.audioRepeat,
    audioPlayerVisible: state.audioPlayerVisible,
    audioReciter: state.audioReciter,
    audioPlaybackRate: state.audioPlaybackRate,
    closeAudioPlayer: state.closeAudioPlayer,
    setAudioTarget: state.setAudioTarget,
    setAudioQueue: state.setAudioQueue,
    setAudioProgress: state.setAudioProgress,
    setAudioPlaying: state.setAudioPlaying,
    setAudioRepeat: state.setAudioRepeat,
  })));
  const currentAudioRef = useRef(null);
  const currentTargetRef = useRef(null);
  const currentReciterRef = useRef('');
  const preloadRef = useRef(null);
  const audioHandlersRef = useRef(new WeakMap());
  const loadTokenRef = useRef(0);
  const loadingRef = useRef(null);
  const preloadTokenRef = useRef(0);
  const playIntentRef = useRef(playing);
  const repeatRef = useRef(repeat);
  const playbackRateRef = useRef(audioPlaybackRate || settings.playbackRate || 1);
  const unmountedRef = useRef(false);

  const reciters = useMemo(() => normalizeLocalReciters(), []);
  const selectedReciter = audioReciter || settings.reciter || getDefaultReciterId();
  const selectedReciterMeta = useMemo(
    () => reciters.find((reciter) => reciter.id === selectedReciter) || reciters[0],
    [reciters, selectedReciter],
  );
  const [status, setStatus] = useState('');
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);
  const [reciterSearch, setReciterSearch] = useState('');

  const surah = ayah?.surahNumber ? getSurah(ayah.surahNumber) : null;
  const reference = ayah?.surahNumber && ayah?.ayahNumber
    ? `${surah?.name || 'Surah'} ${ayah.surahNumber}:${ayah.ayahNumber}`
    : 'Audio player';
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const filteredReciters = useMemo(() => {
    const query = reciterSearch.trim().toLowerCase();
    if (!query) return reciters;
    return reciters.filter((reciter) => getReciterDisplayName(reciter).toLowerCase().includes(query));
  }, [reciterSearch, reciters]);

  repeatRef.current = repeat;
  playbackRateRef.current = audioPlaybackRate || settings.playbackRate || 1;

  useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
      loadTokenRef.current += 1;
      preloadTokenRef.current += 1;
      loadingRef.current = null;
      disposeAudio(currentAudioRef.current);
      disposePreload();
      currentAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    playIntentRef.current = playing;
    const audio = currentAudioRef.current;

    if (
      playing &&
      audio?.paused &&
      !audio.ended &&
      sameTarget(currentTargetRef.current, ayah)
    ) {
      startCurrentAudio();
    } else if (!playing && audio && !audio.paused) {
      audio.pause();
    }
  }, [playing]);

  useEffect(() => {
    if (!settings.reciter && selectedReciter) {
      updateSettings({ reciter: selectedReciter });
    }
  }, [settings.reciter, selectedReciter, updateSettings]);

  useEffect(() => {
    if (!ayah?.surahNumber || !ayah?.ayahNumber) return;

    const target = normalizeTarget(ayah);
    const currentMatches = (
      sameTarget(currentTargetRef.current, target) &&
      currentReciterRef.current === selectedReciter &&
      currentAudioRef.current
    );
    const loadingMatches = (
      sameTarget(loadingRef.current?.target, target) &&
      loadingRef.current?.reciterId === selectedReciter
    );

    if (!currentMatches && !loadingMatches) {
      playIntentRef.current = playing;
      loadTarget(target, selectedReciter, playing);
    }
  }, [ayah?.surahNumber, ayah?.ayahNumber, selectedReciter]);

  useEffect(() => {
    const rate = audioPlaybackRate || settings.playbackRate || 1;
    playbackRateRef.current = rate;

    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = rate;
    }
    if (preloadRef.current?.audio) {
      preloadRef.current.audio.playbackRate = rate;
    }
  }, [audioPlaybackRate, settings.playbackRate]);

  function bindCurrentAudio(audio) {
    const handlers = {
      loadedmetadata: () => {
        if (audio !== currentAudioRef.current) return;
        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
      },
      durationchange: () => {
        if (audio !== currentAudioRef.current) return;
        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
      },
      timeupdate: () => {
        if (audio !== currentAudioRef.current) return;

        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
        const remaining = (audio.duration || 0) - (audio.currentTime || 0);
        if (remaining > 0 && remaining <= PRELOAD_THRESHOLD_SECONDS) {
          ensureNextPreloaded(currentTargetRef.current, currentReciterRef.current);
        }
      },
      play: () => {
        if (audio !== currentAudioRef.current) return;
        setAudioPlaying(true);
        setStatus('');
      },
      pause: () => {
        if (audio !== currentAudioRef.current || audio.ended) return;
        setAudioPlaying(false);
      },
      ended: () => {
        if (audio !== currentAudioRef.current) return;
        handleEnded(audio);
      },
      error: () => {
        if (audio !== currentAudioRef.current) return;
        playIntentRef.current = false;
        setAudioPlaying(false);
        setStatus('Audio playback could not continue.');
      },
    };

    Object.entries(handlers).forEach(([eventName, handler]) => {
      audio.addEventListener(eventName, handler);
    });
    audioHandlersRef.current.set(audio, handlers);
  }

  function unbindAudio(audio) {
    if (!audio) return;

    const handlers = audioHandlersRef.current.get(audio);
    if (!handlers) return;

    Object.entries(handlers).forEach(([eventName, handler]) => {
      audio.removeEventListener(eventName, handler);
    });
    audioHandlersRef.current.delete(audio);
  }

  function disposeAudio(audio) {
    if (!audio) return;

    unbindAudio(audio);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  function disposePreload() {
    const preload = preloadRef.current;
    preloadRef.current = null;
    if (preload?.audio) disposeAudio(preload.audio);
  }

  function installCurrentAudio(audio, target, reciterId) {
    const previousAudio = currentAudioRef.current;
    if (previousAudio && previousAudio !== audio) {
      disposeAudio(previousAudio);
    }

    currentAudioRef.current = audio;
    currentTargetRef.current = target;
    currentReciterRef.current = reciterId;
    audio.playbackRate = playbackRateRef.current;
    bindCurrentAudio(audio);
    setAudioProgress(
      audio.currentTime || 0,
      Number.isFinite(audio.duration) ? audio.duration : 0,
    );
  }

  async function startCurrentAudio() {
    const audio = currentAudioRef.current;
    if (!audio || !playIntentRef.current || unmountedRef.current) return;

    try {
      audio.playbackRate = playbackRateRef.current;
      await audio.play();
      if (audio !== currentAudioRef.current) return;
      setAudioPlaying(true);
      setStatus('');
    } catch (error) {
      if (audio !== currentAudioRef.current) return;
      playIntentRef.current = false;
      setAudioPlaying(false);
      setStatus(error?.message || 'Audio playback could not start.');
    }
  }

  async function loadTarget(target, reciterId, autoplay) {
    if (!target || unmountedRef.current) return;

    const loadToken = ++loadTokenRef.current;
    loadingRef.current = { target, reciterId, loadToken };
    preloadTokenRef.current += 1;
    disposePreload();
    disposeAudio(currentAudioRef.current);
    currentAudioRef.current = null;
    currentTargetRef.current = target;
    currentReciterRef.current = reciterId;
    setAudioProgress(0, 0);
    setStatus('Loading audio...');

    try {
      const url = await getAudioUrl(reciterId, target.surahNumber, target.ayahNumber);
      if (unmountedRef.current || loadToken !== loadTokenRef.current) return;

      if (!url) {
        loadingRef.current = null;
        playIntentRef.current = false;
        setAudioPlaying(false);
        setStatus('Audio is not available for this ayah and reciter.');
        return;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.playbackRate = playbackRateRef.current;
      installCurrentAudio(audio, target, reciterId);
      loadingRef.current = null;
      audio.load();
      setStatus('');
      ensureNextPreloaded(target, reciterId);

      if (autoplay) {
        playIntentRef.current = true;
        await startCurrentAudio();
      } else {
        setAudioPlaying(false);
      }
    } catch (error) {
      if (unmountedRef.current || loadToken !== loadTokenRef.current) return;
      loadingRef.current = null;
      playIntentRef.current = false;
      setAudioPlaying(false);
      setStatus(error?.message || 'Audio could not be loaded.');
    }
  }

  async function ensureNextPreloaded(target, reciterId) {
    if (unmountedRef.current) return null;

    const nextTarget = getAdjacentTarget(target, 1);
    if (!nextTarget || !reciterId) {
      disposePreload();
      setAudioQueue(target ? [target] : [], target ? 0 : -1);
      return null;
    }

    setAudioQueue([target, nextTarget], 0);

    const existing = preloadRef.current;
    if (
      existing &&
      existing.reciterId === reciterId &&
      sameTarget(existing.target, nextTarget)
    ) {
      return existing.promise || existing;
    }

    const preloadToken = ++preloadTokenRef.current;
    disposePreload();
    const preload = {
      audio: null,
      target: nextTarget,
      reciterId,
      promise: null,
    };
    preloadRef.current = preload;

    preload.promise = getAudioUrl(
      reciterId,
      nextTarget.surahNumber,
      nextTarget.ayahNumber,
    ).then((url) => {
      if (
        unmountedRef.current ||
        preloadToken !== preloadTokenRef.current ||
        preloadRef.current !== preload ||
        !url
      ) {
        return null;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.playbackRate = playbackRateRef.current;
      audio.load();
      preload.audio = audio;
      preload.promise = null;
      return preload;
    }).catch(() => {
      if (preloadRef.current === preload) {
        preloadRef.current = null;
      }
      return null;
    });

    return preload.promise;
  }

  async function handleEnded(endedAudio) {
    if (repeatRef.current) {
      endedAudio.currentTime = 0;
      playIntentRef.current = true;
      await startCurrentAudio();
      return;
    }

    const nextTarget = getAdjacentTarget(currentTargetRef.current, 1);
    if (!nextTarget) {
      playIntentRef.current = false;
      setAudioPlaying(false);
      return;
    }

    playIntentRef.current = true;
    const preload = await ensureNextPreloaded(
      currentTargetRef.current,
      currentReciterRef.current,
    );
    if (
      unmountedRef.current ||
      endedAudio !== currentAudioRef.current
    ) {
      return;
    }

    if (!preload?.audio || !sameTarget(preload.target, nextTarget)) {
      setAudioTarget(nextTarget);
      await loadTarget(nextTarget, currentReciterRef.current, true);
      return;
    }

    preloadRef.current = null;
    const previousAudio = currentAudioRef.current;
    unbindAudio(previousAudio);

    currentAudioRef.current = null;
    installCurrentAudio(preload.audio, nextTarget, preload.reciterId);
    disposeAudio(previousAudio);
    setAudioTarget(nextTarget);
    await startCurrentAudio();
    ensureNextPreloaded(nextTarget, preload.reciterId);
  }

  function seek(value) {
    const audio = currentAudioRef.current;
    const nextTime = Number(value) || 0;
    setAudioProgress(nextTime, duration);
    if (audio) audio.currentTime = nextTime;
  }

  function togglePlay() {
    const audio = currentAudioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      playIntentRef.current = false;
      audio.pause();
      setAudioPlaying(false);
      return;
    }

    playIntentRef.current = true;
    startCurrentAudio();
  }

  function moveAyah(direction) {
    const sourceTarget = currentTargetRef.current || normalizeTarget(ayah);
    const nextTarget = getAdjacentTarget(sourceTarget, direction);
    if (!nextTarget) return;

    playIntentRef.current = true;
    setAudioPlaying(true);
    setAudioTarget(nextTarget);
    loadTarget(nextTarget, selectedReciter, true);
  }

  function cycleSpeed() {
    const current = audioPlaybackRate || settings.playbackRate || 1;
    const index = SPEEDS.indexOf(current);
    const next = SPEEDS[(index + 1) % SPEEDS.length] || 1;
    updateSettings({ playbackRate: next });
  }

  function selectReciter(reciterId) {
    updateSettings({ reciter: reciterId });
    setReciterPickerOpen(false);
    setReciterSearch('');
  }

  function closePlayer() {
    playIntentRef.current = false;
    loadTokenRef.current += 1;
    loadingRef.current = null;
    preloadTokenRef.current += 1;
    disposeAudio(currentAudioRef.current);
    disposePreload();
    currentAudioRef.current = null;
    currentTargetRef.current = null;
    setAudioPlaying(false);
    closeAudioPlayer();
  }

  return (
    <div
      className={`reader-audio-panel-wrap ${audioPlayerVisible ? 'reader-audio-panel-visible' : 'reader-audio-panel-hidden'} ${view === VIEWS.READER ? 'reader-audio-over-reader' : 'reader-audio-over-screen'}`}
      data-reader-ui
    >
      <section className="reader-audio-panel reader-audio-panel-modern">
        <div className="reader-audio-head reader-audio-head-centered">
          <span aria-hidden="true" />
          <strong>{reference}</strong>
          <button onClick={closePlayer} aria-label="Close audio player"><X size={18} /></button>
        </div>

        <button
          className="reader-reciter-row reader-reciter-pill"
          type="button"
          onClick={() => setReciterPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={reciterPickerOpen}
        >
          <span className="reader-reciter-avatar" aria-hidden="true">
            <img
              src={getReciterImageSrc(selectedReciterMeta)}
              alt=""
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          </span>
          <span className="reader-reciter-copy">
            <span>{getReciterDisplayName(selectedReciterMeta)}</span>
          </span>
          <ChevronDown size={17} />
        </button>

        <div className="reader-audio-times reader-audio-times-above" dir="ltr">
          <span>{formatTime(duration || 0)}</span>
          <span>{formatTime(currentTime)}</span>
        </div>

        <div className="reader-audio-waveform reader-audio-wave-line" style={{ '--audio-progress': progressRatio }}>
          <div className="reader-audio-wave-track" aria-hidden="true">
            <span className="reader-audio-wave-remaining" />
            <span className="reader-audio-wave-played">
              <svg viewBox="0 0 300 24" preserveAspectRatio="none" focusable="false" aria-hidden="true">
                <path d="M0 12 C14 5 28 19 42 12 S70 5 84 12 S112 19 126 12 S154 5 168 12 S196 19 210 12 S238 5 252 12 S280 19 300 12" />
              </svg>
            </span>
            <span className="reader-audio-wave-thumb" />
          </div>
          <input
            className="reader-audio-progress reader-audio-progress-overlay"
            dir="rtl"
            type="range"
            min="0"
            max={duration || 0}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seek(event.target.value)}
            aria-label="Audio progress"
          />
        </div>

        <div className="reader-transport-row reader-transport-modern">
          <button className={repeat ? 'transport-active' : ''} onClick={() => setAudioRepeat(!repeat)} aria-label="Repeat ayah">
            <Repeat size={22} />
          </button>
          <button onClick={() => moveAyah(-1)} aria-label="Previous ayah"><SkipBack size={24} fill="currentColor" /></button>
          <button className="transport-main" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={29} fill="currentColor" /> : <Play size={29} fill="currentColor" />}
          </button>
          <button onClick={() => moveAyah(1)} aria-label="Next ayah"><SkipForward size={24} fill="currentColor" /></button>
          <button className="transport-speed" onClick={cycleSpeed} aria-label="Playback speed">
            {audioPlaybackRate || settings.playbackRate || 1}x
          </button>
        </div>

        {status && <p className="reader-audio-status">{status}</p>}

        {reciterPickerOpen && (
          <div className="reader-reciter-sheet" role="dialog" aria-modal="true" aria-label="Select reciter">
            <div className="reader-reciter-sheet-card">
              <div className="reader-reciter-sheet-handle" aria-hidden="true" />
              <div className="reader-reciter-sheet-head">
                <strong>Select Reciter</strong>
                <button type="button" onClick={() => setReciterPickerOpen(false)} aria-label="Close reciter list"><X size={19} /></button>
              </div>
              <label className="reader-reciter-search">
                <Search size={18} aria-hidden="true" />
                <input
                  value={reciterSearch}
                  onChange={(event) => setReciterSearch(event.target.value)}
                  placeholder="Search reciters"
                />
              </label>
              <div className="reader-reciter-list" role="listbox" aria-label="Reciters">
                {filteredReciters.map((reciter) => {
                  const isSelected = reciter.id === selectedReciter;
                  return (
                    <button
                      key={reciter.id}
                      type="button"
                      className={isSelected ? 'reader-reciter-list-item selected' : 'reader-reciter-list-item'}
                      onClick={() => selectReciter(reciter.id)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="reader-reciter-avatar" aria-hidden="true">
                        <img
                          src={getReciterImageSrc(reciter)}
                          alt=""
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      </span>
                      <span>{getReciterDisplayName(reciter)}</span>
                      {isSelected && <Check size={20} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeTarget(ayah) {
  if (!ayah?.surahNumber || !ayah?.ayahNumber) return null;

  return {
    page: ayah.page || findPageForReference(ayah.surahNumber, ayah.ayahNumber),
    surahNumber: Number(ayah.surahNumber),
    ayahNumber: Number(ayah.ayahNumber),
    reference: ayah.reference || `${ayah.surahNumber}:${ayah.ayahNumber}`,
    arabic: ayah.arabic || ayah.text || '',
  };
}

function getAdjacentTarget(target, direction) {
  if (!target) return null;

  const currentIndex = quranAyahs.findIndex(
    (item) =>
      item.surahNumber === Number(target.surahNumber) &&
      item.ayahNumber === Number(target.ayahNumber),
  );
  if (currentIndex < 0) return null;

  const adjacent = quranAyahs[currentIndex + direction];
  if (!adjacent) return null;

  return {
    page: findPageForReference(adjacent.surahNumber, adjacent.ayahNumber),
    surahNumber: adjacent.surahNumber,
    ayahNumber: adjacent.ayahNumber,
    reference: `${adjacent.surahNumber}:${adjacent.ayahNumber}`,
    arabic: adjacent.text,
  };
}

function sameTarget(first, second) {
  return Boolean(
    first &&
      second &&
      Number(first.surahNumber) === Number(second.surahNumber) &&
      Number(first.ayahNumber) === Number(second.ayahNumber)
  );
}
