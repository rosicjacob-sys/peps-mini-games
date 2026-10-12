import { migrate } from './db.js';
import { createApp } from './app.js';
import { linkCustomRewards, moveGamesToGroups } from './admin.js';
import { scheduleReminders } from './reminders.js';
import { detectMissingColors } from './colors.js';

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'DASHBOARD_PASSWORD']) {
  if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
}

await migrate();
const grouped = await moveGamesToGroups();
if (grouped.moved) console.log(`Moved ${grouped.moved} game(s) from their store to its store group (${grouped.created} group(s) created for ungrouped stores).`);
const moved = await linkCustomRewards();
if (moved.linked) console.log(`Moved ${moved.linked} game reward(s) into the rewards library (${moved.created} new).`);

const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));
scheduleReminders();
// read brand colours for stores that have a website but no colours yet
setTimeout(() => detectMissingColors().catch((e) => console.error('[colors]', e)), 5000);
