// ============================================================
// Notification Service — alerts Mr. Shukla when a new lead lands
// ------------------------------------------------------------
// Uses the same SMTP/SendGrid configuration as otpService.
// If neither is configured, this quietly no-ops (logs only) —
// it never blocks or fails lead creation.
// ============================================================
const { isSmtpConfigured, isSendgridConfigured } = require('./otpService');

const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL || 'yogeshshuklalic@yahoo.com';

async function sendViaSmtp(subject, text, html) {
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SENDER_EMAIL || process.env.SMTP_USER, to: ADVISOR_EMAIL, subject, text, html });
}

async function sendViaSendgrid(subject, text) {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: ADVISOR_EMAIL }] }],
      from: { email: process.env.SENDER_EMAIL || 'noreply@yogeshshuklaadvisory.com' },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  });
  if (!resp.ok) throw new Error(`SendGrid notify failed (${resp.status})`);
}

/**
 * Fire-and-forget notification. Callers should NOT await this on the
 * critical path of lead creation — call it and let it resolve in the background,
 * wrapped so any failure is logged, never thrown back at the user.
 */
async function notifyAdvisorOfNewLead(lead) {
  const subject = `New Lead: ${lead.vertical} — ${lead.plan_name}`;
  const text = [
    `A new lead has come in from the advisory site.`,
    ``,
    `Vertical:    ${lead.vertical}`,
    `Category:    ${lead.category}`,
    `Plan:        ${lead.plan_name}${lead.plan_no ? ' (No. ' + lead.plan_no + ')' : ''}`,
    `Action:      ${lead.action_type}`,
    `Contact:     ${lead.client_contact} (${lead.client_channel})`,
    `Investment:  ₹${lead.invest_amount || '—'} · ${lead.tenure_years || '—'} yrs · ${lead.frequency || '—'}`,
    `Note:        ${lead.note || '—'}`,
    `Time:        ${new Date(lead.created_at).toLocaleString('en-IN')}`,
    ``,
    `Open the Admin Workspace on the site to follow up.`,
  ].join('\n');

  try {
    if (isSmtpConfigured) {
      await sendViaSmtp(subject, text, `<pre style="font-family:monospace;">${text.replace(/</g, '&lt;')}</pre>`);
    } else if (isSendgridConfigured) {
      await sendViaSendgrid(subject, text);
    } else {
      console.log(`[notificationService] DEV MODE — no email transport configured. Would have notified ${ADVISOR_EMAIL}:\n${text}`);
    }
  } catch (err) {
    console.error('[notificationService] Failed to notify advisor of new lead:', err.message);
  }
}

module.exports = { notifyAdvisorOfNewLead };
