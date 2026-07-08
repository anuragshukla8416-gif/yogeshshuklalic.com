// ============================================================
// Admin Controller (factory) — PIN login, ledger read/update/export/clear
// ============================================================
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const VALID_STATUSES = ['New', 'Contacted', 'Policy Issued'];

module.exports = function adminController({ leadsRepo, tokensRepo }) {
  async function login(req, res) {
    const { pin } = req.body;
    if (!pin || pin !== process.env.ADMIN_PIN) {
      return res.status(401).json({ success: false, error: 'Incorrect advisor PIN.' });
    }
    const jti = crypto.randomUUID();
    const token = jwt.sign({ role: 'admin', jti }, process.env.JWT_SECRET, { expiresIn: '12h' });
    return res.json({ success: true, token });
  }

  async function logout(req, res) {
    try {
      const { jti, exp } = req.admin;
      if (jti && exp) await tokensRepo.revoke(jti, new Date(exp * 1000));
      return res.json({ success: true, message: 'Admin session ended.' });
    } catch (err) {
      console.error('[adminController.logout]', err);
      return res.status(500).json({ success: false, error: 'Could not end the session cleanly.' });
    }
  }

  async function listLeads(req, res) {
    try {
      const rows = await leadsRepo.findAll();
      const stats = {
        total: rows.length,
        new: rows.filter(r => r.status === 'New').length,
        contacted: rows.filter(r => r.status === 'Contacted').length,
        policyIssued: rows.filter(r => r.status === 'Policy Issued').length,
      };
      return res.json({ success: true, leads: rows, stats });
    } catch (err) {
      console.error('[adminController.listLeads]', err);
      return res.status(500).json({ success: false, error: 'Could not load the ledger right now.' });
    }
  }

  async function updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      const lead = await leadsRepo.updateStatus(id, status);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found.' });
      return res.json({ success: true, lead });
    } catch (err) {
      console.error('[adminController.updateStatus]', err);
      return res.status(500).json({ success: false, error: 'Could not update this lead right now.' });
    }
  }

  async function clearLeads(req, res) {
    try {
      await leadsRepo.deleteAll();
      return res.json({ success: true, message: 'All lead records cleared.' });
    } catch (err) {
      console.error('[adminController.clearLeads]', err);
      return res.status(500).json({ success: false, error: 'Could not clear the ledger right now.' });
    }
  }

  async function exportCsv(req, res) {
    try {
      const rows = await leadsRepo.findAll();
      const headers = ['Timestamp','Contact','Channel','Vertical','Category','Plan No','Plan Name','Investment Amount','Tenure','Frequency','Action','Status'];
      const lines = rows.map(r => [
        new Date(r.created_at).toISOString(), r.client_contact, r.client_channel, r.vertical, r.category,
        r.plan_no || '', r.plan_name, r.invest_amount || '', r.tenure_years || '', r.frequency || '', r.action_type, r.status,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csv = [headers.join(','), ...lines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lic_lead_ledger.csv"');
      return res.send(csv);
    } catch (err) {
      console.error('[adminController.exportCsv]', err);
      return res.status(500).json({ success: false, error: 'Could not export the ledger right now.' });
    }
  }

  return { login, logout, listLeads, updateStatus, clearLeads, exportCsv };
};
