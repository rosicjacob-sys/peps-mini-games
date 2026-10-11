import express from 'express';
import cors from 'cors';
import { migrate, q } from './db.js';
import { publicRouter } from './public.js';
import { adminRouter } from './admin.js';

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'DASHBOARD_PASSWORD']) {
  if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (_req, res) => { await q('SELECT 1'); res.send('ok'); });
app.use('/api/public', publicRouter);
const dashOrigin = process.env.DASHBOARD_ORIGIN;
app.use('/api/admin', cors({ origin: dashOrigin ? dashOrigin.split(',').map((s) => s.trim()) : true }), adminRouter);

await migrate();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));
