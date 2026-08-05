import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/reader.css';
import './styles/mushaf.css';
import './styles/tabs.css';
import './styles/tafsir.css';
import './styles/home.css';
import './styles/index.css';
import './styles/search.css';
import './styles/mobile-first.css';
import './styles/settings.css';
import './styles/ui-polish.css';
import './styles/theme.css';


const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    // Vercel deployments can stay open for a long time. Check periodically so
    // a newly deployed service worker is discovered without repeated refreshes.
    window.setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
