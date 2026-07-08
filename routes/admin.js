const express = require('express');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many PIN attempts. Please try again later.' },
});

module.exports = function adminRoutes(adminController, adminAuthMiddleware) {
  const router = express.Router();
  router.post('/login', loginLimiter, adminController.login);
  router.post('/logout', adminAuthMiddleware, adminController.logout);
  router.get('/leads', adminAuthMiddleware, adminController.listLeads);
  router.patch('/leads/:id', adminAuthMiddleware, adminController.updateStatus);
  router.delete('/leads', adminAuthMiddleware, adminController.clearLeads);
  router.get('/leads/export', adminAuthMiddleware, adminController.exportCsv);
  return router;
};
