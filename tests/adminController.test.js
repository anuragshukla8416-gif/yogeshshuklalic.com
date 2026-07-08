// NOTE: requires `npm install` (jsonwebtoken) — see authController.test.js for details.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.ADMIN_PIN = process.env.ADMIN_PIN || '719900';

const test = require('node:test');
const assert = require('node:assert/strict');
const adminControllerFactory = require('../controllers/adminController');

function makeFakeLeadsRepo(seed = []) {
  let store = [...seed];
  return {
    async findAll() { return store; },
    async updateStatus(id, status) {
      const lead = store.find(l => l.id === id);
      if (!lead) return null;
      lead.status = status;
      return lead;
    },
    async deleteAll() { store = []; },
    _store: () => store,
  };
}
function makeFakeTokensRepo() {
  const revoked = new Set();
  return { async revoke(jti) { revoked.add(jti); }, async isRevoked(jti) { return revoked.has(jti); }, _revoked: revoked };
}
function makeRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.setHeader = () => {};
  return res;
}

test('login rejects an incorrect PIN', async () => {
  const controller = adminControllerFactory({ leadsRepo: makeFakeLeadsRepo(), tokensRepo: makeFakeTokensRepo() });
  const res = makeRes();
  await controller.login({ body: { pin: '000000' } }, res);
  assert.equal(res.statusCode, 401);
});

test('login issues a token for the correct PIN', async () => {
  const controller = adminControllerFactory({ leadsRepo: makeFakeLeadsRepo(), tokensRepo: makeFakeTokensRepo() });
  const res = makeRes();
  await controller.login({ body: { pin: '719900' } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.token);
});

test('listLeads returns stats alongside the ledger', async () => {
  const leadsRepo = makeFakeLeadsRepo([
    { id: '1', status: 'New' }, { id: '2', status: 'Contacted' }, { id: '3', status: 'Policy Issued' }, { id: '4', status: 'New' },
  ]);
  const controller = adminControllerFactory({ leadsRepo, tokensRepo: makeFakeTokensRepo() });
  const res = makeRes();
  await controller.listLeads({}, res);
  assert.equal(res.body.stats.total, 4);
  assert.equal(res.body.stats.new, 2);
  assert.equal(res.body.stats.contacted, 1);
  assert.equal(res.body.stats.policyIssued, 1);
});

test('updateStatus rejects an invalid status value', async () => {
  const leadsRepo = makeFakeLeadsRepo([{ id: '1', status: 'New' }]);
  const controller = adminControllerFactory({ leadsRepo, tokensRepo: makeFakeTokensRepo() });
  const res = makeRes();
  await controller.updateStatus({ params: { id: '1' }, body: { status: 'Closed Won' } }, res);
  assert.equal(res.statusCode, 400);
});

test('updateStatus updates a lead\'s lifecycle status', async () => {
  const leadsRepo = makeFakeLeadsRepo([{ id: '1', status: 'New' }]);
  const controller = adminControllerFactory({ leadsRepo, tokensRepo: makeFakeTokensRepo() });
  const res = makeRes();
  await controller.updateStatus({ params: { id: '1' }, body: { status: 'Policy Issued' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.lead.status, 'Policy Issued');
});

test('clearLeads empties the ledger', async () => {
  const leadsRepo = makeFakeLeadsRepo([{ id: '1', status: 'New' }]);
  const controller = adminControllerFactory({ leadsRepo, tokensRepo: makeFakeTokensRepo() });
  await controller.clearLeads({}, makeRes());
  assert.equal(leadsRepo._store().length, 0);
});

test('logout revokes the admin token\'s jti', async () => {
  const tokensRepo = makeFakeTokensRepo();
  const controller = adminControllerFactory({ leadsRepo: makeFakeLeadsRepo(), tokensRepo });
  const req = { admin: { jti: 'admin-jti-1', exp: Math.floor(Date.now() / 1000) + 3600 } };
  const res = makeRes();
  await controller.logout(req, res);
  assert.equal(res.body.success, true);
  assert.equal(tokensRepo._revoked.has('admin-jti-1'), true);
});
