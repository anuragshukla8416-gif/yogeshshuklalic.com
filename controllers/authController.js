// ============================================================
// Auth Controller (factory) — request-otp / verify-otp / logout
// ============================================================
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { generateOtp, hashOtp, verifyOtpHash, sendOtp } = require('../services/otpService');
const { isValidContact, isValidChannel, isValidOtpCode } = require('../validators');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

module.exports = function authController({ otpRepo, clientsRepo, tokensRepo }) {
  async function requestOtp(req, res) {
    try {
      const { contact, channel } = req.body;

      if (!contact || !isValidChannel(channel)) {
        return res.status(400).json({ success: false, error: 'A valid contact and channel (mobile/email) are required.' });
      }
      if (!isValidContact(contact, channel)) {
        return res.status(400).json({
          success: false,
          error: channel === 'mobile' ? 'Enter a valid 10-digit Indian mobile number.' : 'Enter a valid email address.',
        });
      }

      const recent = await otpRepo.findMostRecent(contact, channel);
      if (recent) {
        const elapsed = Date.now() - new Date(recent.created_at).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return res.status(429).json({ success: false, error: `Please wait ${waitSec}s before requesting another code.` });
        }
      }

      const code = generateOtp();
      const otpHash = hashOtp(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);
      await otpRepo.create(contact, channel, otpHash, expiresAt);

      const result = await sendOtp(contact, channel, code);

      return res.json({
        success: true,
        message: 'OTP dispatched.',
        devMode: result.devMode,
        devCode: result.devMode ? result.code : undefined,
      });
    } catch (err) {
      console.error('[authController.requestOtp]', err);
      return res.status(500).json({ success: false, error: 'Could not send OTP right now. Please try again shortly.' });
    }
  }

  async function verifyOtp(req, res) {
    try {
      const { contact, channel, code } = req.body;
      if (!contact || !isValidChannel(channel) || !isValidOtpCode(code)) {
        return res.status(400).json({ success: false, error: 'Contact, channel and a 6-digit code are all required.' });
      }

      const record = await otpRepo.findLatestUnverified(contact, channel);
      if (!record) {
        return res.status(400).json({ success: false, error: 'No pending OTP found. Please request a new code.' });
      }
      if (new Date(record.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ success: false, error: 'This OTP has expired. Please request a new code.' });
      }
      if (record.attempts >= MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, error: 'Too many incorrect attempts. Please request a new code.' });
      }
      if (!verifyOtpHash(String(code), record.otp_hash)) {
        await otpRepo.incrementAttempts(record.id);
        return res.status(400).json({ success: false, error: 'Incorrect OTP. Please try again.' });
      }

      await otpRepo.markVerified(record.id);
      await clientsRepo.upsert(contact, channel);

      const jti = crypto.randomUUID();
      const token = jwt.sign({ contact, channel, jti }, process.env.JWT_SECRET, {
        expiresIn: process.env.SESSION_TOKEN_EXPIRY || '7d',
      });

      return res.json({ success: true, token, contact, channel });
    } catch (err) {
      console.error('[authController.verifyOtp]', err);
      return res.status(500).json({ success: false, error: 'Could not verify OTP right now. Please try again shortly.' });
    }
  }

  async function logout(req, res) {
    try {
      // req.client is set by clientAuth middleware and includes the decoded token's jti/exp
      const { jti, exp } = req.client;
      if (jti && exp) {
        await tokensRepo.revoke(jti, new Date(exp * 1000));
      }
      return res.json({ success: true, message: 'Signed out.' });
    } catch (err) {
      console.error('[authController.logout]', err);
      return res.status(500).json({ success: false, error: 'Could not sign out cleanly, but you may safely close this session.' });
    }
  }

  return { requestOtp, verifyOtp, logout };
};
