import { SwipeActions } from '../components/common/SwipeActions';
import React, { useEffect, useState } from 'react';
import { BookOpen, Library, List, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getMushafPageNumber, getPage, getPageMeta, getSurah } from '../lib/quran';
import { formatIndoPakQuarterLabel, getCurrentIndoPakJuzProgress } from '../data/indoPakParaQuarters';
import { liveQuery } from 'dexie';
import { getTadabburLessons } from '../lib/db';
import { Screen } from '../components/common/AppChrome';
import { getSurahNameMeta } from '../data/surahNames';

export default function HomeScreen() {
  const {
    page,
    goPage,
    openIndex,
    openSearch,
    openBookmarks,
    openSettings,
    openReflect,
    favoriteSurahs,
    toggleFavoriteSurah,
    setIndexTab,
    goAyah,
    lastReadTarget,
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    goPage: state.goPage,
    openIndex: state.openIndex,
    openSearch: state.openSearch,
    openBookmarks: state.openBookmarks,
    openSettings: state.openSettings,
    openReflect: state.openReflect,
    favoriteSurahs: state.favoriteSurahs,
    toggleFavoriteSurah: state.toggleFavoriteSurah,
    setIndexTab: state.setIndexTab,
    goAyah: state.goAyah,
    lastReadTarget: state.lastReadTarget,
  })));
  const [lessons, setLessons] = useState(null);
  useEffect(() => {
    const subscription = liveQuery(getTadabburLessons).subscribe({
      next: setLessons,
      error: () => setLessons(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  const unfinished = lessons?.find((lesson) => lesson.status !== 'completed');
  const reflectTitle = unfinished ? 'Continue lesson' : lessons?.length ? 'Explore & revisit' : 'Begin reflecting';
  const reflectDescription = unfinished
    ? `${getSurah(unfinished.surahNumber)?.name || ''} ${unfinished.surahNumber}:${unfinished.startAyah}–${unfinished.endAyah}`
    : lessons?.length ? 'Return to your reflections or begin a new lesson.' : 'Choose a passage and begin your first lesson.';
  const meta = getPageMeta(page);
  const continueSurah = getSurah(lastReadTarget?.surahNumber) || meta.surah;
  const pageData = getPage(page);
  const firstPageAyah = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
  const quarterLabel = formatIndoPakQuarterLabel(getCurrentIndoPakJuzProgress(
    page,
    firstPageAyah?.surahNumber,
    firstPageAyah?.ayahStart,
    meta.juz,
  ));
  const favoriteItems = favoriteSurahs.map(getSurah).filter(Boolean);

  function openSurahIndex() {
    setIndexTab('surahs');
    openIndex();
  }

  const actions = [
    ['Index', List, openIndex],
    ['Search', Search, openSearch],
    ['Library', Library, openBookmarks],
    ['Settings', SlidersHorizontal, openSettings],
  ];

  return (
    <Screen className="space-y-5 pb-8">
      <motion.div
        className="home-branding-block pt-6 text-center"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
      >
        <p className="home-subtitle">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
        <h1 className="home-title">Al Quran</h1>
      </motion.div>

      <motion.button
        onClick={() => goPage(lastReadTarget?.page || page)}
        className="home-hero-card"
        whileTap={{ scale: 0.985 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 28 }}
      >
        <div className="home-hero-content">
          <span className="home-hero-label">Continue Reading</span>
          <h2 className="home-hero-surah">{continueSurah.name}</h2>
          <p className="home-hero-meta">Page {getMushafPageNumber(page)} · Juz {meta.juz} · {quarterLabel}</p>
        </div>
        <div className="home-hero-ornament"><BookOpen size={30} /></div>
      </motion.button>

      <motion.div className="home-actions-row home-actions-row-spaced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
        {actions.map(([label, Icon, onClick], index) => (
          <motion.button
            key={label}
            className="home-action-chip"
            onClick={onClick}
            whileTap={{ scale: 0.94 }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + index * 0.045, type: 'spring' }}
          >
            <Icon size={20} className="home-action-icon" />
            <span>{label}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.section
        className="home-favorites-section home-reflect-section"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        <div className="home-section-heading">
          <h2>Reflect</h2>
        </div>
        <motion.button
          type="button"
          onClick={() => openReflect()}
          className="home-reflect-card"
          whileTap={{ scale: 0.985 }}
        >
          <span className="home-favorite-copy home-reflect-copy">
            <strong>{reflectTitle}</strong>
            <small>{reflectDescription}</small>
          </span>
        </motion.button>
      </motion.section>

      <motion.section
        className="home-favorites-section"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="home-section-heading">
          <h2>Favorite Surahs</h2>
        </div>

        {favoriteItems.length ? (
          <div className="home-favorites-list">
            {favoriteItems.map((surah) => (
              <FavoriteSurahRow
                key={surah.number}
                surah={surah}
                onOpen={() => goAyah(surah.number, 1, findPageForReference(surah.number, 1))}
                onRemove={() => toggleFavoriteSurah(surah.number)}
              />
            ))}
          </div>
        ) : (
          <button type="button" className="home-favorites-empty" onClick={openSurahIndex}>
            <span>
              <strong>No favorite Surahs yet</strong>
              <small>Add Surahs from the Index for quick access.</small>
            </span>
            <span className="home-empty-link">Browse Surahs</span>
          </button>
        )}
      </motion.section>
    </Screen>
  );
}


function FavoriteSurahRow({ surah, onOpen, onRemove }) {
  const [isOpen, setIsOpen] = useState(false);

  function handleOpen() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    onOpen();
  }

  return (
    <SwipeActions as={motion.article}
      className="home-favorite-swipe" open={isOpen} onOpenChange={setIsOpen}
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
    >
      <button
        type="button"
        className="home-favorite-delete"
        onClick={onRemove}
        aria-label={`Remove ${surah.name} from favorites`}
      >
        <Trash2 size={19} />
        <span>Remove</span>
      </button>

      <button
        type="button"
        className="home-favorite-row"
        onClick={handleOpen}
      >
        <span className="home-favorite-number">{surah.number}</span>
        <span className="home-favorite-copy">
          <strong>{surah.name}</strong>
          <small>
            {getSurahNameMeta(surah.number)?.meaning
              ? `${getSurahNameMeta(surah.number).meaning} · `
              : ''}
            {surah.verses} Ayahs · {surah.revelation}
          </small>
        </span>
      </button>
    </SwipeActions>
  );
}
