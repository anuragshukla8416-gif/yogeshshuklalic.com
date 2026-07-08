// ============================================================
// Admin Auth Middleware (factory) — verifies admin JWT + checks revocation
// ============================================================
const jwt = require('jsonwebtoken');

module.exports = function adminAuth(tokensRepo) {
  return async function (req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Admin authentication required.' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized for admin actions.' });
      }

      if (payload.jti && tokensRepo) {
        const revoked = await tokensRepo.isRevoked(payload.jti);
        if (revoked) {
          return res.status(401).json({ success: false, error: 'Admin session has been signed out. Please re-enter the PIN.' });
        }
      }

      req.admin = { jti: payload.jti, exp: payload.exp };
      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Admin session expired. Please re-enter the PIN.' });
    }
  };
};
