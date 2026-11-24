require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'notifications',
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,      // close connections unused for 30s
  connectionTimeoutMillis: 5000, // give up if none is free within 5s
});

pool.on('error', (err) => console.error('Idle PG client error:', err.message));

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         SERIAL PRIMARY KEY,
      type       TEXT NOT NULL,
      recipient  TEXT,
      payload    JSONB,
      status     TEXT NOT NULL DEFAULT 'queued',
      error      TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(
    'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT'
   );
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS notifications_idem_key ON notifications (idempotency_key)'
    );
}

async function setStatus(id, status, error = null) {
  await pool.query('SELECT pg_sleep(0.5)'); // TEMP: simulate a slow query
  await pool.query(
    'UPDATE notifications SET status = $1, error = $2, updated_at = now() WHERE id = $3',
    [status, error, id]
  );
}



module.exports = { pool, init, setStatus };
