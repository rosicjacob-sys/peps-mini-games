import React from 'react';
import { createRoot } from 'react-dom/client';
import Widget from './Widget.jsx';
import css from './styles.css?inline';

// Display face for headings (marquee look). Fonts are document-scoped, so the link goes in the host page's <head>.
function loadFont() {
  if (document.querySelector('link[data-peps-font]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'; l.setAttribute('data-peps-font', '');
  document.head.appendChild(l);
}

export function mount({ store, api, locale, game, ageSelector, introPages }) {
  if (!store) return console.warn('[peps-games] missing data-store');
  loadFont();
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
  const go = () => mount({ store: script.dataset.store, api, locale: script.dataset.locale || document.documentElement.lang, game: script.dataset.game, ageSelector: script.dataset.ageSelector, introPages: script.dataset.introPages });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
}
