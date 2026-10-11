import React from 'react';
import { createRoot } from 'react-dom/client';
import Widget from './Widget.jsx';
import css from './styles.css?inline';

// Display face: "Coffee Tin" when self-hosted next to widget.js (public/fonts/coffee-tin.woff2),
// otherwise "Rye" from Google Fonts - the same Tuscan casino look. Fonts are document-scoped,
// so both go in the host page's <head>.
function loadFont(assetBase) {
  if (document.querySelector('link[data-peps-font]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Rye&display=swap'; l.setAttribute('data-peps-font', '');
  document.head.appendChild(l);
  if (assetBase) {
    const st = document.createElement('style');
    st.textContent = `@font-face{font-family:"Coffee Tin";src:url("${assetBase}/fonts/coffee-tin.woff2") format("woff2"),url("${assetBase}/fonts/coffee-tin.ttf") format("truetype");font-display:swap}`;
    document.head.appendChild(st);
  }
}

export function mount({ store, api, locale, game, ageSelector, introPages, assetBase }) {
  if (!store) return console.warn('[peps-games] missing data-store');
  loadFont(assetBase);
  const host = document.createElement('div');
  host.setAttribute('data-peps-games', '');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.append(style, container);
  createRoot(container).render(<Widget store={store} api={api} locale={locale} gameType={game} ageSelector={ageSelector} introPages={introPages} />);
}

// Auto-mount from the <script> tag.
const script = document.currentScript;
if (script?.dataset.store) {
  const api = script.dataset.api || import.meta.env.VITE_API_URL || new URL(script.src).origin.replace('-widget', '-api');
  const assetBase = new URL(script.src).href.replace(/\/[^/]*$/, '');
  const go = () => mount({ store: script.dataset.store, api, locale: script.dataset.locale || document.documentElement.lang, game: script.dataset.game, ageSelector: script.dataset.ageSelector, introPages: script.dataset.introPages, assetBase });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
}
