import { Pool, types } from 'pg';
import { config } from '../config';

// Fix timezone issue: PostgreSQL stores timestamps in UTC,
// but node-postgres by default parses TIMESTAMP WITHOUT TIME ZONE as local time.
// We need to parse them as UTC.

// Type OID for TIMESTAMP WITHOUT TIME ZONE = 1114
// Type OID for TIMESTAMPTZ (with timezone) = 1184
types.setTypeParser(1114, (stringValue: string) => {
  // Append 'Z' to indicate UTC timezone
  return new Date(stringValue + 'Z');
});

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export default pool;
