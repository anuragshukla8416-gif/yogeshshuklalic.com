const express = require('express');
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests from this device. Please try again later.' },
});

module.exports = function authRoutes(authController, clientAuthMiddleware) {
  const router = express.Router();
  router.post('/request-otp', otpLimiter, authController.requestOtp);
  router.post('/verify-otp', otpLimiter, authController.verifyOtp);
  router.post('/logout', clientAuthMiddleware, authController.logout);
  return router;
};
