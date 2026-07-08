const express = require('express');
const leadRateLimiter = require('../middleware/leadRateLimiter');

module.exports = function leadRoutes(leadController, clientAuthMiddleware) {
  const router = express.Router();
  router.post('/', clientAuthMiddleware, leadRateLimiter, leadController.createLead);
  router.get('/mine', clientAuthMiddleware, leadController.myLeads);
  return router;
};
