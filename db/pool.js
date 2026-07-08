// ============================================================
// Database connection pool (node-postgres)
// ------------------------------------------------------------
// Pool sizing is tunable via env vars so it can be adjusted per
// host without a code change. Defaults are conservative and fit
// comfortably within the connection limits of most free/hobby
// managed Postgres tiers (Render, Railway, Supabase, Neon).
// ============================================================
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,

  max: Number(process.env.PGPOOL_MAX || 10),                          // max simultaneous clients
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || 30000), // close idle clients after 30s
  connectionTimeoutMillis: Number(process.env.PGPOOL_CONN_TIMEOUT_MS || 5000), // fail fast if the DB is unreachable
});

pool.on('error', (err) => {
  // Fired when an *idle* client in the pool errors out (e.g. the DB restarted).
  // Logging + exiting is the safest default for a small service like this one;
  // your process manager (Docker/Render/PM2) should be configured to restart it.
  console.error('[db] Unexpected error on idle client:', err.message);
  process.exit(1);
});

module.exports = pool;
