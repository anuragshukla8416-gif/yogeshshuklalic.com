// ============================================================
// Lead Rate Limiter — keyed by the authenticated client's contact,
// not by IP, since clientAuth has already run by this point.
// ============================================================
const rateLimit = require('express-rate-limit');

const leadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,                  // 20 lead actions per client per window is generous for genuine browsing
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.client && req.client.contact) || req.ip,
  message: { success: false, error: 'You are submitting requests too quickly. Please wait a few minutes and try again.' },
});

module.exports = leadRateLimiter;
