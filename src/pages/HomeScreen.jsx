import React, { useRef, useState } from 'react';
import { Bookmark, BookOpen, Library, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getMushafPageNumber, getPage, getPageMeta, getSurah } from '../lib/quran';
import { formatIndoPakQuarterLabel, getCurrentIndoPakJuzProgress } from '../data/indoPakParaQuarters';
import { Screen } from '../components/common/AppChrome';

export default function HomeScreen() {
  const {
    page,
    goPage,
    openIndex,
    openSearch,
    openBookmarks,
    openSettings,
    favoriteSurahs,
    toggleFavoriteSurah,
    setIndexTab,
    goAyah,
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    goPage: state.goPage,
    openIndex: state.openIndex,
    openSearch: state.openSearch,
    openBookmarks: state.openBookmarks,
    openSettings: state.openSettings,
    favoriteSurahs: state.favoriteSurahs,
    toggleFavoriteSurah: state.toggleFavoriteSurah,
    setIndexTab: state.setIndexTab,
    goAyah: state.goAyah,
  })));
  const meta = getPageMeta(page);
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
    ['Index', Library, openIndex],
    ['Search', Search, openSearch],
    ['Library', Bookmark, openBookmarks],
    ['Settings', SlidersHorizontal, openSettings],
  ];

  return (
    <Screen className="space-y-5 pb-8">
      <motion.div className="pt-6 text-center" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        <p className="home-subtitle">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
        <h1 className="home-title">Qur'an Reader</h1>
        <p className="mt-2 text-sm font-medium text-[#6f6253]">Premium 16-line IndoPak mushaf</p>
      </motion.div>

      <motion.button
        onClick={() => goPage(page)}
        className="home-hero-card"
        whileTap={{ scale: 0.985 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 28 }}
      >
        <div className="home-hero-content">
          <span className="home-hero-label">Continue Reading</span>
          <h2 className="home-hero-surah">{meta.surah.name}</h2>
          <p className="home-hero-meta">Page {getMushafPageNumber(page)} · Juz {meta.juz} · {quarterLabel}</p>
        </div>
        <div className="home-hero-ornament"><BookOpen size={30} /></div>
      </motion.button>

      <motion.div className="home-actions-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
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
  const swipeStart = useRef(null);
  const suppressClick = useRef(false);

  function startSwipe(event) {
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function finishSwipe(event) {
    const start = swipeStart.current;
    const touch = event.changedTouches[0];
    swipeStart.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < -44) {
      suppressClick.current = true;
      setIsOpen(true);
    } else if (deltaX > 30) {
      suppressClick.current = true;
      setIsOpen(false);
    }
  }

  function handleOpen() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    onOpen();
  }

  return (
    <motion.article
      className={`home-favorite-swipe ${isOpen ? 'is-swiped' : ''}`}
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
        onTouchStart={startSwipe}
        onTouchEnd={finishSwipe}
        onClick={handleOpen}
        aria-label={`Read ${surah.name} from the start`}
      >
        <span className="home-favorite-number">{surah.number}</span>
        <span className="home-favorite-copy">
          <strong>{surah.name}</strong>
          <small>{surah.verses} Ayahs · {surah.revelation}</small>
        </span>
      </button>
    </motion.article>
  );
}
