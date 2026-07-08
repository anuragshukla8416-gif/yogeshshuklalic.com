// ============================================================
// Client Auth Middleware (factory) — verifies JWT + checks revocation
// ============================================================
const jwt = require('jsonwebtoken');

module.exports = function clientAuth(tokensRepo) {
  return async function (req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing session token. Please sign in again.' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      if (payload.jti && tokensRepo) {
        const revoked = await tokensRepo.isRevoked(payload.jti);
        if (revoked) {
          return res.status(401).json({ success: false, error: 'Session has been signed out. Please sign in again.' });
        }
      }

      req.client = { contact: payload.contact, channel: payload.channel, jti: payload.jti, exp: payload.exp };
      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid. Please sign in again.' });
    }
  };
};
