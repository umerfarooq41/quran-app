import React, { useState } from 'react';
import {
  BookOpen, Bookmark, ChevronDown, CircleHelp, Headphones, Home,
  Image, Library, List, Search, Settings, Share2, SlidersHorizontal,
} from 'lucide-react';
import { Header, Screen } from '../components/common/AppChrome';

const SECTIONS = [
  {
    id: 'start', icon: Home, title: 'Getting Started', summary: 'Home, Continue Reading and quick access',
    content: <><p>The Home screen is your starting point. Use <strong>Continue Reading</strong> to return to your last-read location, or open Index, Search, Library and Settings from the quick-access buttons.</p><p>Surahs marked as favorites also appear on Home for faster access.</p></>,
  },
  {
    id: 'reader', icon: BookOpen, title: 'Reader', summary: 'Navigate pages and use Ayah actions',
    content: <><p>The Reader uses the 16-line IndoPak Mushaf. Tap the reading area to show or hide the Reader controls and use the page navigation to move through the Mushaf.</p><h3>Ayah actions</h3><p>Press and hold an Ayah or word to open its actions. From there you can highlight it, bookmark it, start recitation, share it, or copy it.</p><p>Tap an Ayah to open its translation.</p></>,
  },
  {
    id: 'translation', icon: List, title: 'Translation & Tafsir', summary: 'Translation, word meanings and Tafsir',
    content: <><p>Tap an Ayah to open the translation card. The language and translator come from Settings.</p><p>If <strong>Word-by-word translation</strong> is enabled, individual word meanings are also shown in the selected English or Urdu word-by-word language.</p><p>When Tafsir is available, use <strong>Show Tafsir</strong> to expand it and <strong>Hide Tafsir</strong> to collapse it.</p></>,
  },
  {
    id: 'audio', icon: Headphones, title: 'Recitation', summary: 'Play, seek, repeat and change reciter',
    content: <><p>Start recitation from an Ayah action or the Reader audio control. The persistent player lets you play or pause, move between Ayahs, seek, change playback speed, choose a reciter and set repeat behavior.</p><h3>Follow Recitation</h3><p>While recitation is playing, the Reader follows the active Ayah and moves to the correct Mushaf page automatically.</p></>,
  },
  {
    id: 'index', icon: List, title: 'Index & Surah Info', summary: 'Browse Surahs, Juz and jump to an Ayah',
    content: <><p>Use the <strong>Juz</strong> and <strong>Surahs</strong> tabs in Index to navigate the Qur'an. Expand a Juz for its quarter divisions, or expand a Surah for its information and navigation tools.</p><p><strong>Jump to Ayah</strong> lets you enter an Ayah number and go directly to its Mushaf location. Surah information includes its English meaning, Ayah count, Makki/Madani classification and introduction.</p></>,
  },
  {
    id: 'search', icon: Search, title: 'Search', summary: 'Find Qur’an content quickly',
    content: <><p>Open Search and enter a word or phrase. Tap a matching result to jump directly to that Ayah in the Reader. Recent searches are kept for quick access.</p></>,
  },
  {
    id: 'library', icon: Library, title: 'Library', summary: 'Bookmarks, highlights and notes',
    content: <><p>Your saved Ayahs are collected in Library. Bookmarks can be organized under <strong>Recitation</strong>, <strong>Memorize</strong> and <strong>Tadabbur</strong>.</p><p>Tap a bookmark or highlight to return to its Ayah. Bookmark menus also let you add or edit a note, or remove the bookmark.</p></>,
  },
  {
    id: 'favorites', icon: Bookmark, title: 'Favorite Surahs', summary: 'Keep frequently read Surahs on Home',
    content: <><p>Add a Surah to Favorites from its Index entry. Favorite Surahs appear on the Home screen so you can open them quickly. You can remove a favorite later from the same Surah controls.</p></>,
  },
  {
    id: 'share', icon: Share2, title: 'Share Quran', summary: 'Create Quran images and videos',
    content: <><p>Press and hold an Ayah and choose <strong>Share</strong> to open Share Quran.</p><h3>Image</h3><p>Select a Surah and an Ayah range, choose a background, adjust Arabic and translation text, then export the image. Image mode supports up to 5 Ayahs.</p><h3>Video</h3><p>Video mode supports up to 10 Ayahs. Choose the Ayahs, reciter and looping background, customize the text, preview the result, then generate the video with recitation audio.</p></>,
  },
  {
    id: 'settings', icon: Settings, title: 'Settings', summary: 'Appearance, translation and reciter',
    content: <><p>Use Settings to switch between Light and Dark appearance, choose your translation language and translator, enable word-by-word meanings, select the word-by-word language and choose your preferred audio reciter.</p><p><strong>Reset settings</strong> restores the app's default appearance, translation, reciter, word-by-word and playback settings.</p></>,
  },
  {
    id: 'gestures', icon: SlidersHorizontal, title: 'Quick Gesture Guide', summary: 'The essential Reader controls at a glance',
    content: <div className="help-gesture-list"><p><strong>Tap an Ayah</strong><span>Open translation</span></p><p><strong>Press and hold an Ayah</strong><span>Open Ayah actions</span></p><p><strong>Tap the reading area</strong><span>Show or hide Reader controls</span></p><p><strong>Play an Ayah</strong><span>Begin recitation from that Ayah</span></p><p><strong>Share an Ayah</strong><span>Create a Quran image or video</span></p></div>,
  },
];

export default function HelpScreen() {
  const [openSection, setOpenSection] = useState('start');
  return (
    <Screen className="help-screen app-page-shell bg-fluent">
      <div className="app-fixed-header"><Header title="Help & Guide" /></div>
      <div className="app-scroll-content">
        <section className="help-intro">
          <span className="help-intro-icon"><CircleHelp size={22} /></span>
          <div><h2>How to use Al Quran</h2><p>Choose a topic below to learn about the app's features and controls.</p></div>
        </section>
        <div className="help-sections">
          {SECTIONS.map(({ id, icon: Icon, title, summary, content }) => {
            const open = openSection === id;
            return <section className={`help-section${open ? ' is-open' : ''}`} key={id}>
              <button type="button" className="help-section-trigger" onClick={() => setOpenSection(open ? null : id)} aria-expanded={open}>
                <span className="help-section-icon"><Icon size={18} /></span>
                <span className="help-section-label"><strong>{title}</strong><small>{summary}</small></span>
                <ChevronDown className="help-section-chevron" size={18} />
              </button>
              {open && <div className="help-section-content">{content}</div>}
            </section>;
          })}
        </div>
      </div>
    </Screen>
  );
}
