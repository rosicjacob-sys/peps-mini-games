import { t } from '@peps/shared';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const COPY = {
  en: {
    subject: 'Your reward code', hello: 'Thanks for playing!', yourCode: 'Your code',
    how: 'Enter this code in your cart at checkout to apply your reward.',
    limited: 'Claim it soon: this offer is only available for a very limited time.', fine: 'Valid once per customer.',
  },
  fr: {
    subject: 'Votre code de récompense', hello: 'Merci d’avoir joué!', yourCode: 'Votre code',
    how: 'Entrez ce code dans votre panier, à la caisse, pour appliquer votre récompense.',
    limited: 'Profitez-en vite : cette offre n’est disponible que pour une durée très limitée.', fine: 'Valide une seule fois par client.',
  },
};

export function buildEmail({ game, rewards, locale }) {
  const c = COPY[locale] || COPY.en;
  const subject = t(game.email_subject, locale) || c.subject;
  const blocks = rewards.map((r) => `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:16px 0;text-align:center">
      <div style="font-size:20px;font-weight:700">${esc(t(r.title, locale))}</div>
      <div style="color:#6b7280;margin:4px 0 14px">${esc(t(r.subtitle, locale))}</div>
      <div style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.08em">${c.yourCode}</div>
      <div style="font-family:monospace;font-size:26px;font-weight:700;letter-spacing:.06em;margin-top:4px">${esc(r.code)}</div>
    </div>`).join('');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 8px">${c.hello}</h2><p style="margin:0">${c.how}</p>${blocks}
    <p style="font-size:14px"><strong>${c.limited}</strong><br>${c.fine}</p></body></html>`;
  const text = `${c.hello}\n${c.how}\n\n` + rewards.map((r) => `${t(r.title, locale)}: ${r.code}`).join('\n') + `\n\n${c.limited} ${c.fine}`;
  return { subject, html, text };
}

// A game's own sender wins; blank fields fall back to its store group's defaults.
export function resolveSender(g) {
  return {
    from_name: g.from_name || g.group_from_name || '',
    from_email: g.from_email || g.group_from_email || '',
    reply_to: g.reply_to || g.group_reply_to || '',
    source: g.from_email ? 'game' : g.group_from_email ? 'group' : 'none',
  };
}

export async function sendEmail({ game, to, mail }) {
  if (!process.env.RESEND_API_KEY) { console.warn('[email] RESEND_API_KEY missing, skipped'); return { ok: false, error: 'RESEND_API_KEY is not set on the API' }; }
  const sender = resolveSender(game);
  if (!sender.from_email) { console.warn(`[email] game ${game.id} has no from_email (and no group default), skipped`); return { ok: false, error: 'No sender: set a From email on the game or its store group' }; }
  const from = sender.from_name ? `${sender.from_name} <${sender.from_email}>` : sender.from_email;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text, ...(sender.reply_to ? { reply_to: sender.reply_to } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error', res.status, body);
    let msg = body; try { msg = JSON.parse(body).message || body; } catch {}
    return { ok: false, error: `Resend ${res.status}: ${String(msg).slice(0, 300)}` };
  }
  return { ok: true };
}
