import React from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './style.css';
import App from './App.jsx';
import { seedIfEmpty } from './lib/seed.js';
import { getStore } from './lib/storage.js';

// Seeds before the first render, because the home page reads the store as it renders.
// Full or blocked storage makes this throw, and the app should still open without the deck.
try {
  seedIfEmpty(getStore(), Date.now());
} catch (error) {
  console.error('Could not add the starter deck.', error);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
