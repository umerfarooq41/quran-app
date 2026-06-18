import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, Repeat, Rewind, FastForward, X } from 'lucide-react';
import { findPageForReference, getSurah } from '../../../lib/quran';
import { getAudioUrl, getDefaultReciterId, normalizeLocalReciters } from '../../../lib/localAudio';

const SPEEDS = [1, 1.5, 2];

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

export function ReaderAudioPanel({ ayah, settings, updateSettings, isPlaying, setIsPlaying, onClose, onActiveAyahChange }) {
  const audioRef = useRef(null);
  const reciters = useMemo(() => normalizeLocalReciters(), []);
  const selectedReciter = settings.reciter || getDefaultReciterId();
  const reciterName = reciters.find((item) => item.id === selectedReciter)?.reciter_name || 'Sheikh Maher Al-Muaiqly';
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [loop, setLoop] = useState(false);

  const surah = ayah?.surahNumber ? getSurah(ayah.surahNumber) : null;
  const reference = ayah?.surahNumber && ayah?.ayahNumber
    ? `${surah?.name || 'Surah'} : ${ayah.ayahNumber}`
    : 'Audio player';

  useEffect(() => {
    let mounted = true;

    if (!ayah?.surahNumber || !ayah?.ayahNumber) return undefined;

    getAudioUrl(selectedReciter, ayah.surahNumber, ayah.ayahNumber)
      .then((url) => {
        if (mounted) setAudioUrl(url || '');
      })
      .catch(() => {
        if (mounted) setAudioUrl('');
      });

    onActiveAyahChange?.(ayah);

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

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, audioUrl]);

  function seek(value) {
    const audio = audioRef.current;
    const nextTime = Number(value) || 0;
    setCurrentTime(nextTime);
    if (audio) audio.currentTime = nextTime;
  }

  function cycleSpeed() {
    const current = settings.playbackRate || 1;
    const next = SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length] || 1;
    updateSettings({ playbackRate: next });
  }

  return (
    <div className="reader-audio-panel-wrap" data-reader-ui>
      <section className="reader-audio-panel">
        <audio
          ref={audioRef}
          src={audioUrl}
          loop={loop}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="reader-audio-head">
          <strong>{reference}</strong>
          <button onClick={onClose} aria-label="Close audio player"><X size={18} /></button>
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
          type="range"
          min="0"
          max={duration || 0}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(event.target.value)}
          aria-label="Audio progress"
        />

        <div className="reader-audio-times">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
        </div>

        <div className="reader-transport-row">
          <button className={loop ? 'transport-active' : ''} onClick={() => setLoop((value) => !value)} aria-label="Repeat"><Repeat size={22} /></button>
          <button onClick={() => seek(Math.max(0, currentTime - 10))} aria-label="Previous"><Rewind size={24} /></button>
          <button className="transport-main" onClick={() => setIsPlaying(!isPlaying)} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <button onClick={() => seek(Math.min(duration || 0, currentTime + 10))} aria-label="Next"><FastForward size={24} /></button>
          <button className="transport-speed" onClick={cycleSpeed} aria-label="Playback speed">{settings.playbackRate || 1}x</button>
        </div>

        {!audioUrl && <p className="reader-audio-status">Audio file is not available for this ayah/reciter.</p>}
      </section>
    </div>
  );
}
