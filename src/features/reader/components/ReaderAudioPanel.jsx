import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, Repeat, SkipBack, SkipForward, X } from 'lucide-react';
import { findPageForReference, getSurah, quranAyahs } from '../../../lib/quran';
import { getAudioUrl, getDefaultReciterId, normalizeLocalReciters } from '../../../lib/localAudio';

const SPEEDS = [1, 1.25, 1.5, 2];

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

export function ReaderAudioPanel({
  ayah,
  visible,
  settings,
  updateSettings,
  onClose,
  onAyahChange,
  onPlaybackStopped,
}) {
  const audioRef = useRef(null);
  const playIntentRef = useRef(true);
  const reciters = useMemo(() => normalizeLocalReciters(), []);
  const selectedReciter = settings.reciter || getDefaultReciterId();
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState('');

  const surah = ayah?.surahNumber ? getSurah(ayah.surahNumber) : null;
  const reference = ayah?.surahNumber && ayah?.ayahNumber
    ? `${surah?.name || 'Surah'} : ${ayah.ayahNumber}`
    : 'Audio player';

  useEffect(() => {
    if (!settings.reciter && selectedReciter) {
      updateSettings({ reciter: selectedReciter });
    }
  }, [settings.reciter, selectedReciter, updateSettings]);

  useEffect(() => {
    let mounted = true;

    if (!ayah?.surahNumber || !ayah?.ayahNumber) return undefined;

    setAudioUrl('');
    setCurrentTime(0);
    setDuration(0);
    setStatus('Loading audio…');

    getAudioUrl(selectedReciter, ayah.surahNumber, ayah.ayahNumber)
      .then((url) => {
        if (!mounted) return;
        setAudioUrl(url || '');
        setStatus(url ? '' : 'Audio is not available for this ayah and reciter.');
        if (!url) {
          playIntentRef.current = false;
          setPlaying(false);
          onPlaybackStopped?.();
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setAudioUrl('');
        setStatus(error?.message || 'Audio could not be loaded.');
        playIntentRef.current = false;
        setPlaying(false);
        onPlaybackStopped?.();
      });

    return () => {
      mounted = false;
    };
  }, [ayah?.surahNumber, ayah?.ayahNumber, selectedReciter]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = settings.playbackRate || 1;
  }, [settings.playbackRate, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.src = audioUrl;
    audio.currentTime = 0;
    audio.playbackRate = settings.playbackRate || 1;

    if (playIntentRef.current) {
      audio.play()
        .then(() => {
          setPlaying(true);
          setStatus('');
        })
        .catch((error) => {
          playIntentRef.current = false;
          setPlaying(false);
          setStatus(error?.message || 'Audio playback could not start.');
          onPlaybackStopped?.();
        });
    }
  }, [audioUrl]);

  function seek(value) {
    const audio = audioRef.current;
    const nextTime = Number(value) || 0;
    setCurrentTime(nextTime);
    if (audio) audio.currentTime = nextTime;
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (playing) {
      playIntentRef.current = false;
      audio.pause();
      setPlaying(false);
      return;
    }

    playIntentRef.current = true;
    audio.play()
      .then(() => {
        setPlaying(true);
        setStatus('');
      })
      .catch((error) => {
        playIntentRef.current = false;
        setStatus(error?.message || 'Audio playback could not start.');
      });
  }

  function moveAyah(direction) {
    if (!ayah) return;

    const currentIndex = quranAyahs.findIndex(
      (item) =>
        item.surahNumber === Number(ayah.surahNumber) &&
        item.ayahNumber === Number(ayah.ayahNumber),
    );
    const next = quranAyahs[currentIndex + direction];
    if (!next) return;

    playIntentRef.current = true;
    setPlaying(true);
    onAyahChange?.({
      page: findPageForReference(next.surahNumber, next.ayahNumber),
      surahNumber: next.surahNumber,
      ayahNumber: next.ayahNumber,
      reference: `${next.surahNumber}:${next.ayahNumber}`,
      arabic: next.text,
    });
  }

  function handleEnded() {
    const audio = audioRef.current;

    if (repeat && audio) {
      audio.currentTime = 0;
      playIntentRef.current = true;
      audio.play().catch(() => {
        playIntentRef.current = false;
        setPlaying(false);
        onPlaybackStopped?.();
      });
      return;
    }

    const currentIndex = quranAyahs.findIndex(
      (item) =>
        item.surahNumber === Number(ayah?.surahNumber) &&
        item.ayahNumber === Number(ayah?.ayahNumber),
    );

    if (currentIndex >= 0 && currentIndex < quranAyahs.length - 1) {
      moveAyah(1);
      return;
    }

    playIntentRef.current = false;
    setPlaying(false);
    onPlaybackStopped?.();
  }

  function cycleSpeed() {
    const current = settings.playbackRate || 1;
    const index = SPEEDS.indexOf(current);
    const next = SPEEDS[(index + 1) % SPEEDS.length] || 1;
    updateSettings({ playbackRate: next });
  }

  function closePlayer() {
    const audio = audioRef.current;
    playIntentRef.current = false;
    audio?.pause();
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    setPlaying(false);
    onClose?.();
  }

  return (
    <div
      className={`reader-audio-panel-wrap ${visible ? 'reader-audio-panel-visible' : 'reader-audio-panel-hidden'}`}
      data-reader-ui
      aria-hidden={!visible}
    >
      <section className="reader-audio-panel">
        <audio
          ref={audioRef}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
          onEnded={handleEnded}
        />

        <div className="reader-audio-head">
          <strong>{reference}</strong>
          <button onClick={closePlayer} aria-label="Close audio player"><X size={18} /></button>
        </div>

        <label className="reader-reciter-row">
          <span className="reader-reciter-avatar" aria-hidden="true"> </span>
          <select value={selectedReciter} onChange={(event) => updateSettings({ reciter: event.target.value })}>
            {reciters.map((reciter) => (
              <option key={reciter.id} value={reciter.id}>{reciter.reciter_name || reciter.name}</option>
            ))}
          </select>
          <ChevronDown size={18} />
        </label>

        <input
          className="reader-audio-progress"
          dir="rtl"
          type="range"
          min="0"
          max={duration || 0}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(event.target.value)}
          aria-label="Audio progress"
        />

        <div className="reader-audio-times" dir="ltr">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
        </div>

        <div className="reader-transport-row">
          <button className={repeat ? 'transport-active' : ''} onClick={() => setRepeat((value) => !value)} aria-label="Repeat ayah">
            <Repeat size={22} />
          </button>
          <button onClick={() => moveAyah(-1)} aria-label="Previous ayah"><SkipBack size={23} /></button>
          <button className="transport-main" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <button onClick={() => moveAyah(1)} aria-label="Next ayah"><SkipForward size={23} /></button>
          <button className="transport-speed" onClick={cycleSpeed} aria-label="Playback speed">
            {settings.playbackRate || 1}x
          </button>
        </div>

        {status && <p className="reader-audio-status">{status}</p>}
      </section>
    </div>
  );
}
