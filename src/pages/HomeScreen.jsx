import React from 'react';
import { Bookmark, BookOpen, Library, Search, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { getMushafPageNumber, getPageMeta } from '../lib/quran';
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
  } = useAppStore(useShallow((state) => ({
    page: state.page,
    goPage: state.goPage,
    openIndex: state.openIndex,
    openSearch: state.openSearch,
    openBookmarks: state.openBookmarks,
    openSettings: state.openSettings,
  })));
  const meta = getPageMeta(page);
  const actions = [
    ['Index', Library, openIndex],
    ['Search', Search, openSearch],
    ['Bookmarks', Bookmark, openBookmarks],
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
    </Screen>
  );
}
