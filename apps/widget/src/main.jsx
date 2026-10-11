import React from 'react';
import { createRoot } from 'react-dom/client';
import Widget from './Widget.jsx';
import css from './styles.css?inline';

export function mount({ store, api, locale, game }) {
  if (!store) return console.warn('[peps-games] missing data-store');
  const host = document.createElement('div');
  host.setAttribute('data-peps-games', '');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.append(style, container);
  createRoot(container).render(<Widget store={store} api={api} locale={locale} gameType={game} />);
}

// Auto-mount from the <script> tag.
const script = document.currentScript;
if (script?.dataset.store) {
  const api = script.dataset.api || import.meta.env.VITE_API_URL || new URL(script.src).origin.replace('-widget', '-api');
  const go = () => mount({ store: script.dataset.store, api, locale: script.dataset.locale || document.documentElement.lang, game: script.dataset.game });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
}
