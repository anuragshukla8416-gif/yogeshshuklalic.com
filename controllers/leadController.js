// ============================================================
// Lead Controller (factory) — records Request Quote / Brochure actions
// ============================================================
const { validateLeadPayload } = require('../validators');
const { notifyAdvisorOfNewLead } = require('../services/notificationService');

module.exports = function leadController({ leadsRepo }) {
  async function createLead(req, res) {
    try {
      const { contact, channel } = req.client; // set by clientAuth middleware

      const result = validateLeadPayload(req.body);
      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.error });
      }

      const lead = await leadsRepo.create({ contact, channel, ...result.data });

      // Fire-and-forget — never let a slow/failing email hold up the response
      notifyAdvisorOfNewLead(lead);

      return res.status(201).json({ success: true, lead });
    } catch (err) {
      console.error('[leadController.createLead]', err);
      return res.status(500).json({ success: false, error: 'Could not record this lead right now.' });
    }
  }

  async function myLeads(req, res) {
    try {
      const { contact, channel } = req.client;
      const leads = await leadsRepo.findByClient(contact, channel);
      return res.json({ success: true, leads });
    } catch (err) {
      console.error('[leadController.myLeads]', err);
      return res.status(500).json({ success: false, error: 'Could not fetch your enquiries right now.' });
    }
  }

  return { createLead, myLeads };
};
