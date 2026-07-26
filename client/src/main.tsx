import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyPrivacyMode, readPrivacyMode } from './lib/privacy';
import './index.css';

// Theme/privacy bootstrapping also runs inline in index.html to avoid flashes.
applyPrivacyMode(readPrivacyMode());

const storedTheme = window.localStorage.getItem('worthlog-theme');
const initialTheme =
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

document.documentElement.dataset['theme'] = initialTheme;
document.documentElement.style.colorScheme = initialTheme;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
