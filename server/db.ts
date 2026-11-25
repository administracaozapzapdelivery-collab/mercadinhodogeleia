import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada no arquivo .env');
}

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.DATABASE_URL.includes('sslmode=require') ||
  (Boolean(process.env.VERCEL) && process.env.DATABASE_SSL !== 'false');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});
