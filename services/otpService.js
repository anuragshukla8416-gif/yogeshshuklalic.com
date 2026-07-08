// ============================================================
// OTP Service — generation, hashing, and REAL delivery
// ------------------------------------------------------------
// Delivery priority:
//   SMS:   MSG91 (if MSG91_AUTH_KEY is set)         -> falls back to dev mode
//   Email: SMTP via nodemailer (if SMTP_HOST is set) -> else SendGrid REST
//          (if SENDGRID_API_KEY is set)              -> else dev mode
//
// "Dev mode" means: no gateway is configured, so the code is
// logged to the console and returned to the caller so the API
// can hand it back to the frontend for demo/testing purposes.
// This mirrors the previous no-backend simulation exactly.
// ============================================================
const crypto = require('crypto');

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}
function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}
function verifyOtpHash(code, hash) {
  return hashOtp(code) === hash;
}

const isSmsConfigured = !!process.env.MSG91_AUTH_KEY;
const isSmtpConfigured = !!process.env.SMTP_HOST;
const isSendgridConfigured = !!process.env.SENDGRID_API_KEY;

let smtpTransportPromise = null;
function getSmtpTransport() {
  if (!smtpTransportPromise) {
    smtpTransportPromise = (async () => {
      const nodemailer = require('nodemailer');
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    })();
  }
  return smtpTransportPromise;
}

async function sendSmsViaMsg91(contact, code) {
  const resp = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile: contact.startsWith('91') ? contact : `91${contact}`,
      otp: code,
      template_id: process.env.MSG91_TEMPLATE_ID,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`MSG91 request failed (${resp.status}): ${body}`);
  }
}

async function sendEmailViaSmtp(contact, code) {
  const transport = await getSmtpTransport();
  await transport.sendMail({
    from: process.env.SENDER_EMAIL || process.env.SMTP_USER,
    to: contact,
    subject: 'Your Yogesh Shukla Advisory OTP',
    text: `Your one-time password is ${code}. It expires in 5 minutes. If you did not request this, please ignore this email.`,
    html: `<p>Your one-time password is <b style="font-size:20px;letter-spacing:3px;">${code}</b>.</p><p>It expires in 5 minutes. If you did not request this, please ignore this email.</p>`,
  });
}

async function sendEmailViaSendgrid(contact, code) {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: contact }] }],
      from: { email: process.env.SENDER_EMAIL || 'noreply@yogeshshuklaadvisory.com' },
      subject: 'Your Yogesh Shukla Advisory OTP',
      content: [{ type: 'text/plain', value: `Your one-time password is ${code}. It expires in 5 minutes.` }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`SendGrid request failed (${resp.status}): ${body}`);
  }
}

/**
 * Sends the OTP to the given contact over the given channel.
 * Returns { devMode: boolean, code?: string }.
 */
async function sendOtp(contact, channel, code) {
  if (channel === 'mobile') {
    if (isSmsConfigured) {
      await sendSmsViaMsg91(contact, code);
      console.log(`[otpService] SMS OTP sent to ${contact} via MSG91`);
      return { devMode: false };
    }
    console.warn(`[otpService] DEV MODE (no MSG91_AUTH_KEY) — OTP for ${contact} is ${code}`);
    return { devMode: true, code };
  }

  if (channel === 'email') {
    if (isSmtpConfigured) {
      await sendEmailViaSmtp(contact, code);
      console.log(`[otpService] Email OTP sent to ${contact} via SMTP`);
      return { devMode: false };
    }
    if (isSendgridConfigured) {
      await sendEmailViaSendgrid(contact, code);
      console.log(`[otpService] Email OTP sent to ${contact} via SendGrid`);
      return { devMode: false };
    }
    console.warn(`[otpService] DEV MODE (no SMTP_HOST/SENDGRID_API_KEY) — OTP for ${contact} is ${code}`);
    return { devMode: true, code };
  }

  throw new Error('Unsupported channel: ' + channel);
}

module.exports = {
  generateOtp, hashOtp, verifyOtpHash, sendOtp,
  isSmsConfigured, isSmtpConfigured, isSendgridConfigured,
};
