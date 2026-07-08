const test = require('node:test');
const assert = require('node:assert/strict');
const leadControllerFactory = require('../controllers/leadController');

// ---- Minimal fake repo + fake req/res, standing in for pg + Express ----
function makeFakeLeadsRepo() {
  const store = [];
  return {
    async create(fields) {
      const lead = { id: 'fake-' + (store.length + 1), created_at: new Date().toISOString(), status: 'New', ...fields };
      store.push(lead);
      return lead;
    },
    async findByClient(contact, channel) {
      return store.filter(l => l.contact === contact && l.channel === channel);
    },
    _store: store,
  };
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test('createLead rejects payloads missing required fields', async () => {
  const leadsRepo = makeFakeLeadsRepo();
  const controller = leadControllerFactory({ leadsRepo });
  const req = { client: { contact: '9339609665', channel: 'mobile' }, body: {} };
  const res = makeRes();

  await controller.createLead(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('createLead stores a valid lead and returns 201', async () => {
  const leadsRepo = makeFakeLeadsRepo();
  const controller = leadControllerFactory({ leadsRepo });
  const req = {
    client: { contact: '9339609665', channel: 'mobile' },
    body: {
      vertical: 'Life Insurance', category: 'Pure Protection', planNo: '954',
      planName: "LIC's New Tech-Term", investAmount: '1000000', tenure: '20',
      frequency: 'Monthly', actionType: 'Request Quote', note: 'Prefers evening calls',
    },
  };
  const res = makeRes();

  await controller.createLead(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.lead.planName, "LIC's New Tech-Term");
  assert.equal(res.body.lead.contact, '9339609665');
  assert.equal(leadsRepo._store.length, 1);
});

test('createLead rejects a category that does not belong to the given vertical', async () => {
  const leadsRepo = makeFakeLeadsRepo();
  const controller = leadControllerFactory({ leadsRepo });
  const req = {
    client: { contact: 'test@example.com', channel: 'email' },
    body: {
      vertical: 'Motor Insurance', category: 'Equity Funds', // mismatched on purpose
      planName: 'Comprehensive Policy', actionType: 'Official Brochure',
    },
  };
  const res = makeRes();

  await controller.createLead(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(leadsRepo._store.length, 0);
});

test('myLeads returns only the requesting client\'s own leads', async () => {
  const leadsRepo = makeFakeLeadsRepo();
  const controller = leadControllerFactory({ leadsRepo });

  await controller.createLead(
    { client: { contact: '9339609665', channel: 'mobile' },
      body: { vertical: 'Health Insurance', category: 'Family Floater', planName: 'Family Health Optima', actionType: 'Request Quote' } },
    makeRes()
  );
  await controller.createLead(
    { client: { contact: 'someone.else@example.com', channel: 'email' },
      body: { vertical: 'Health Insurance', category: 'Family Floater', planName: 'Family Health Optima', actionType: 'Request Quote' } },
    makeRes()
  );

  const req = { client: { contact: '9339609665', channel: 'mobile' } };
  const res = makeRes();
  await controller.myLeads(req, res);

  assert.equal(res.body.success, true);
  assert.equal(res.body.leads.length, 1);
  assert.equal(res.body.leads[0].contact, '9339609665');
});
