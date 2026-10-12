// The HTTP app, without the side effects of starting (listening, the reminder job, colour detection): tests mount it.
import express from 'express';
import cors from 'cors';
import { q } from './db.js';
import { publicRouter } from './public.js';
import { adminRouter } from './admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', async (_req, res) => { await q('SELECT 1'); res.send('ok'); });
  app.use('/api/public', publicRouter);
  const dashOrigin = process.env.DASHBOARD_ORIGIN;
  if (!dashOrigin) console.warn('DASHBOARD_ORIGIN is not set: the admin API answers to any website');
  app.use('/api/admin', cors({ origin: dashOrigin ? dashOrigin.split(',').map((s) => s.trim()) : true }), adminRouter);
  return app;
}
