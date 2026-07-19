import React from 'react';
import { Bookmark, BookOpen, Library, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { findPageForReference, getMushafPageNumber, getPageMeta, getSurah } from '../lib/quran';
import { getJuzPartByPage } from '../data/quranMeta';
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
  const favoriteItems = favoriteSurahs.slice(0, 4).map(getSurah);

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
          <p className="home-hero-meta">Page {getMushafPageNumber(page)} · Juz {meta.juz} · {getJuzPartByPage(page)}</p>
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
          <div>
            <span className="home-section-kicker">Quick access</span>
            <h2>Favorite Surahs</h2>
          </div>
          <button type="button" onClick={openSurahIndex}>
            {favoriteSurahs.length > 4 ? `View all (${favoriteSurahs.length})` : 'Manage'}
          </button>
        </div>

        {favoriteItems.length ? (
          <div className="home-favorites-grid">
            {favoriteItems.map((surah) => (
              <motion.article key={surah.number} className="home-favorite-card" whileTap={{ scale: 0.975 }}>
                <button
                  type="button"
                  className="home-favorite-open"
                  onClick={() => goAyah(surah.number, 1, findPageForReference(surah.number, 1))}
                  aria-label={`Read ${surah.name} from the start`}
                >
                  <span className="home-favorite-number">{surah.number}</span>
                  <span className="home-favorite-copy">
                    <strong>{surah.name}</strong>
                    <small>{surah.verses} Ayahs · {surah.revelation}</small>
                  </span>
                  <Star className="home-favorite-star" size={18} fill="currentColor" />
                </button>
                <button
                  type="button"
                  className="home-favorite-remove"
                  onClick={() => toggleFavoriteSurah(surah.number)}
                  aria-label={`Remove ${surah.name} from favorites`}
                >
                  <X size={15} />
                </button>
              </motion.article>
            ))}
          </div>
        ) : (
          <button type="button" className="home-favorites-empty" onClick={openSurahIndex}>
            <span className="home-empty-icon"><Star size={23} /></span>
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
