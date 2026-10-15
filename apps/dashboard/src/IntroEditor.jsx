import React from 'react';
import { INTRO_DEFAULTS } from '@peps/shared';

// An EN + FR pair of fields.
export const Loc = ({ label, value, onChange, ph, rows }) => (
  <div className="loc">
    {['en', 'fr'].map((l) => (
      <label key={l}>{label} <span className="tag">{l.toUpperCase()}</span>
        {rows ? <textarea rows={rows} value={value?.[l] || ''} placeholder={ph} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          : <input value={value?.[l] || ''} placeholder={ph} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />}
      </label>
    ))}
  </div>
);

const L = (en, fr) => ({ en, fr });
export const introDefaults = () => ({
  enabled: true, image: '',
  heading: L(INTRO_DEFAULTS.en.heading, INTRO_DEFAULTS.fr.heading),
  description: L(INTRO_DEFAULTS.en.description, INTRO_DEFAULTS.fr.description),
  steps: INTRO_DEFAULTS.en.steps.map((x, i) => L(x, INTRO_DEFAULTS.fr.steps[i])),
  note: L(INTRO_DEFAULTS.en.note, INTRO_DEFAULTS.fr.note),
  playLabel: L(INTRO_DEFAULTS.en.playLabel, INTRO_DEFAULTS.fr.playLabel),
  declineLabel: L(INTRO_DEFAULTS.en.declineLabel, INTRO_DEFAULTS.fr.declineLabel),
});

// The "Play to Win" popup visitors see on the homepage 5 seconds after age verification. One per store group:
// every store in the group shows it, whatever games the group has.
export default function IntroEditor({ value, onChange }) {
  const intro = { enabled: true, image: '', steps: [], ...(value || {}) };
  const set = (patch) => onChange({ ...intro, ...patch });
  const ph = (k, l) => INTRO_DEFAULTS[l][k];
  const setStep = (i, v) => set({ steps: intro.steps.map((x, j) => (j === i ? v : x)) });
  return (
    <>
      <div className="row">
        <label className="check"><input type="checkbox" checked={intro.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Show the popup on the homepage</label>
        <button type="button" onClick={() => set(introDefaults())}>Fill with suggested copy</button>
      </div>
      <p className="muted">Shown on the homepage of every store in this group, every visit, 5 seconds after the visitor confirms their age. Visitors can pick English or French in the popup. Blank fields use the suggested copy shown in grey.</p>
      <Loc label="Heading" value={intro.heading} onChange={(v) => set({ heading: v })} ph={ph('heading', 'en')} />
      <Loc label="Description" rows="3" value={intro.description} onChange={(v) => set({ description: v })} ph={ph('description', 'en')} />
      <h3>How to win (steps)</h3>
      {intro.steps.map((st, i) => (
        <div key={i} className="row">
          <div className="loc grow">
            {['en', 'fr'].map((l) => <label key={l}>Step {i + 1} <span className="tag">{l.toUpperCase()}</span><input value={st[l] || ''} onChange={(e) => setStep(i, { ...st, [l]: e.target.value })} /></label>)}
          </div>
          <button type="button" className="danger" onClick={() => set({ steps: intro.steps.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      {intro.steps.length < 6 && <button type="button" onClick={() => set({ steps: [...intro.steps, L('', '')] })}>+ Add step</button>}
      {!intro.steps.length && <p className="muted">No steps set, so the 3 suggested steps are shown.</p>}
      <Loc label="Small print" rows="2" value={intro.note} onChange={(v) => set({ note: v })} ph={ph('note', 'en')} />
      <div className="row"><Loc label="Play button" value={intro.playLabel} onChange={(v) => set({ playLabel: v })} ph={ph('playLabel', 'en')} /></div>
      <Loc label="Decline button" value={intro.declineLabel} onChange={(v) => set({ declineLabel: v })} ph={ph('declineLabel', 'en')} />
      <label>Image URL <span className="muted">(optional, https only)</span><input value={intro.image || ''} onChange={(e) => set({ image: e.target.value })} placeholder="https://…" /></label>
    </>
  );
}
