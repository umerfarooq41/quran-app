import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/reader.css';
import './styles/tabs.css';
import './styles/tafsir.css';
import './styles/home.css';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
