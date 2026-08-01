import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pause, Play, Repeat, SkipBack, SkipForward, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { VIEWS } from '../../../app/routes';
import { findPageForReference, getSurah, quranAyahs } from '../../../lib/quran';
import {
  findAyahAtTime,
  findAyahTiming,
  findWordAtTime,
  getFullSurahPlayback,
} from '../../../lib/fullSurahAudio';
import {
  getAudioUrl,
  getDefaultReciterId,
  getReciterImageUrl,
  hasAyahAudio,
  normalizeLocalReciters,
} from '../../../lib/localAudio';
import { useAppStore } from '../../../store/useAppStore';

const SPEEDS = [1, 1.25, 1.5, 2];
const AUDIO_METADATA_TIMEOUT_MS = 20000;
const RESTART_CURRENT_AYAH_THRESHOLD_MS = 2000;
const REPEAT_MODES = ['off', 'ayah', 'surah'];
const AUDIO_USER_PLAY_REQUEST_EVENT = 'quran:audio-user-play-request';
const SILENT_AUDIO_UNLOCK_SRC = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAA';

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
  return getReciterImageUrl(reciter);
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
    setAudioMode,
    setAudioSurahNumber,
    setPlayingVerseKey,
    setPlayingWord,
    setSurahTimeline,
    goAyah,
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
    setAudioMode: state.setAudioMode,
    setAudioSurahNumber: state.setAudioSurahNumber,
    setPlayingVerseKey: state.setPlayingVerseKey,
    setPlayingWord: state.setPlayingWord,
    setSurahTimeline: state.setSurahTimeline,
    goAyah: state.goAyah,
  })));
  const nativeAudioRef = useRef(null);
  const currentAudioRef = useRef(null);
  const currentTargetRef = useRef(null);
  const currentReciterRef = useRef('');
  const currentSourceRef = useRef(null);
  const audioHandlersRef = useRef(new WeakMap());
  const loadTokenRef = useRef(0);
  const loadingRef = useRef(null);
  const playIntentRef = useRef(playing);
  const repeatRef = useRef(repeat || 'off');
  const playbackRateRef = useRef(audioPlaybackRate || settings.playbackRate || 1);
  const sourceTransitionRef = useRef(false);
  const recoveringRef = useRef(false);
  const audioPrimedRef = useRef(false);
  const unmountedRef = useRef(false);
  const rafRef = useRef(0);
  const rafRunningRef = useRef(false);
  const lastSyncedVerseKeyRef = useRef(null);
  const reciterPickerRef = useRef(null);
  const reciterNameWindowRef = useRef(null);
  const reciterNameTextRef = useRef(null);
  const panelDragRef = useRef(null);
  const panelHasMountedRef = useRef(false);
  const panelTransitionTimerRef = useRef(0);
  const [visualTime, setVisualTime] = useState(currentTime || 0);
  const [reciterNameOverflow, setReciterNameOverflow] = useState(false);
  const [reciterNameScroll, setReciterNameScroll] = useState(0);
  const [panelTransitioning, setPanelTransitioning] = useState(false);

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
  repeatRef.current = repeat || 'off';
  playbackRateRef.current = audioPlaybackRate || settings.playbackRate || 1;

  useEffect(() => {
    window.clearTimeout(panelTransitionTimerRef.current);

    if (!audioPlayerActive) {
      panelHasMountedRef.current = false;
      setPanelTransitioning(false);
      return undefined;
    }

    if (!panelHasMountedRef.current) {
      panelHasMountedRef.current = true;
      setPanelTransitioning(false);
      return undefined;
    }

    setPanelTransitioning(true);
    panelTransitionTimerRef.current = window.setTimeout(() => {
      setPanelTransitioning(false);
    }, 380);

    return () => {
      window.clearTimeout(panelTransitionTimerRef.current);
    };
  }, [audioPlayerActive, panelExpanded]);


  useEffect(() => {
    if (!playing) {
      setVisualTime(currentTime || 0);
      setPlayingWord(null);
      rafRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      return undefined;
    }

    if (rafRunningRef.current) return undefined;

    rafRunningRef.current = true;
    const tick = () => {
      if (!rafRunningRef.current) return;

      const audio = currentAudioRef.current;
      if (audio) {
        const nextTime = audio.currentTime || 0;
        setVisualTime(nextTime);

        if (!sourceTransitionRef.current) {
          syncFullSurahTarget(nextTime);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      rafRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  useEffect(() => {
    unmountedRef.current = false;
    const audio = nativeAudioRef.current;
    if (audio) {
      currentAudioRef.current = audio;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      bindCurrentAudio(audio);
    }

    const handleUserPlayRequest = () => {
      playIntentRef.current = true;
      primeAudioFromUserGesture();
    };
    window.addEventListener(AUDIO_USER_PLAY_REQUEST_EVENT, handleUserPlayRequest);

    return () => {
      window.removeEventListener(AUDIO_USER_PLAY_REQUEST_EVENT, handleUserPlayRequest);
      unmountedRef.current = true;
      loadTokenRef.current += 1;
      loadingRef.current = null;
      rafRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      resetAudio(audio);
      unbindAudio(audio);
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
      if (!target) return;

      playIntentRef.current = true;
      loadTarget(target, reciterId, true);
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
      currentSourceRef.current
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

        if (
          repeatRef.current === 'ayah'
          && currentSourceRef.current?.mode === 'full-surah'
        ) {
          const timing = findAyahTiming(
            currentSourceRef.current.timeline,
            currentTargetRef.current?.ayahNumber,
          );
          if (timing && audio.currentTime * 1000 >= timing.endMs) {
            audio.currentTime = clampSeekTime(audio, timing.startMs / 1000);
            syncFullSurahTarget(audio.currentTime);
            setAudioProgress(
              audio.currentTime || 0,
              Number.isFinite(audio.duration) ? audio.duration : 0,
            );
            return;
          }
        }

        setAudioProgress(
          audio.currentTime || 0,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
        syncMediaSessionPosition(audio);
      },
      play: () => {
        if (audio !== currentAudioRef.current) return;
        syncPlaybackStateForCurrentSource();
        setAudioPlaying(true);
        setStatus('');
      },
      pause: () => {
        if (
          audio !== currentAudioRef.current
          || audio.ended
          || sourceTransitionRef.current
        ) {
          return;
        }
        setAudioPlaying(false);
      },
      ended: () => {
        if (audio !== currentAudioRef.current) return;
        handleEnded(audio);
      },
      error: () => {
        if (
          audio !== currentAudioRef.current
          || sourceTransitionRef.current
          || loadingRef.current
        ) {
          return;
        }
        recoverFromAudioError(audio);
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

  function resetAudio(audio) {
    if (!audio) return;

    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    currentSourceRef.current = null;
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

  function primeAudioFromUserGesture() {
    const audio = currentAudioRef.current;
    if (
      !audio
      || unmountedRef.current
      || currentSourceRef.current
      || audio.currentSrc
    ) {
      return;
    }

    sourceTransitionRef.current = true;
    audio.loop = true;
    audio.muted = true;
    audio.src = SILENT_AUDIO_UNLOCK_SRC;
    audio.load();
    const primedSource = audio.src;

    Promise.resolve(audio.play())
      .then(() => {
        audioPrimedRef.current = true;
      })
      .catch(() => {
        audioPrimedRef.current = false;
        // The real source will still use the normal play path. A rejected
        // unlock attempt must never leave the shared element muted.
      })
      .finally(() => {
        if (audio.src === primedSource && !loadingRef.current) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        audio.loop = false;
        audio.muted = false;
        sourceTransitionRef.current = false;
      });
  }

  async function startCurrentAudio() {
    const audio = currentAudioRef.current;
    if (!audio || !playIntentRef.current || unmountedRef.current) return false;

    try {
      audio.playbackRate = playbackRateRef.current;
      await audio.play();
      if (audio !== currentAudioRef.current) return false;
      setAudioPlaying(true);
      setStatus('');
      return true;
    } catch (error) {
      if (audio !== currentAudioRef.current) return false;
      if (
        currentSourceRef.current?.mode === 'full-surah'
        && (error?.name === 'NotSupportedError' || error?.name === 'NetworkError')
      ) {
        recoverFromAudioError(audio);
        return false;
      }
      playIntentRef.current = false;
      setAudioPlaying(false);
      setStatus('Tap Play to allow audio on this device.');
      return false;
    }
  }

  async function loadTarget(target, reciterId, autoplay, options = {}) {
    if (!target || unmountedRef.current) return;

    const loadToken = ++loadTokenRef.current;
    loadingRef.current = { target, reciterId, loadToken };
    currentTargetRef.current = target;
    currentReciterRef.current = reciterId;
    playIntentRef.current = Boolean(autoplay);
    lastSyncedVerseKeyRef.current = null;
    setPlayingVerseKey(null);
    updateAudioQueue(target);
    setStatus('Loading audio...');

    let fullSurahError = null;

    try {
      if (!options.skipFullSurah) {
        try {
          const installed = await loadFullSurahTarget(target, reciterId, loadToken);
          if (isStaleLoad(loadToken)) return;
          if (installed) {
            loadingRef.current = null;
            setStatus('');
            if (autoplay) {
              await startCurrentAudio();
            } else {
              currentAudioRef.current?.pause();
              setAudioPlaying(false);
            }
            return;
          }
        } catch (error) {
          if (isStaleLoad(loadToken)) return;
          fullSurahError = error;
        }
      }

      if (!hasAyahAudio(reciterId)) {
        throw createUnavailableError();
      }

      await loadAyahFallbackTarget(target, reciterId, loadToken);
      if (isStaleLoad(loadToken)) return;
      loadingRef.current = null;
      setStatus('');
      if (autoplay) {
        await startCurrentAudio();
      } else {
        currentAudioRef.current?.pause();
        setAudioPlaying(false);
      }
    } catch (error) {
      if (isStaleLoad(loadToken)) return;
      loadingRef.current = null;
      sourceTransitionRef.current = false;
      playIntentRef.current = false;
      setAudioPlaying(false);
      setPlayingVerseKey(null);
      setStatus(
        error?.code === 'AUDIO_UNAVAILABLE' || fullSurahError
          ? 'Audio is not available for this ayah and reciter.'
          : (error?.message || 'Audio could not be loaded.'),
      );
    }
  }

  async function loadFullSurahTarget(target, reciterId, loadToken) {
    const playback = await getFullSurahPlayback(reciterId, target.surahNumber);
    if (
      isStaleLoad(loadToken)
      || !playback
      || playback.reciterId !== reciterId
    ) {
      return false;
    }

    const timing = findAyahTiming(playback.timeline, target.ayahNumber);
    if (!timing) return false;

    await installAudioSource({
      audioUrl: playback.audioUrl,
      loadToken,
      reciterId,
      seekSeconds: timing.startMs / 1000,
      source: {
        mode: 'full-surah',
        reciterId: playback.reciterId,
        surahNumber: target.surahNumber,
        audioUrl: playback.audioUrl,
        timeline: playback.timeline,
      },
      target,
    });
    return true;
  }

  async function loadAyahFallbackTarget(target, reciterId, loadToken) {
    const audioUrl = await getAudioUrl(reciterId, target.surahNumber, target.ayahNumber);
    if (isStaleLoad(loadToken)) return;
    if (!audioUrl) throw createUnavailableError();

    await installAudioSource({
      audioUrl,
      loadToken,
      reciterId,
      seekSeconds: 0,
      source: {
        mode: 'ayah-fallback',
        reciterId,
        surahNumber: target.surahNumber,
        verseKey: `${target.surahNumber}:${target.ayahNumber}`,
        audioUrl,
        timeline: null,
      },
      target,
    });
  }

  async function installAudioSource({
    audioUrl,
    loadToken,
    reciterId,
    seekSeconds,
    source,
    target,
  }) {
    const audio = currentAudioRef.current;
    if (!audio) throw new Error('Audio player is unavailable.');

    const currentSource = currentSourceRef.current;
    const sameSource = (
      currentSource
      && currentSource.mode === source.mode
      && currentSource.reciterId === source.reciterId
      && currentSource.audioUrl === source.audioUrl
      && (
        source.mode === 'full-surah'
          ? currentSource.surahNumber === source.surahNumber
          : currentSource.verseKey === source.verseKey
      )
    );

    sourceTransitionRef.current = true;
    try {
      audio.loop = false;
      audio.muted = false;
      audio.volume = 1;
      if (!sameSource) {
        audio.pause();
        currentSourceRef.current = source;
        audio.src = audioUrl;
        audio.playbackRate = playbackRateRef.current;
        audio.load();

        // Start the real source as soon as it is installed. The shared audio
        // element was primed by the originating tap, so this avoids waiting
        // until after asynchronous metadata work has lost user activation.
        if (playIntentRef.current && audioPrimedRef.current) {
          Promise.resolve(audio.play()).catch(() => {
            // startCurrentAudio() retries after metadata becomes seekable and
            // provides the user-facing message if the browser still blocks it.
          });
        }

        setAudioProgress(0, 0);
      } else {
        currentSourceRef.current = source;
      }

      syncPlaybackStateForSource(source, target);

      await waitForSeekableAudio(audio, loadToken);
      if (isStaleLoad(loadToken)) throw createAbortError();

      currentTargetRef.current = target;
      currentReciterRef.current = reciterId;
      audio.playbackRate = playbackRateRef.current;
      audio.currentTime = clampSeekTime(audio, seekSeconds);
      setVisualTime(audio.currentTime || 0);
      syncFullSurahTarget(audio.currentTime || 0);
      setAudioProgress(
        audio.currentTime || 0,
        Number.isFinite(audio.duration) ? audio.duration : 0,
      );
      syncMediaSessionPosition(audio);
    } finally {
      if (loadToken === loadTokenRef.current) {
        sourceTransitionRef.current = false;
      }
    }
  }

  function waitForSeekableAudio(audio, loadToken) {
    if (
      audio.readyState >= HTMLMediaElement.HAVE_METADATA
      && Number.isFinite(audio.duration)
      && audio.duration > 0
    ) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let timeout = 0;

      const cleanup = () => {
        window.clearTimeout(timeout);
        audio.removeEventListener('loadedmetadata', handleReady);
        audio.removeEventListener('durationchange', handleReady);
        audio.removeEventListener('canplay', handleReady);
        audio.removeEventListener('error', handleError);
      };
      const handleReady = () => {
        if (isStaleLoad(loadToken)) {
          cleanup();
          reject(createAbortError());
          return;
        }
        if (
          audio.readyState >= HTMLMediaElement.HAVE_METADATA
          && Number.isFinite(audio.duration)
          && audio.duration > 0
        ) {
          cleanup();
          resolve();
        }
      };
      const handleError = () => {
        cleanup();
        reject(new Error('Audio metadata could not be loaded.'));
      };

      audio.addEventListener('loadedmetadata', handleReady);
      audio.addEventListener('durationchange', handleReady);
      audio.addEventListener('canplay', handleReady);
      audio.addEventListener('error', handleError);
      timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Audio metadata took too long to load.'));
      }, AUDIO_METADATA_TIMEOUT_MS);
      handleReady();
    });
  }

  async function handleEnded(endedAudio) {
    const source = currentSourceRef.current;
    const repeatMode = repeatRef.current || 'off';
    setPlayingVerseKey(null);

    if (repeatMode === 'ayah') {
      const timing = source?.mode === 'full-surah'
        ? findAyahTiming(source.timeline, currentTargetRef.current?.ayahNumber)
        : null;
      endedAudio.currentTime = clampSeekTime(endedAudio, timing ? timing.startMs / 1000 : 0);
      playIntentRef.current = true;
      syncFullSurahTarget(endedAudio.currentTime);
      await startCurrentAudio();
      return;
    }

    if (repeatMode === 'surah' && source?.mode === 'full-surah') {
      const firstTiming = source.timeline?.[0];
      endedAudio.currentTime = clampSeekTime(endedAudio, (firstTiming?.startMs || 0) / 1000);
      playIntentRef.current = true;
      syncFullSurahTarget(endedAudio.currentTime);
      await startCurrentAudio();
      return;
    }

    let nextTarget = source?.mode === 'full-surah'
      ? getFirstTargetOfSurah(Number(source.surahNumber) + 1)
      : getAdjacentTarget(currentTargetRef.current, 1);

    if (repeatMode === 'surah' && source?.mode === 'ayah-fallback') {
      if (!nextTarget || nextTarget.surahNumber !== currentTargetRef.current?.surahNumber) {
        nextTarget = getFirstTargetOfSurah(currentTargetRef.current?.surahNumber);
      }
    }

    if (!nextTarget) {
      playIntentRef.current = false;
      setAudioPlaying(false);
      setPlayingVerseKey(null);
      return;
    }

    playIntentRef.current = true;
    setAudioTarget(nextTarget);
    await loadTarget(nextTarget, currentReciterRef.current, true);
  }

  function syncFullSurahTarget(timeSeconds) {
    const source = currentSourceRef.current;
    if (source?.mode !== 'full-surah') {
      setPlayingWord(null);
      return;
    }

    const timeMs = timeSeconds * 1000;
    const timing = findAyahAtTime(source.timeline, timeMs);
    if (!timing) {
      lastSyncedVerseKeyRef.current = null;
      setPlayingVerseKey(null);
      return;
    }

    if (lastSyncedVerseKeyRef.current !== timing.verseKey) {
      lastSyncedVerseKeyRef.current = timing.verseKey;
      setPlayingVerseKey(timing.verseKey);
    }

    const wordTiming = findWordAtTime(timing, timeMs);
    setPlayingWord(wordTiming?.position, wordTiming?.occurrenceIndex);

    const target = targetFromTiming(timing);
    const currentTarget = currentTargetRef.current;
    const sameVerse = sameTarget(currentTarget, timing);
    const sameCanonicalPage = Number(currentTarget?.page) === Number(target?.page);

    // A target can have the correct verse but a stale page (for example when
    // playback starts from an ayah after an earlier navigation). Do not return
    // early until both the verse and its canonical Mushaf page are correct.
    if (sameVerse && sameCanonicalPage) return;

    currentTargetRef.current = target;
    setAudioTarget(target);
    updateAudioQueue(target);
  }

  function syncPlaybackStateForCurrentSource() {
    const source = currentSourceRef.current;
    const target = currentTargetRef.current;
    if (!source || !target) return;
    syncPlaybackStateForSource(source, target);
  }

  function syncPlaybackStateForSource(source, target) {
    const isFullSurah = source?.mode === 'full-surah';
    const verseKey = `${target.surahNumber}:${target.ayahNumber}`;

    setPlayingWord(null);
    setAudioMode(isFullSurah ? 'surah' : 'ayah');
    setAudioSurahNumber(target.surahNumber);
    setSurahTimeline(isFullSurah ? source.timeline : []);

    if (lastSyncedVerseKeyRef.current !== verseKey) {
      lastSyncedVerseKeyRef.current = verseKey;
      setPlayingVerseKey(verseKey);
    }
  }

  function updateAudioQueue(target) {
    const adjacent = getAdjacentTarget(target, 1);
    setAudioQueue(adjacent ? [target, adjacent] : [target], 0);
  }

  function recoverFromAudioError(audio) {
    if (
      audio !== currentAudioRef.current
      || recoveringRef.current
      || unmountedRef.current
    ) {
      return;
    }

    const source = currentSourceRef.current;
    if (source?.mode !== 'full-surah') {
      playIntentRef.current = false;
      setAudioPlaying(false);
      setStatus('Audio playback could not continue.');
      return;
    }

    const target = currentTargetRef.current;
    const reciterId = currentReciterRef.current;
    const shouldResume = playIntentRef.current;
    if (!hasAyahAudio(reciterId)) {
      playIntentRef.current = false;
      setAudioPlaying(false);
      setPlayingVerseKey(null);
      setStatus('Full-Surah audio could not continue for this reciter.');
      return;
    }
    recoveringRef.current = true;
    loadTarget(target, reciterId, shouldResume, { skipFullSurah: true })
      .finally(() => {
        recoveringRef.current = false;
      });
  }

  function isStaleLoad(loadToken) {
    return unmountedRef.current || loadToken !== loadTokenRef.current;
  }

  function seek(value) {
    const audio = currentAudioRef.current;
    const nextTime = Number(value) || 0;
    setVisualTime(nextTime);
    if (audio) {
      audio.currentTime = clampSeekTime(audio, nextTime);
      syncFullSurahTarget(audio.currentTime);
    }
    setAudioProgress(audio?.currentTime || nextTime, duration);
    syncMediaSessionPosition(audio);
  }

  function togglePlay() {
    const audio = currentAudioRef.current;
    if (!audio) return;

    if (!currentSourceRef.current) {
      const target = currentTargetRef.current || normalizeTarget(ayah);
      if (target) {
        playIntentRef.current = true;
        setAudioPlaying(true);
        loadTarget(target, selectedReciter, true);
      }
      return;
    }

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
    const audio = currentAudioRef.current;
    const source = currentSourceRef.current;
    const sourceTarget = currentTargetRef.current || normalizeTarget(ayah);
    if (!sourceTarget) return;

    if (source?.mode === 'full-surah' && audio) {
      const activeTiming = findAyahAtTime(source.timeline, audio.currentTime * 1000)
        || findAyahTiming(source.timeline, sourceTarget.ayahNumber);

      if (direction < 0 && activeTiming) {
        const elapsedMs = audio.currentTime * 1000 - activeTiming.startMs;
        if (elapsedMs > RESTART_CURRENT_AYAH_THRESHOLD_MS) {
          audio.currentTime = clampSeekTime(audio, activeTiming.startMs / 1000);
          syncFullSurahTarget(audio.currentTime);
          setAudioProgress(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0);
          return;
        }
      }

      const adjacentTiming = source.timeline?.[source.timeline.indexOf(activeTiming) + direction];
      if (adjacentTiming) {
        audio.currentTime = clampSeekTime(audio, adjacentTiming.startMs / 1000);
        syncFullSurahTarget(audio.currentTime);
        setAudioProgress(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0);
        return;
      }
    }

    const nextTarget = getAdjacentTarget(sourceTarget, direction);
    if (!nextTarget) {
      setStatus(direction < 0 ? 'No previous Surah is available.' : 'No next Surah is available.');
      return;
    }

    const shouldPlay = playIntentRef.current && !audio?.ended;
    playIntentRef.current = shouldPlay;
    setAudioPlaying(shouldPlay);
    setAudioTarget(nextTarget);
    loadTarget(nextTarget, selectedReciter, shouldPlay);
  }

  function cycleRepeatMode() {
    const currentMode = repeat || 'off';
    const currentIndex = REPEAT_MODES.indexOf(currentMode);
    const nextMode = REPEAT_MODES[(currentIndex + 1) % REPEAT_MODES.length];
    setAudioRepeat(nextMode);
    setStatus(
      nextMode === 'ayah'
        ? 'Repeat current ayah'
        : nextMode === 'surah'
          ? 'Repeat current Surah'
          : 'Repeat off',
    );
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

  function returnToCurrentRecitation(event) {
    if (event?.target?.closest?.('button, input, select, a')) return;
    const target = currentTargetRef.current || normalizeTarget(ayah);
    if (!target) return;
    goAyah(target.surahNumber, target.ayahNumber, target.page);
  }

  function closePlayer() {
    playIntentRef.current = false;
    loadTokenRef.current += 1;
    loadingRef.current = null;
    sourceTransitionRef.current = false;
    resetAudio(currentAudioRef.current);
    currentTargetRef.current = null;
    currentReciterRef.current = '';
    lastSyncedVerseKeyRef.current = null;
    setAudioMode(null);
    setAudioSurahNumber(null);
    setPlayingVerseKey(null);
    setSurahTimeline([]);
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
          className={`transport-repeat ${repeat !== 'off' ? 'transport-active' : ''}`.trim()}
          onClick={cycleRepeatMode}
          aria-label={repeat === 'ayah' ? 'Repeat current ayah' : repeat === 'surah' ? 'Repeat current Surah' : 'Repeat off'}
        >
          <Repeat size={30} />
          {repeat === 'ayah' && <span className="transport-repeat-badge" aria-hidden="true">A</span>}
          {repeat === 'surah' && <span className="transport-repeat-badge" aria-hidden="true">S</span>}
        </button>
        <button type="button" onClick={() => moveAyah(1)} aria-label="Next ayah">
          <SkipBack size={31} />
        </button>
        <button type="button" className="transport-main" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
        </button>
        <button type="button" onClick={() => moveAyah(-1)} aria-label="Previous ayah">
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

  const panelWrapClassName = [
    'reader-audio-panel-wrap',
    'reader-audio-panel-visible',
    panelExpanded ? 'reader-audio-panel-expanded' : 'reader-audio-panel-collapsed',
    panelTransitioning ? 'reader-audio-panel-transitioning' : '',
    view === VIEWS.READER ? 'reader-audio-over-reader' : 'reader-audio-over-screen',
  ].filter(Boolean).join(' ');

  return (
    <>
      {nativeAudioElement}

      <div
        className={panelWrapClassName}
        data-reader-ui
      >
        <section
          className={`reader-audio-panel reader-audio-panel-modern reader-audio-expanded-panel ${panelExpanded ? 'is-active' : 'is-inactive'}`}
          aria-hidden={!panelExpanded}
          inert={!panelExpanded ? true : undefined}
        >
          <div className="reader-audio-expanded-content">
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
          </div>
        </section>

        <section
          className={`reader-audio-panel reader-audio-panel-modern reader-audio-mini-panel ${panelExpanded ? 'is-inactive' : 'is-active'}`}
          aria-hidden={panelExpanded}
          inert={panelExpanded ? true : undefined}
          onClick={returnToCurrentRecitation}
          title="Return to the currently recited ayah"
        >
          <div className="reader-audio-mini-content">
            {renderGrabber('expand')}
            {renderTransportControls(true)}
          </div>
        </section>
      </div>

    </>
  );
}

function normalizeTarget(ayah) {
  if (!ayah?.surahNumber || !ayah?.ayahNumber) return null;

  return {
    // Always derive the canonical Mushaf page from the verse reference. A
    // caller-provided page may describe the previously visible page and can
    // otherwise send Follow Recitation to the start of the Surah.
    page: findPageForReference(ayah.surahNumber, ayah.ayahNumber),
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

function getFirstTargetOfSurah(surahNumber) {
  const firstAyah = quranAyahs.find(
    (item) => item.surahNumber === Number(surahNumber),
  );
  if (!firstAyah) return null;

  return normalizeTarget({
    ...firstAyah,
    reference: `${firstAyah.surahNumber}:${firstAyah.ayahNumber}`,
  });
}

function sameTarget(first, second) {
  return Boolean(
    first &&
      second &&
      Number(first.surahNumber) === Number(second.surahNumber) &&
      Number(first.ayahNumber) === Number(second.ayahNumber)
  );
}

function targetFromTiming(timing) {
  const ayah = quranAyahs.find(
    (item) =>
      item.surahNumber === timing.surahNumber
      && item.ayahNumber === timing.ayahNumber,
  );

  return normalizeTarget({
    ...ayah,
    surahNumber: timing.surahNumber,
    ayahNumber: timing.ayahNumber,
    reference: timing.verseKey,
  });
}

function clampSeekTime(audio, value) {
  const requested = Math.max(0, Number(value) || 0);
  if (!Number.isFinite(audio?.duration) || audio.duration <= 0) return requested;
  return Math.min(requested, Math.max(0, audio.duration - 0.001));
}

function createUnavailableError() {
  const error = new Error('Audio is unavailable.');
  error.code = 'AUDIO_UNAVAILABLE';
  return error;
}

function createAbortError() {
  const error = new Error('Audio load was superseded.');
  error.name = 'AbortError';
  return error;
}
