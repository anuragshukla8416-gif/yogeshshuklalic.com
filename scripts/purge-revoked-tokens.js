// ============================================================
// Purge Expired Revoked Tokens
// ------------------------------------------------------------
// The API process also runs this cleanup on an in-process
// interval (every 6 hours), but that only fires if the process
// stays alive continuously. On hosts that spin the service down
// when idle (e.g. free tiers), that interval may rarely run.
//
// This script does the same cleanup as a one-off command, meant
// to be triggered by an EXTERNAL scheduler instead:
//   - Render: Cron Jobs (Dashboard -> New -> Cron Job)
//   - Railway: Cron plugin / scheduled service
//   - Plain VPS: a crontab entry, e.g. daily at 3am:
//       0 3 * * * cd /path/to/backend && node scripts/purge-revoked-tokens.js
//
// Usage: node scripts/purge-revoked-tokens.js   (or: npm run cleanup:tokens)
// ============================================================
require('dotenv').config();
const pool = require('../db/pool');
const tokensRepo = require('../db/repositories/tokensRepo')(pool);

async function main() {
  const before = await pool.query('SELECT COUNT(*)::int AS count FROM revoked_tokens');
  await tokensRepo.purgeExpired();
  const after = await pool.query('SELECT COUNT(*)::int AS count FROM revoked_tokens');

  const removed = before.rows[0].count - after.rows[0].count;
  console.log(`[cleanup] Purged ${removed} expired revoked token(s). ${after.rows[0].count} remaining.`);
  await pool.end();
}

main().catch(err => {
  console.error('[cleanup] Failed:', err);
  process.exit(1);
});
