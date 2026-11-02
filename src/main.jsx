import React from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './style.css';
import App from './App.jsx';
import { seedIfEmpty } from './lib/seed.js';
import { getStore } from './lib/storage.js';

// Seeds before the first render, because the home page reads the store as it renders.
seedIfEmpty(getStore(), Date.now());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
