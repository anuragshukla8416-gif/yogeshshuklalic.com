const test = require('node:test');
const assert = require('node:assert/strict');
const { generateOtp, hashOtp, verifyOtpHash, sendOtp } = require('../services/otpService');

test('generateOtp produces a 6-digit numeric string', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateOtp();
    assert.equal(typeof code, 'string');
    assert.match(code, /^\d{6}$/);
    const n = Number(code);
    assert.ok(n >= 100000 && n <= 999999);
  }
});

test('hashOtp is deterministic and verifyOtpHash round-trips correctly', () => {
  const code = '482913';
  const hash = hashOtp(code);
  assert.equal(hashOtp(code), hash); // deterministic
  assert.equal(verifyOtpHash(code, hash), true);
  assert.equal(verifyOtpHash('000000', hash), false);
});

test('hashOtp never stores the plaintext code in the hash output', () => {
  const code = '123456';
  const hash = hashOtp(code);
  assert.equal(hash.includes(code), false);
  assert.equal(hash.length, 64); // sha256 hex digest length
});

test('sendOtp falls back to dev mode when no SMS/email gateway is configured', async () => {
  // In this test environment MSG91_AUTH_KEY / SMTP_HOST / SENDGRID_API_KEY are all unset,
  // so sendOtp must never attempt a real network call — it should just echo the code back.
  const result = await sendOtp('9339609665', 'mobile', '555555');
  assert.equal(result.devMode, true);
  assert.equal(result.code, '555555');
});

test('sendOtp rejects unsupported channels', async () => {
  await assert.rejects(() => sendOtp('someone', 'whatsapp', '123456'), /Unsupported channel/);
});
