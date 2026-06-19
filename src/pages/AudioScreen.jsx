import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { findPageForReference, getPage, getSurah, quranAyahs } from '../lib/quran';
import { qfClient } from '../lib/qfClient';
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

    // Optional API fallback: if Quran Foundation credentials are later added, this can enrich the list.
    qfClient.reciters()
      .then((data) => {
        const apiList = data.recitations || data.data || [];
        if (apiList.length) setStatus('Ready: bundled audio active; Quran Foundation API also reachable.');
      })
      .catch(() => {
        // Silent: bundled audio is the primary source now.
      });
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
    <Screen className="space-y-4">
      <Header title="Audio" />
      <div className={`${panel} p-5`}>
        <p className="text-sm text-slate-500">Selected ayah</p>
        <h2 className="text-2xl font-semibold">
          {currentRef ? `${currentRef.surahNumber}:${currentRef.ayahNumber}` : 'No ayah'}
        </h2>
        {currentSurah && <p className="mt-1 text-sm text-slate-500">{currentSurah.name} · Page {currentRef?.page || page}</p>}
        {currentTranslation && <p dir={translationOption.direction} className="mt-4 rounded-2xl bg-white/60 p-3 text-sm leading-7 text-slate-700">{currentTranslation}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button disabled={!hasReciters || !currentRef} className="grid h-16 w-16 place-items-center rounded-3xl bg-sky-600 text-white disabled:cursor-not-allowed disabled:bg-slate-300" onClick={togglePlay}>{playing ? <Pause /> : <Play />}</button>
          <button className={iconButton} onClick={() => jumpAyah(-1)} aria-label="Previous ayah"><ChevronLeft /></button>
          <button className={iconButton} onClick={() => jumpAyah(1)} aria-label="Next ayah"><ChevronRight /></button>
        </div>

        <label className="mt-5 block text-sm font-semibold">Reciter</label>
        <select disabled={!hasReciters} className="mt-2 w-full rounded-2xl bg-white/75 p-3 disabled:text-slate-400" value={selectedReciter || ''} onChange={(e) => updateSettings({ reciter: e.target.value })}>
          {reciters.map((reciter) => <option key={reciter.id} value={reciter.id}>{reciter.reciter_name || reciter.name || reciter.id}</option>)}
        </select>

        <label className="mt-5 block text-sm font-semibold">Speed {settings.playbackRate}x</label>
        <input type="range" min="0.75" max="2" step="0.25" value={settings.playbackRate} onChange={(e) => updateSettings({ playbackRate: Number(e.target.value) })} className="w-full" />
        <label className="mt-4 flex items-center gap-3"><input type="checkbox" checked={settings.autoplay} onChange={(e) => updateSettings({ autoplay: e.target.checked })} /> Autoplay next ayah</label>
        <p className="mt-4 rounded-2xl bg-white/60 p-3 text-sm text-slate-600">{status}</p>
      </div>
    </Screen>
  );
}
