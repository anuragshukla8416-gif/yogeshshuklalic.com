// ============================================================
// Migration Runner
// ------------------------------------------------------------
// Applies every .sql file in db/migrations/ that hasn't already
// been recorded in the schema_migrations table, in filename order.
// Each migration runs inside its own transaction.
//
// Usage:
//   node db/migrate.js            (or: npm run migrate:up)
//
// Adding a new migration later:
//   1. Create db/migrations/002_your_change.sql
//   2. Write plain SQL (CREATE TABLE / ALTER TABLE / etc.)
//   3. Run `npm run migrate:up` — only the new file gets applied.
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(`SELECT name FROM schema_migrations`);
  return new Set(rows.map(r => r.name));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // filenames are zero-padded, so lexical sort == chronological order

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip (already applied): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] applying: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        appliedCount++;
        console.log(`[migrate] applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED on ${file}:`, err.message);
        throw err;
      }
    }

    console.log(appliedCount === 0
      ? '[migrate] Database already up to date. Nothing to do.'
      : `[migrate] Done. Applied ${appliedCount} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('[migrate] Migration run failed:', err);
    process.exit(1);
  });
}

module.exports = { run };
