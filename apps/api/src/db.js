import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';

const ssl = process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined;
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });

export const q = (text, params) => pool.query(text, params);

const MIGRATIONS = new URL('./migrations/', import.meta.url);
const LOCK = 74219032; // pg advisory lock: two API instances starting together apply each migration once

// schema.sql is the baseline: idempotent CREATE/ALTER ... IF NOT EXISTS, safe to replay at every start.
// Anything that must run exactly once (data fixes, moves between columns) is a numbered file in src/migrations/,
// applied in name order inside a transaction and recorded in schema_migrations.
export async function migrate() {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK]);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const name of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(name)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(new URL(name, MIGRATIONS), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${name}`);
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    client.release();
  }
}
