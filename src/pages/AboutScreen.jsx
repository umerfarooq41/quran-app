import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileText,
  HeartHandshake,
  Info,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Header, Screen } from '../components/common/AppChrome';

const APP_VERSION = '1.0.0';

const LINKS = {
  qulResources: 'https://qul.tarteel.ai/resources',
  qulCredits: 'https://qul.tarteel.ai/credits',
  quranFoundation: 'https://quran.foundation/',
  pixabayLicense: 'https://pixabay.com/service/license-summary/',
  privacy: '/privacy.html',
  terms: '/terms.html',
  licenses: '/licenses.html',
};

function ExternalLinkRow({ href, children }) {
  return (
    <a className="about-link-row" href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

const SECTIONS = [
  {
    id: 'sources',
    icon: HeartHandshake,
    title: 'Sources & Credits',
    summary: 'Quran data, translations, recitations, fonts and media',
    content: (
      <>
        <h3>Qur'an Text & Mushaf</h3>
        <p>Qur'anic script, metadata, Mushaf layout data and the IndoPak Nastaleeq Quran font are sourced through the <strong>Quranic Universal Library (QUL)</strong>, developed by Tarteel. The Reader uses the IndoPak 16-line Mushaf layout based on the Taj Company edition.</p>

        <h3>Translations & Tafsir</h3>
        <p>Bundled resources include translations and commentary by M. A. S. Abdel Haleem, Syed Abul A'la Maududi, Mufti Muhammad Shafi, Dr. Israr Ahmad and other named translators. Bundled datasets are sourced through QUL. Additional translations and tafsir may be provided dynamically through Quran Foundation and are identified by their named edition in the app.</p>

        <h3>Word-by-Word & Surah Information</h3>
        <p>Word-by-word translation data and English/Urdu Surah information are sourced through QUL.</p>

        <h3>Recitations</h3>
        <p>Qur'an recitations are presented under the names of their respective reciters. Recitation metadata and ayah/word timing data are sourced through QUL.</p>

        <h3>Quran Foundation</h3>
        <p><strong>Quran data provided by Quran Foundation.</strong> Where applicable, translations, tafsir editions and recitations supplied through Quran Foundation are credited by their named source or edition.</p>

        <h3>Background Media</h3>
        <p>Selected background videos used by Share Quran are sourced from Pixabay and used under the Pixabay Content License.</p>

        <h3>Fonts</h3>
        <p><strong>Jameel Khushkhati</strong> — Copyright © 2017 Basharat Ali, licensed under the SIL Open Font License 1.1.</p>
        <p><strong>Noto Nastaliq Urdu</strong> — The Noto Project Authors, licensed under the SIL Open Font License 1.1.</p>
        <p><strong>IndoPak Nastaleeq Quran font</strong> — sourced through QUL.</p>

        <div className="about-links">
          <ExternalLinkRow href={LINKS.qulResources}>QUL Resources</ExternalLinkRow>
          <ExternalLinkRow href={LINKS.qulCredits}>QUL Credits & Contributors</ExternalLinkRow>
          <ExternalLinkRow href={LINKS.quranFoundation}>Quran Foundation</ExternalLinkRow>
          <ExternalLinkRow href={LINKS.pixabayLicense}>Pixabay Content License</ExternalLinkRow>
        </div>

        <p className="about-disclaimer">Al Quran is an independent application and is not officially affiliated with or endorsed by Tarteel, QUL, Quran Foundation, Pixabay, or the individual translators and reciters unless expressly stated otherwise.</p>
      </>
    ),
  },
  {
    id: 'licenses',
    icon: Scale,
    title: 'Open-Source Licenses',
    summary: 'Software dependencies and bundled font licenses',
    content: (
      <>
        <p>Al Quran uses open-source software packages and fonts. Their license information and notices are available on the Open-Source Licenses page.</p>
        <ExternalLinkRow href={LINKS.licenses}>View Open-Source Licenses</ExternalLinkRow>
      </>
    ),
  },
  {
    id: 'privacy',
    icon: ShieldCheck,
    title: 'Privacy Policy',
    summary: 'How local app data and third-party services are handled',
    content: (
      <>
        <p>The current release does not require an account and does not include advertising or analytics. Bookmarks, notes, reading progress and settings are stored locally on your device. Network requests are made when app features require third-party Quran content or media.</p>
        <ExternalLinkRow href={LINKS.privacy}>Read Privacy Policy</ExternalLinkRow>
      </>
    ),
  },
  {
    id: 'terms',
    icon: FileText,
    title: 'Terms of Use',
    summary: 'App use, content sources and limitations',
    content: (
      <>
        <p>The Terms of Use explain the independent nature of the app, third-party content rights, supplementary translation/commentary limitations and acceptable use.</p>
        <ExternalLinkRow href={LINKS.terms}>Read Terms of Use</ExternalLinkRow>
      </>
    ),
  },
];

export default function AboutScreen() {
  const [openSection, setOpenSection] = useState('sources');

  return (
    <Screen className="about-screen app-page-shell bg-fluent">
      <div className="app-fixed-header"><Header title="About" /></div>
      <div className="app-scroll-content">
        <section className="about-intro">
          <span className="about-intro-icon"><BookOpen size={22} /></span>
          <div>
            <h2>Al Quran</h2>
            <p>Qur'an reader · Version {APP_VERSION}</p>
          </div>
        </section>

        <div className="about-sections">
          {SECTIONS.map(({ id, icon: Icon, title, summary, content }) => {
            const open = openSection === id;
            return (
              <section className={`about-section${open ? ' is-open' : ''}`} key={id}>
                <button type="button" className="about-section-trigger" onClick={() => setOpenSection(open ? null : id)} aria-expanded={open}>
                  <span className="about-section-icon"><Icon size={18} /></span>
                  <span className="about-section-label"><strong>{title}</strong><small>{summary}</small></span>
                  <ChevronDown className="about-section-chevron" size={18} />
                </button>
                {open && <div className="about-section-content">{content}</div>}
              </section>
            );
          })}
        </div>

        <div className="about-version"><Info size={14} /><span>Al Quran {APP_VERSION}</span></div>
      </div>
    </Screen>
  );
}
