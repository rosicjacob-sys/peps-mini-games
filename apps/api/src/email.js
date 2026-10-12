import { t, gameTheme, categoryOf, GAME_TYPES } from '@peps/shared';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const COPY = {
  en: {
    subject: 'A new week, a new chance to win!', heading: 'Your weekly game is ready!',
    body: 'Good news: the weekly reset is here, so you can play again. Take your shot at exciting rewards like discount codes, free gifts and more.',
    cta: 'Play now', note: 'One play per email each week.',
    why: (store) => `You are receiving this because you played a game on ${store} with this email.`, unsub: 'Unsubscribe',
  },
  fr: {
    subject: 'Nouvelle semaine, nouvelle chance de gagner!', heading: 'Votre jeu de la semaine est prêt!',
    body: 'Bonne nouvelle : la semaine a recommencé, vous pouvez donc rejouer. Tentez votre chance pour gagner de superbes récompenses : codes de réduction, cadeaux gratuits et plus encore.',
    cta: 'Jouer maintenant', note: 'Une partie par adresse courriel chaque semaine.',
    why: (store) => `Vous recevez ce courriel parce que vous avez joué à un jeu sur ${store} avec cette adresse.`, unsub: 'Se désabonner',
  },
};

// The weekly "play again" email, styled like the game they played (casino felt and gold, or arcade gradient).
export function buildReminder({ game, locale, playUrl, unsubUrl }) {
  const c = COPY[locale] || COPY.en;
  const th = gameTheme(game);
  const arcade = categoryOf(game.type) === 'arcade';
  const subject = t(game.email_subject, locale) || c.subject;
  const store = game.store_name || '';
  const head = arcade ? `background-color:${th.grad[1]};background-image:linear-gradient(135deg,${th.grad[0]},${th.grad[1]})` : `background-color:${th.bg}`;
  const font = arcade ? "'Trebuchet MS',Arial,Helvetica,sans-serif" : "Georgia,'Times New Roman',serif";   // single quotes: it goes inside style="..."
  const title = arcade ? (th.onGrad || '#ffffff') : (th.rim || '#D6B24A');
  const icon = GAME_TYPES[game.type]?.icon || '🎁';
  const button = playUrl ? `<p style="margin:26px 0 8px"><a href="${esc(playUrl)}" style="display:inline-block;background:${th.accent};color:${th.accentText};font-weight:700;font-size:17px;text-decoration:none;padding:14px 34px;border-radius:${arcade ? 16 : 10}px">${c.cta}</a></p>` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
      <tr><td align="center" style="${head};padding:34px 24px 30px">
        <div style="font-size:40px;line-height:1">${icon}</div>
        <h1 style="margin:12px 0 0;font-family:${font};font-size:28px;line-height:1.2;color:${title}">${esc(c.heading)}</h1>
        ${store ? `<div style="margin-top:6px;color:${arcade ? 'rgba(255,255,255,.85)' : th.muted};font-size:14px">${esc(store)}</div>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:28px 28px 30px;font-size:16px;line-height:1.55">
        <p style="margin:0">${esc(c.body)}</p>${button}
        <p style="margin:12px 0 0;color:#6b7280;font-size:13px">${esc(c.note)}</p>
      </td></tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;color:#9ca3af;font-size:12px;line-height:1.5">${esc(c.why(store))}${unsubUrl ? ` <a href="${esc(unsubUrl)}" style="color:#6b7280">${c.unsub}</a>` : ''}</p>
  </td></tr></table></body></html>`;
  const text = `${c.heading}\n\n${c.body}\n${playUrl ? `\n${c.cta}: ${playUrl}\n` : ''}\n${c.note}\n\n${c.why(store)}${unsubUrl ? `\n${c.unsub}: ${unsubUrl}` : ''}`;
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

export async function sendEmail({ game, to, mail, headers }) {
  if (!process.env.RESEND_API_KEY) { console.warn('[email] RESEND_API_KEY missing, skipped'); return { ok: false, error: 'RESEND_API_KEY is not set on the API' }; }
  const sender = resolveSender(game);
  if (!sender.from_email) { console.warn(`[email] game ${game.id} has no from_email (and no group default), skipped`); return { ok: false, error: 'No sender: set a From email on the game or its store group' }; }
  const from = sender.from_name ? `${sender.from_name} <${sender.from_email}>` : sender.from_email;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text, ...(sender.reply_to ? { reply_to: sender.reply_to } : {}), ...(headers ? { headers } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error', res.status, body);
    let msg = body; try { msg = JSON.parse(body).message || body; } catch {}
    return { ok: false, error: `Resend ${res.status}: ${String(msg).slice(0, 300)}` };
  }
  return { ok: true };
}
