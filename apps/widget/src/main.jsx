import React from 'react';
import { createRoot } from 'react-dom/client';
import Widget from './Widget.jsx';
import css from './styles.css?inline';

// Display face: "Coffee Tin" when self-hosted next to widget.js (public/fonts/coffee-tin.woff2),
// otherwise "Rye" from Google Fonts - the same Tuscan casino look. Arcade games use "Fredoka". Fonts are document-scoped,
// so both go in the host page's <head>.
function loadFont(assetBase) {
  if (document.querySelector('link[data-peps-font]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Rye&family=Fredoka:wght@400;500;600;700&display=swap'; l.setAttribute('data-peps-font', '');
  document.head.appendChild(l);
  if (assetBase) {
    const st = document.createElement('style');
    st.textContent = `@font-face{font-family:"Coffee Tin";src:url("${assetBase}/fonts/coffee-tin.woff2") format("woff2"),url("${assetBase}/fonts/coffee-tin.ttf") format("truetype");font-display:swap}`;
    document.head.appendChild(st);
  }
}

// `store` (data-store) is optional: without it the API finds the store by this website's address.
// `preview` (data-preview) is a token from the dashboard: that one game is shown and nothing is recorded.
export function mount({ store = '', api, locale, game, ageSelector, introPages, assetBase, preview }) {
  loadFont(assetBase);
  const host = document.createElement('div');
  // the version marker the dashboard's "Check install" looks for (this build supports the shared, keyless line)
  host.setAttribute('data-peps-games', 'pg-groups-v1');
  // Themes hide stray divs under <body> (one store's stylesheet set display:none on it) and some animate <body>,
  // which breaks position:fixed inside it. The host goes on <html> instead, with its own display pinned inline.
  for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1'], ['position', 'static'], ['width', '0'], ['height', '0'], ['overflow', 'visible']]) host.style.setProperty(k, v, 'important');
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.append(style, container);
  createRoot(container).render(<Widget store={store} api={api} locale={locale} gameType={game} ageSelector={ageSelector} introPages={introPages} preview={preview} />);
}

// Auto-mount from the <script> tag. The same line works on every store (no data-store needed).
const script = document.currentScript;
if (script?.src) {
  const api = script.dataset.api || import.meta.env.VITE_API_URL || new URL(script.src).origin.replace('-widget', '-api');
  const assetBase = new URL(script.src).href.replace(/\/[^/]*$/, '');
  const go = () => mount({ store: script.dataset.store, api, locale: script.dataset.locale || document.documentElement.lang, game: script.dataset.game, ageSelector: script.dataset.ageSelector, introPages: script.dataset.introPages, assetBase, preview: script.dataset.preview });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
}
