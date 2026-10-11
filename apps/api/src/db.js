import pg from 'pg';
import { readFileSync } from 'node:fs';

const ssl = process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined;
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });

export const q = (text, params) => pool.query(text, params);

export async function migrate() {
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
