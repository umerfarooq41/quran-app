import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Pause, Play, Repeat, SkipBack, SkipForward, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { VIEWS } from '../../../app/routes';
import { findPageForReference, getSurah, quranAyahs } from '../../../lib/quran';
import { getAudioUrl, getBundledAudioUrl, getDefaultReciterId, normalizeLocalReciters } from '../../../lib/localAudio';
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
    audioPlayerActive,
    audioPlayerVisible,
    audioReciter,
    audioPlaybackRate,
    closeAudioPlayer,
    showAudioPlayer,
    hideAudioPlayer,
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
    audioPlayerActive: state.audioPlayerActive,
    audioPlayerVisible: state.audioPlayerVisible,
    audioReciter: state.audioReciter,
    audioPlaybackRate: state.audioPlaybackRate,
    closeAudioPlayer: state.closeAudioPlayer,
    showAudioPlayer: state.showAudioPlayer,
    hideAudioPlayer: state.hideAudioPlayer,
    setAudioTarget: state.setAudioTarget,
    setAudioQueue: state.setAudioQueue,
    setAudioProgress: state.setAudioProgress,
    setAudioPlaying: state.setAudioPlaying,
    setAudioRepeat: state.setAudioRepeat,
  })));
  const nativeAudioRef = useRef(null);
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
  const rafRef = useRef(0);
  const reciterPickerRef = useRef(null);
  const reciterNameWindowRef = useRef(null);
  const reciterNameTextRef = useRef(null);
  const panelDragRef = useRef(null);
  const [visualTime, setVisualTime] = useState(currentTime || 0);
  const [reciterNameOverflow, setReciterNameOverflow] = useState(false);
  const [reciterNameScroll, setReciterNameScroll] = useState(0);

  const reciters = useMemo(() => normalizeLocalReciters(), []);
  const selectedReciter = audioReciter || settings.reciter || getDefaultReciterId();
  const selectedReciterMeta = useMemo(
    () => reciters.find((reciter) => reciter.id === selectedReciter) || reciters[0],
    [reciters, selectedReciter],
  );
  const selectedReciterName = getReciterDisplayName(selectedReciterMeta);
  const [status, setStatus] = useState('');
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);

  const surah = ayah?.surahNumber ? getSurah(ayah.surahNumber) : null;
  const reference = ayah?.surahNumber && ayah?.ayahNumber
    ? `${surah?.name || 'Surah'} ${ayah.surahNumber}:${ayah.ayahNumber}`
    : 'Audio player';
  const displayedTime = playing && duration > 0 ? visualTime : currentTime;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, displayedTime / duration)) : 0;
  const panelExpanded = audioPlayerVisible;
  repeatRef.current = repeat;
  playbackRateRef.current = audioPlaybackRate || settings.playbackRate || 1;


  useEffect(() => {
    if (!playing) {
      setVisualTime(currentTime || 0);
      return undefined;
    }

    let active = true;
    const tick = () => {
      const audio = currentAudioRef.current;
      if (audio && active) {
        setVisualTime(audio.currentTime || 0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing, currentTime, ayah?.surahNumber, ayah?.ayahNumber]);

  useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
      loadTokenRef.current += 1;
      preloadTokenRef.current += 1;
      loadingRef.current = null;
      cancelAnimationFrame(rafRef.current);
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
    const unsubscribe = useAppStore.subscribe((state, previousState) => {
      const activatedByUser = state.audioPlayerActive && !previousState.audioPlayerActive;
      if (!activatedByUser || !state.audioPlaying || !state.audioTarget) return;

      const reciterId = state.audioReciter || state.settings.reciter || getDefaultReciterId();
      const target = normalizeTarget(state.audioTarget);
      const directUrl = target
        ? getBundledAudioUrl(reciterId, target.surahNumber, target.ayahNumber)
        : '';

      if (!target || !directUrl) return;

      playIntentRef.current = true;
      loadTarget(target, reciterId, true, { directUrl });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;

    const mediaSession = navigator.mediaSession;
    if (typeof window.MediaMetadata === 'function') {
      const artworkSrc = getReciterImageSrc(selectedReciterMeta);
      mediaSession.metadata = new window.MediaMetadata({
        title: reference,
        artist: selectedReciterName,
        album: 'Quran Reader',
        artwork: [
          {
            src: artworkSrc,
            sizes: '512x512',
            type: artworkSrc.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
          },
        ],
      });
    }

    const handlers = [
      ['play', () => {
        playIntentRef.current = true;
        setAudioPlaying(true);
        startCurrentAudio();
      }],
      ['pause', () => {
        playIntentRef.current = false;
        currentAudioRef.current?.pause();
        setAudioPlaying(false);
      }],
      ['previoustrack', () => moveAyah(-1)],
      ['nexttrack', () => moveAyah(1)],
    ];

    handlers.forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but not every action.
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // No cleanup needed for unsupported actions.
        }
      });
    };
  }, [
    reference,
    selectedReciterName,
    selectedReciterMeta,
    selectedReciter,
    ayah?.surahNumber,
    ayah?.ayahNumber,
  ]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    syncMediaSessionPosition(currentAudioRef.current);
  }, [playing, currentTime, duration]);

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

  useEffect(() => {
    if (!reciterPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!reciterPickerRef.current?.contains(event.target)) {
        setReciterPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [reciterPickerOpen]);

  useEffect(() => {
    const windowElement = reciterNameWindowRef.current;
    const textElement = reciterNameTextRef.current;
    if (!windowElement || !textElement) return undefined;

    let frame = 0;

    const measure = () => {
      const distance = Math.ceil(textElement.scrollWidth - windowElement.clientWidth);
      setReciterNameOverflow(distance > 4);
      setReciterNameScroll(Math.max(0, distance + 18));
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(windowElement);
    resizeObserver?.observe(textElement);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [selectedReciterName]);

  function bindCurrentAudio(audio) {
    const handlers = {
      loadedmetadata: () => {
        if (audio !== currentAudioRef.current) return;
        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
        syncMediaSessionPosition(audio);
      },
      durationchange: () => {
        if (audio !== currentAudioRef.current) return;
        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
        syncMediaSessionPosition(audio);
      },
      timeupdate: () => {
        if (audio !== currentAudioRef.current) return;

        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
        syncMediaSessionPosition(audio);
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

  function syncMediaSessionPosition(audio) {
    if (!audio || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) {
      return;
    }

    const mediaDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!mediaDuration) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: mediaDuration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(mediaDuration, Math.max(0, audio.currentTime || 0)),
      });
    } catch {
      // Position state is advisory and may reject partial media metadata.
    }
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

  function installAudioUrl(url, target, reciterId) {
    const audio = nativeAudioRef.current || new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.src = url;
    audio.playbackRate = playbackRateRef.current;
    installCurrentAudio(audio, target, reciterId);
    loadingRef.current = null;
    audio.load();
    setStatus('');
    ensureNextPreloaded(target, reciterId);
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

  async function loadTarget(target, reciterId, autoplay, options = {}) {
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
      const directUrl = options.directUrl || getBundledAudioUrl(
        reciterId,
        target.surahNumber,
        target.ayahNumber,
      );

      if (directUrl) {
        installAudioUrl(directUrl, target, reciterId);

        if (autoplay) {
          playIntentRef.current = true;
          await startCurrentAudio();
        } else {
          setAudioPlaying(false);
        }
        return;
      }

      const url = await getAudioUrl(reciterId, target.surahNumber, target.ayahNumber);
      if (unmountedRef.current || loadToken !== loadTokenRef.current) return;

      if (!url) {
        loadingRef.current = null;
        playIntentRef.current = false;
        setAudioPlaying(false);
        setStatus('Audio is not available for this ayah and reciter.');
        return;
      }

      installAudioUrl(url, target, reciterId);

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

    if (nativeAudioRef.current) {
      disposePreload();
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
    setVisualTime(nextTime);
    setAudioProgress(nextTime, duration);
    if (audio) audio.currentTime = nextTime;
    syncMediaSessionPosition(audio);
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

  function handlePanelGrabberPointerDown(event, mode) {
    if (event.button !== undefined && event.button !== 0) return;

    const startY = event.clientY;
    panelDragRef.current = { startY, mode };

    const handlePointerMove = (moveEvent) => {
      if (!panelDragRef.current) return;
      panelDragRef.current.deltaY = moveEvent.clientY - startY;
    };

    const handlePointerUp = (upEvent) => {
      const drag = panelDragRef.current;
      panelDragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      const deltaY = drag?.deltaY ?? (upEvent.clientY - startY);
      if (mode === 'collapse' && deltaY > 28) hideAudioPlayer();
      if (mode === 'expand' && deltaY < -22) showAudioPlayer();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  }

  function renderGrabber(mode) {
    const isExpand = mode === 'expand';

    return (
      <button
        type="button"
        className="reader-audio-grabber"
        onClick={isExpand ? showAudioPlayer : hideAudioPlayer}
        onPointerDown={(event) => handlePanelGrabberPointerDown(event, isExpand ? 'expand' : 'collapse')}
        aria-label={isExpand ? 'Expand audio player' : 'Collapse audio player'}
      >
        <span aria-hidden="true" />
      </button>
    );
  }

  function renderTransportControls(compact = false) {
    return (
      <div className={compact ? 'reader-transport-row reader-transport-modern reader-transport-mini' : 'reader-transport-row reader-transport-modern'}>
        <button
          type="button"
          className={repeat ? 'transport-active' : ''}
          onClick={() => setAudioRepeat(!repeat)}
          aria-label="Repeat ayah"
        >
          <Repeat size={30} />
        </button>
        <button type="button" onClick={() => moveAyah(-1)} aria-label="Previous ayah">
          <SkipBack size={31} />
        </button>
        <button type="button" className="transport-main" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
        </button>
        <button type="button" onClick={() => moveAyah(1)} aria-label="Next ayah">
          <SkipForward size={31} />
        </button>
        <button type="button" className="transport-speed" onClick={cycleSpeed} aria-label="Playback speed">
          {audioPlaybackRate || settings.playbackRate || 1}x
        </button>
      </div>
    );
  }

  const nativeAudioElement = (
    <audio ref={nativeAudioRef} className="reader-audio-native" preload="auto" playsInline />
  );

  if (!audioPlayerActive) return nativeAudioElement;

  return (
    <>
      {nativeAudioElement}

      <motion.div
        layout
        initial={false}
        className={`reader-audio-panel-wrap ${panelExpanded ? 'reader-audio-panel-visible reader-audio-panel-expanded' : 'reader-audio-panel-visible reader-audio-panel-collapsed'} ${view === VIEWS.READER ? 'reader-audio-over-reader' : 'reader-audio-over-screen'}`}
        data-reader-ui
      >
        <motion.section
          layout
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          className={`reader-audio-panel reader-audio-panel-modern ${panelExpanded ? 'reader-audio-expanded-panel' : 'reader-audio-mini-panel'}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {panelExpanded ? (
              <motion.div
                key="expanded"
                layout
                initial={{ opacity: 0, y: 18, scale: .98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: .985 }}
                transition={{ type: 'spring', stiffness: 430, damping: 36 }}
                className="reader-audio-expanded-content"
              >
                {renderGrabber('collapse')}

                <div className="reader-audio-head reader-audio-head-centered">
                  <span aria-hidden="true" />
                  <strong>{reference}</strong>
                  <button type="button" onClick={closePlayer} aria-label="Close audio player"><X size={28} /></button>
                </div>

                <div
                  ref={reciterPickerRef}
                  className={reciterPickerOpen ? 'reader-reciter-picker is-open' : 'reader-reciter-picker'}
                >
                  <button
                    className="reader-reciter-row reader-reciter-pill"
                    type="button"
                    onClick={() => setReciterPickerOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={reciterPickerOpen}
                  >
                    <span className="reader-reciter-avatar" aria-hidden="true">
                      <img
                        src={getReciterImageSrc(selectedReciterMeta)}
                        alt=""
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                      />
                    </span>
                    <span ref={reciterNameWindowRef} className="reader-reciter-name-window">
                      <span
                        ref={reciterNameTextRef}
                        className={reciterNameOverflow ? 'reader-reciter-name-text is-overflowing' : 'reader-reciter-name-text'}
                        style={{ '--reciter-name-scroll': `${reciterNameScroll}px` }}
                      >
                        {selectedReciterName}
                      </span>
                    </span>
                    <span className="reader-reciter-chevron" aria-hidden="true">
                      <ChevronDown size={24} />
                    </span>
                  </button>

                  <div className="reader-reciter-inline-panel" aria-hidden={!reciterPickerOpen}>
                    <div className="reader-reciter-list" role="listbox" aria-label="Reciters">
                      {reciters.map((reciter) => {
                        const isSelected = reciter.id === selectedReciter;
                        return (
                          <button
                            key={reciter.id}
                            type="button"
                            className={isSelected ? 'reader-reciter-list-item selected' : 'reader-reciter-list-item'}
                            onClick={() => selectReciter(reciter.id)}
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={reciterPickerOpen ? 0 : -1}
                          >
                            <span className="reader-reciter-avatar" aria-hidden="true">
                              <img
                                src={getReciterImageSrc(reciter)}
                                alt=""
                                onError={(event) => { event.currentTarget.style.display = 'none'; }}
                              />
                            </span>
                            <span>
                              {getReciterDisplayName(reciter)}
                            </span>
                            <span className="reader-reciter-check" aria-hidden="true">
                              {isSelected ? <Check size={19} /> : <span className="reader-reciter-option-radio" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="reader-audio-waveform reader-audio-wave-line" style={{ '--audio-progress': progressRatio }}>
                  <div className="reader-audio-wave-track" aria-hidden="true">
                    <span className="reader-audio-wave-remaining" />
                    <span className="reader-audio-wave-played" />
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

                <div className="reader-audio-times reader-audio-times-above" dir="ltr">
                  <span>{formatTime(duration || 0)}</span>
                  <span>{formatTime(displayedTime)}</span>
                </div>

                {renderTransportControls()}

                {status && <p className="reader-audio-status">{status}</p>}
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                layout
                initial={{ opacity: 0, y: 18, scale: .98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: .985 }}
                transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                className="reader-audio-mini-content"
              >
                {renderGrabber('expand')}
                {renderTransportControls(true)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>

    </>
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
