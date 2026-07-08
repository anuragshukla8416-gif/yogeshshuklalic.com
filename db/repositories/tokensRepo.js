// ============================================================
// Tokens Repository — tracks revoked JWTs (for logout)
// ============================================================
module.exports = function tokensRepo(pool) {
  return {
    async revoke(jti, expiresAt) {
      await pool.query(
        `INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2)
         ON CONFLICT (jti) DO NOTHING`,
        [jti, expiresAt]
      );
    },

    async isRevoked(jti) {
      const { rows } = await pool.query(
        `SELECT 1 FROM revoked_tokens WHERE jti = $1 LIMIT 1`,
        [jti]
      );
      return rows.length > 0;
    },

    async purgeExpired() {
      await pool.query(`DELETE FROM revoked_tokens WHERE expires_at < NOW()`);
    },
  };
};
