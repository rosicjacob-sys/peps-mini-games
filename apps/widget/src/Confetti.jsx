import React, { useEffect, useRef } from 'react';

const COLORS = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#8B5CF6', '#F78C6B', '#FFFFFF'];

// One-shot confetti burst on a full-screen canvas. Skipped for visitors who prefer reduced motion.
export default function Confetti({ duration = 4200 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current; const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize(); addEventListener('resize', resize);
    const W = () => innerWidth * dpr, H = () => innerHeight * dpr;
    // two cannons from the lower corners + a shower from the top
    const make = (x, y, angle, spread, speed) => ({
      x, y, vx: Math.cos(angle + (Math.random() - 0.5) * spread) * speed * (0.6 + Math.random() * 0.6),
      vy: Math.sin(angle + (Math.random() - 0.5) * spread) * speed * (0.6 + Math.random() * 0.6),
      w: (6 + Math.random() * 7) * dpr, h: (9 + Math.random() * 8) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
      c: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.25,
    });
    const parts = [];
    for (let i = 0; i < 70; i++) parts.push(make(0, H() * 0.85, -Math.PI / 3, 0.9, 20 * dpr));
    for (let i = 0; i < 70; i++) parts.push(make(W(), H() * 0.85, (-2 * Math.PI) / 3, 0.9, 20 * dpr));
    for (let i = 0; i < 60; i++) { const p = make(Math.random() * W(), -20 * dpr, Math.PI / 2, 0.4, 3 * dpr); p.vy = (2 + Math.random() * 3) * dpr; parts.push(p); }
    const t0 = performance.now(); let raf;
    const tick = (now) => {
      const el = now - t0; ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fade = el > duration - 900 ? Math.max(0, (duration - el) / 900) : 1;
      for (const p of parts) {
        p.vy += 0.45 * dpr; p.vx *= 0.992; p.vy *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (el < duration) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
