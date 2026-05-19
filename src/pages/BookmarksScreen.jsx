import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, BookOpen, Copy, MoreVertical, Play, Share2, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { findPageForReference, getSurah, getSurahAyahs } from '../lib/quran';
import { getUrduTranslation } from '../lib/translations';
import { useAppStore } from '../store/useAppStore';
import { Empty, Screen } from '../components/common/AppChrome';

export default function BookmarksScreen() {
  const { setView, goAyah, setAudioTarget, setTafsirTarget } = useAppStore();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [status, setStatus] = useState('');

  async function loadItems() {
    const [bookmarks, highlights, progress] = await Promise.all([
      db.bookmarks.orderBy('createdAt').reverse().toArray(),
      db.highlights.orderBy('createdAt').reverse().toArray(),
      db.memorizationProgress.orderBy('updatedAt').reverse().toArray(),
    ]);
    const normalized = [
      ...bookmarks.map((item) => ({ ...item, source: 'bookmark', type: item.category || 'Bookmark', sortAt: item.createdAt || 0 })),
      ...highlights.map((item) => ({ ...item, source: 'highlight', type: 'Highlight', sortAt: item.createdAt || 0 })),
      ...progress.map((item) => ({ ...item, source: 'memorize', type: 'Memorize', sortAt: item.updatedAt || 0 })),
    ].sort((a, b) => b.sortAt - a.sortAt);
    setItems(normalized);
  }

  useEffect(() => {
    let mounted = true;
    loadItems().then(() => { if (!mounted) return; });
    return () => { mounted = false; };
  }, []);

  const filters = ['All', 'Bookmarks', 'Highlights', 'Recitation', 'Memorize', 'Tadabbur'];
  const visibleItems = items.filter((item) => {
    if (filter === 'All') return true;
    if (filter === 'Bookmarks') return item.source === 'bookmark';
    if (filter === 'Highlights') return item.source === 'highlight';
    return item.type === filter;
  });

  function jumpToItem(item) {
    const itemPage = item.page || findPageForReference(item.surahNumber, item.ayahNumber);
    goAyah(item.surahNumber, item.ayahNumber, itemPage);
  }

  function playItem(item) {
    const itemPage = item.page || findPageForReference(item.surahNumber, item.ayahNumber);
    setAudioTarget({ surahNumber: item.surahNumber, ayahNumber: item.ayahNumber, page: itemPage });
    setView('audio');
  }

  async function copyItem(item) {
    const ayah = getSurahAyahs(item.surahNumber).find((candidate) => candidate.ayahNumber === item.ayahNumber);
    const translation = await getUrduTranslation(item.surahNumber, item.ayahNumber).catch(() => '');
    const text = `${ayah?.text || item.preview || ''}\n${translation ? `${translation}\n` : ''}${item.surahNumber}:${item.ayahNumber}`;
    await navigator.clipboard?.writeText(text);
    setStatus('Copied');
    setOpenMenu(null);
  }

  async function shareItem(item) {
    const ayah = getSurahAyahs(item.surahNumber).find((candidate) => candidate.ayahNumber === item.ayahNumber);
    const text = `${ayah?.text || item.preview || ''}\n${item.surahNumber}:${item.ayahNumber}`;
    if (navigator.share) await navigator.share({ title: `Qur’an ${item.surahNumber}:${item.ayahNumber}`, text });
    else await navigator.clipboard?.writeText(text);
    setStatus(navigator.share ? 'Share sheet opened' : 'Copied');
    setOpenMenu(null);
  }

  async function deleteItem(item) {
    if (item.source === 'bookmark') await db.bookmarks.delete(item.id);
    if (item.source === 'highlight') await db.highlights.delete(item.id);
    if (item.source === 'memorize') await db.memorizationProgress.delete(item.id);
    await loadItems();
    setStatus('Removed');
    setOpenMenu(null);
  }

  function openTafsir(item) {
    const ayah = getSurahAyahs(item.surahNumber).find((candidate) => candidate.ayahNumber === item.ayahNumber);
    setTafsirTarget({
      page: item.page || findPageForReference(item.surahNumber, item.ayahNumber),
      surahNumber: item.surahNumber,
      ayahNumber: item.ayahNumber,
      reference: `${item.surahNumber}:${item.ayahNumber}`,
      arabic: ayah?.text || item.preview || '',
    });
    setOpenMenu(null);
  }

  return (
    <Screen className="tabs-screen space-y-4">
      <div className="tabs-header">
        <button className="tabs-back-pill" onClick={() => setView('home')}><ArrowLeft size={24} /></button>
        <h1>Tabs</h1>
      </div>

      <div className="tabs-filter-row">
        {filters.map((option) => (
          <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option}</button>
        ))}
      </div>

      {status && <p className="tabs-status">{status}</p>}

      {visibleItems.length === 0 ? (
        <Empty text="No saved items in this filter. Long-press an ayah to save bookmarks, highlights, recitation, memorize, or tadabbur tabs." />
      ) : (
        <div className="tabs-list">
          {visibleItems.map((item, index) => {
            const surah = getSurah(item.surahNumber);
            const ayah = getSurahAyahs(item.surahNumber).find((candidate) => candidate.ayahNumber === item.ayahNumber);
            const preview = item.preview || ayah?.text || `${item.surahNumber}:${item.ayahNumber}`;
            const type = item.type || 'Bookmark';
            const tone = type === 'Memorize' ? 'amber' : type === 'Tadabbur' ? 'rose' : item.source === 'highlight' ? (item.color || 'sky') : 'emerald';
            const menuKey = `${item.source}-${item.id || index}`;
            return (
              <article key={menuKey} className="tab-card">
                <button className="tab-card-hit" onClick={() => jumpToItem(item)} aria-label={`Open ${surah?.name || 'ayah'} ${item.ayahNumber}`}>
                  <div className="tab-card-top">
                    <span className={`tab-bookmark tab-bookmark-${tone}`}><Bookmark size={25} fill="currentColor" strokeWidth={0} /></span>
                    <span className="tab-type">{type}</span>
                    <span className="tab-surah"><span className="ayah-medallion">{item.ayahNumber}</span>{surah?.name}</span>
                  </div>
                  <p dir="rtl" className="tab-arabic">{preview.length > 95 ? `...${preview.slice(0, 95)}` : preview}</p>
                </button>
                <button className="tab-more-button" onClick={() => setOpenMenu(openMenu === menuKey ? null : menuKey)} aria-label="More actions">
                  <MoreVertical size={24} />
                </button>
                {openMenu === menuKey && (
                  <div className="tab-menu">
                    <button onClick={() => jumpToItem(item)}><BookOpen size={17} /> Go to ayah</button>
                    <button onClick={() => playItem(item)}><Play size={17} /> Play audio</button>
                    <button onClick={() => openTafsir(item)}><BookOpen size={17} /> Translation</button>
                    <button onClick={() => copyItem(item)}><Copy size={17} /> Copy</button>
                    <button onClick={() => shareItem(item)}><Share2 size={17} /> Share</button>
                    <button className="danger" onClick={() => deleteItem(item)}><Trash2 size={17} /> Remove</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
