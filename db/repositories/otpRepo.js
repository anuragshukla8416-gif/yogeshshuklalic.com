// ============================================================
// OTP Repository
// ============================================================
module.exports = function otpRepo(pool) {
  return {
    async findMostRecent(contact, channel) {
      const { rows } = await pool.query(
        `SELECT * FROM otp_verifications
         WHERE contact = $1 AND channel = $2
         ORDER BY created_at DESC LIMIT 1`,
        [contact, channel]
      );
      return rows[0] || null;
    },

    async findLatestUnverified(contact, channel) {
      const { rows } = await pool.query(
        `SELECT * FROM otp_verifications
         WHERE contact = $1 AND channel = $2 AND verified = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [contact, channel]
      );
      return rows[0] || null;
    },

    async create(contact, channel, otpHash, expiresAt) {
      const { rows } = await pool.query(
        `INSERT INTO otp_verifications (contact, channel, otp_hash, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [contact, channel, otpHash, expiresAt]
      );
      return rows[0];
    },

    async incrementAttempts(id) {
      await pool.query(`UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`, [id]);
    },

    async markVerified(id) {
      await pool.query(`UPDATE otp_verifications SET verified = TRUE WHERE id = $1`, [id]);
    },
  };
};
