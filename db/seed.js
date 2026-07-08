// ============================================================
// Seed Script — sample data for local/demo use only
// ------------------------------------------------------------
// Usage: npm run seed
// Refuses to run against anything that looks like a production
// DATABASE_URL unless you pass --force, as a guard rail.
// ============================================================
require('dotenv').config();
const pool = require('./pool');
const clientsRepo = require('./repositories/clientsRepo')(pool);
const leadsRepo = require('./repositories/leadsRepo')(pool);

const FORCE = process.argv.includes('--force');

const SAMPLE_CLIENTS = [
  { contact: '9339609665', channel: 'mobile' },
  { contact: '9830012345', channel: 'mobile' },
  { contact: 'priya.sen@example.com', channel: 'email' },
];

const SAMPLE_LEADS = [
  { contact: '9339609665', channel: 'mobile', vertical: 'Life Insurance', category: 'Pure Protection', planNo: '954', planName: "LIC's New Tech-Term", investAmount: 1000000, tenure: 20, frequency: 'Monthly', actionType: 'Request Quote', note: 'Prefers evening calls' },
  { contact: '9339609665', channel: 'mobile', vertical: 'Life Insurance', category: 'Pure Protection', planNo: '954', planName: "LIC's New Tech-Term", investAmount: 1000000, tenure: 20, frequency: 'Monthly', actionType: 'Official Brochure', note: null },
  { contact: '9830012345', channel: 'mobile', vertical: 'Health Insurance', category: 'Family Floater', planNo: null, planName: 'Family Health Optima Insurance Plan', investAmount: 1000000, tenure: 1, frequency: 'Yearly', actionType: 'Request Quote', note: 'Family of 4, youngest member 8 years old' },
  { contact: 'priya.sen@example.com', channel: 'email', vertical: 'Mutual Fund', category: 'Equity Funds', planNo: null, planName: 'Flexi Cap Equity Fund', investAmount: 500000, tenure: 10, frequency: 'Monthly', actionType: 'Request Quote', note: null },
  { contact: 'priya.sen@example.com', channel: 'email', vertical: 'Mutual Fund', category: 'Tax Saving (ELSS)', planNo: null, planName: 'ELSS Tax Saver Fund', investAmount: 150000, tenure: 3, frequency: 'Yearly', actionType: 'Official Brochure', note: null },
  { contact: '9830012345', channel: 'mobile', vertical: 'Motor Insurance', category: 'Private Car', planNo: null, planName: 'Private Car Package Policy (Comprehensive)', investAmount: 600000, tenure: 1, frequency: 'Yearly', actionType: 'Request Quote', note: 'Renewal due next month' },
];

async function seed() {
  const dbUrl = process.env.DATABASE_URL || '';
  const looksLocal = /localhost|127\.0\.0\.1|db:5432/.test(dbUrl);
  if (!looksLocal && !FORCE) {
    console.error('[seed] DATABASE_URL does not look like a local/dev database.');
    console.error('[seed] Refusing to seed what might be production. Re-run with --force if you are sure.');
    process.exit(1);
  }

  console.log('[seed] Seeding sample clients...');
  for (const c of SAMPLE_CLIENTS) await clientsRepo.upsert(c.contact, c.channel);

  console.log('[seed] Seeding sample leads...');
  for (const lead of SAMPLE_LEADS) {
    const created = await leadsRepo.create(lead);
    console.log(`[seed]   + ${created.vertical} — ${created.plan_name} (${created.action_type})`);
  }

  console.log('[seed] Done. Sample data is now in the ledger.');
  await pool.end();
}

if (require.main === module) {
  seed().catch(err => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });
}

module.exports = { seed };
