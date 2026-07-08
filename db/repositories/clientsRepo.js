// ============================================================
// Clients Repository — factory takes a pg-compatible pool
// (real Pool in production, a fake object in tests)
// ============================================================
module.exports = function clientsRepo(pool) {
  return {
    async upsert(contact, channel) {
      const { rows } = await pool.query(
        `INSERT INTO clients (contact, channel)
         VALUES ($1, $2)
         ON CONFLICT (contact, channel) DO UPDATE SET last_seen_at = NOW()
         RETURNING *`,
        [contact, channel]
      );
      return rows[0];
    },
  };
};
