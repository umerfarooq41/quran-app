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
import './styles/help.css';
import './styles/ui-polish.css';
import './styles/theme.css';
import './styles/index-refined.css';

// Keep native browser/Android long-press menus from competing with app gestures.
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

let refreshingForServiceWorker = false;

navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshingForServiceWorker) return;
  refreshingForServiceWorker = true;
  window.location.reload();
});

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForAppUpdate = () => registration.update().catch(() => {});
    checkForAppUpdate();

    // Discover a deployed build promptly while the installed app stays open.
    window.setInterval(checkForAppUpdate, 5 * 60 * 1000);
    window.addEventListener('focus', checkForAppUpdate);
    window.addEventListener('online', checkForAppUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForAppUpdate();
    });
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
