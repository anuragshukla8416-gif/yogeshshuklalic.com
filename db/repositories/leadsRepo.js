// ============================================================
// Leads Repository
// ============================================================
module.exports = function leadsRepo(pool) {
  return {
    async create(fields) {
      const {
        contact, channel, vertical, category, planNo, planName,
        investAmount, tenure, frequency, actionType, note,
      } = fields;
      const { rows } = await pool.query(
        `INSERT INTO leads
          (client_contact, client_channel, vertical, category, plan_no, plan_name, invest_amount, tenure_years, frequency, action_type, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [contact, channel, vertical, category, planNo || null, planName,
         investAmount, tenure, frequency || null, actionType, note || null]
      );
      return rows[0];
    },

    async findAll() {
      const { rows } = await pool.query(`SELECT * FROM leads ORDER BY created_at DESC`);
      return rows;
    },

    async findByClient(contact, channel) {
      const { rows } = await pool.query(
        `SELECT * FROM leads WHERE client_contact = $1 AND client_channel = $2 ORDER BY created_at DESC`,
        [contact, channel]
      );
      return rows;
    },

    async updateStatus(id, status) {
      const { rows } = await pool.query(
        `UPDATE leads SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id]
      );
      return rows[0] || null;
    },

    async deleteAll() {
      await pool.query(`DELETE FROM leads`);
    },

    async countRecentByContact(contact, windowMinutes) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM leads
         WHERE client_contact = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
        [contact, windowMinutes]
      );
      return rows[0].count;
    },
  };
};
