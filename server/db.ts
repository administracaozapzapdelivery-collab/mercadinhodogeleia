import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada no arquivo .env');
}

const isLocalDb =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' || (!isLocalDb && process.env.DATABASE_SSL !== 'false')
      ? { rejectUnauthorized: false }
      : false,
});
