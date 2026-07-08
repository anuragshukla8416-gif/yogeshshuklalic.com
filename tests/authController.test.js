// NOTE: These tests require `npm install` to have been run (they need the
// real `jsonwebtoken` package). They could not be executed inside the
// sandbox that generated this project since it has no network access to
// install dependencies — but they are syntactically valid and will run
// under `npm test` once dependencies are installed.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';

const test = require('node:test');
const assert = require('node:assert/strict');
const authControllerFactory = require('../controllers/authController');

function makeFakeOtpRepo(seed = {}) {
  let record = seed.record || null;
  return {
    async findMostRecent() { return record; },
    async findLatestUnverified() { return record && !record.verified ? record : null; },
    async create(contact, channel, otpHash, expiresAt) {
      record = { id: 1, contact, channel, otp_hash: otpHash, expires_at: expiresAt, attempts: 0, verified: false, created_at: new Date(0) };
      return record;
    },
    async incrementAttempts(id) { if (record) record.attempts += 1; },
    async markVerified(id) { if (record) record.verified = true; },
    _getRecord: () => record,
  };
}
function makeFakeClientsRepo() {
  const clients = [];
  return { async upsert(contact, channel) { clients.push({ contact, channel }); return { contact, channel }; }, _clients: clients };
}
function makeFakeTokensRepo() {
  const revoked = new Set();
  return {
    async revoke(jti) { revoked.add(jti); },
    async isRevoked(jti) { return revoked.has(jti); },
    _revoked: revoked,
  };
}
function makeRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test('requestOtp rejects an invalid mobile number', async () => {
  const otpRepo = makeFakeOtpRepo();
  const controller = authControllerFactory({ otpRepo, clientsRepo: makeFakeClientsRepo(), tokensRepo: makeFakeTokensRepo() });
  const req = { body: { contact: '123', channel: 'mobile' } };
  const res = makeRes();
  await controller.requestOtp(req, res);
  assert.equal(res.statusCode, 400);
});

test('requestOtp succeeds and returns devMode code when no gateway configured', async () => {
  const otpRepo = makeFakeOtpRepo();
  const controller = authControllerFactory({ otpRepo, clientsRepo: makeFakeClientsRepo(), tokensRepo: makeFakeTokensRepo() });
  const req = { body: { contact: '9339609665', channel: 'mobile' } };
  const res = makeRes();
  await controller.requestOtp(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.devMode, true);
  assert.match(res.body.devCode, /^\d{6}$/);
});

test('verifyOtp rejects an incorrect code and increments attempts', async () => {
  const otpRepo = makeFakeOtpRepo();
  const clientsRepo = makeFakeClientsRepo();
  const controller = authControllerFactory({ otpRepo, clientsRepo, tokensRepo: makeFakeTokensRepo() });

  await controller.requestOtp({ body: { contact: '9339609665', channel: 'mobile' } }, makeRes());
  const res = makeRes();
  await controller.verifyOtp({ body: { contact: '9339609665', channel: 'mobile', code: '000000' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(otpRepo._getRecord().attempts, 1);
});

test('verifyOtp issues a JWT on the correct code', async () => {
  const otpRepo = makeFakeOtpRepo();
  const clientsRepo = makeFakeClientsRepo();
  const controller = authControllerFactory({ otpRepo, clientsRepo, tokensRepo: makeFakeTokensRepo() });

  const sendRes = makeRes();
  await controller.requestOtp({ body: { contact: '9339609665', channel: 'mobile' } }, sendRes);
  const code = sendRes.body.devCode;

  const verifyRes = makeRes();
  await controller.verifyOtp({ body: { contact: '9339609665', channel: 'mobile', code } }, verifyRes);

  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.body.success, true);
  assert.ok(verifyRes.body.token);
  assert.equal(clientsRepo._clients.length, 1);
});

test('logout revokes the token\'s jti', async () => {
  const tokensRepo = makeFakeTokensRepo();
  const controller = authControllerFactory({ otpRepo: makeFakeOtpRepo(), clientsRepo: makeFakeClientsRepo(), tokensRepo });
  const req = { client: { jti: 'abc-123', exp: Math.floor(Date.now() / 1000) + 3600 } };
  const res = makeRes();
  await controller.logout(req, res);
  assert.equal(res.body.success, true);
  assert.equal(tokensRepo._revoked.has('abc-123'), true);
});
