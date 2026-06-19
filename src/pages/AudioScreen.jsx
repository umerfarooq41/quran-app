import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { findPageForReference, getPage, getSurah, quranAyahs } from '../lib/quran';
import { normalizeLocalReciters, getAudioUrl, getDefaultReciterId, getNextAyahRef } from '../lib/localAudio';
import { getTranslation, getTranslationOption } from '../lib/translations';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';
import { iconButton, panel } from '../components/common/ui';

export default function AudioScreen() {
  const { page, settings, updateSettings, audioTarget, setAudioTarget, goPage } = useAppStore();
  const [reciters, setReciters] = useState(() => normalizeLocalReciters());
  const [status, setStatus] = useState('Ready: bundled audio index is available.');
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(new Audio());
  const first = getPage(page).lines.find((line) => line.surahNumber && line.ayahStart);
  const currentRef = audioTarget || (first ? { surahNumber: first.surahNumber, ayahNumber: first.ayahStart, page } : null);
  const currentSurah = currentRef ? getSurah(currentRef.surahNumber) : null;
  const [currentTranslation, setCurrentTranslation] = useState('');
  const selectedReciter = settings.reciter || getDefaultReciterId();
  const translationOption = getTranslationOption(settings.translation);
  const hasReciters = reciters.length > 0;

  useEffect(() => {
    let mounted = true;
    if (!currentRef) {
      setCurrentTranslation('');
      return () => { mounted = false; };
    }
    getTranslation(settings.translation, currentRef.surahNumber, currentRef.ayahNumber)
      .then((text) => { if (mounted) setCurrentTranslation(text); })
      .catch(() => { if (mounted) setCurrentTranslation(''); });
    return () => { mounted = false; };
  }, [currentRef?.surahNumber, currentRef?.ayahNumber, settings.translation]);

  useEffect(() => {
    const local = normalizeLocalReciters();
    setReciters(local);
    if (!settings.reciter && local[0]?.id) updateSettings({ reciter: local[0].id });
    setStatus(local.length ? 'Ready: audio URLs are bundled locally.' : 'No bundled reciter audio found.');
  }, []);

  useEffect(() => { audioRef.current.playbackRate = settings.playbackRate; }, [settings.playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => {
      setPlaying(false);
      if (!settings.autoplay || !currentRef) return;
      const next = getNextAyahRef(currentRef.surahNumber, currentRef.ayahNumber, quranAyahs);
      if (!next) return;
      const nextPage = findPageForReference(next.surahNumber, next.ayahNumber);
      setAudioTarget({ ...next, page: nextPage });
      goPage(nextPage);
      window.setTimeout(() => playRef({ ...next, page: nextPage }), 120);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [settings.autoplay, currentRef?.surahNumber, currentRef?.ayahNumber, settings.reciter, settings.playbackRate]);

  async function playRef(ref = currentRef) {
    if (!ref) return;
    const reciterId = settings.reciter || getDefaultReciterId();
    const url = await getAudioUrl(reciterId, ref.surahNumber, ref.ayahNumber);
    if (!url) {
      setPlaying(false);
      setStatus(`Audio URL missing for ${ref.surahNumber}:${ref.ayahNumber} with this reciter.`);
      return;
    }

    try {
      audioRef.current.src = url;
      audioRef.current.playbackRate = settings.playbackRate;
      await audioRef.current.play();
      setPlaying(true);
      setStatus(`Playing ${ref.surahNumber}:${ref.ayahNumber}`);
    } catch (error) {
      setPlaying(false);
      setStatus(error?.message || 'Audio playback failed.');
    }
  }

  function togglePlay() {
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      setStatus('Paused');
      return;
    }
    playRef();
  }

  function jumpAyah(direction) {
    if (!currentRef) return;
    const currentIndex = quranAyahs.findIndex(
      (ayah) => ayah.surahNumber === Number(currentRef.surahNumber) && ayah.ayahNumber === Number(currentRef.ayahNumber),
    );
    const next = quranAyahs[currentIndex + direction];
    if (!next) return;
    const nextPage = findPageForReference(next.surahNumber, next.ayahNumber);
    const ref = { surahNumber: next.surahNumber, ayahNumber: next.ayahNumber, page: nextPage };
    setAudioTarget(ref);
    goPage(nextPage);
    setStatus(`Selected ${ref.surahNumber}:${ref.ayahNumber}`);
  }

  return (
    <Screen className="audio-screen">
      <Header title="Audio" />
      <div className={`${panel} audio-card`}>
        <p className="audio-kicker">Selected ayah</p>
        <h2 className="audio-reference">
          {currentRef ? `${currentRef.surahNumber}:${currentRef.ayahNumber}` : 'No ayah'}
        </h2>
        {currentSurah && <p className="audio-meta">{currentSurah.name} · Page {currentRef?.page || page}</p>}
        {currentTranslation && <p dir={translationOption.direction} className="audio-translation">{currentTranslation}</p>}

        <div className="audio-controls">
          <button disabled={!hasReciters || !currentRef} className="audio-play-button" onClick={togglePlay}>{playing ? <Pause /> : <Play />}</button>
          <button className={`${iconButton} audio-step-button`} onClick={() => jumpAyah(-1)} aria-label="Previous ayah"><ChevronLeft /></button>
          <button className={`${iconButton} audio-step-button`} onClick={() => jumpAyah(1)} aria-label="Next ayah"><ChevronRight /></button>
        </div>

        <label className="audio-field-label">Reciter</label>
        <select disabled={!hasReciters} className="audio-select" value={selectedReciter || ''} onChange={(e) => updateSettings({ reciter: e.target.value })}>
          {reciters.map((reciter) => <option key={reciter.id} value={reciter.id}>{reciter.reciter_name || reciter.name || reciter.id}</option>)}
        </select>

        <label className="audio-field-label">Speed {settings.playbackRate}x</label>
        <input type="range" min="0.75" max="2" step="0.25" value={settings.playbackRate} onChange={(e) => updateSettings({ playbackRate: Number(e.target.value) })} className="audio-speed-range" />
        <label className="audio-autoplay"><input type="checkbox" checked={settings.autoplay} onChange={(e) => updateSettings({ autoplay: e.target.checked })} /> Autoplay next ayah</label>
        <p className="audio-status">{status}</p>
      </div>
    </Screen>
  );
}
