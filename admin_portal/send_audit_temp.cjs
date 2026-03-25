const { Resend } = require('resend');
const fs = require('fs');

const envFile = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/.env.local', 'utf8');
const match = envFile.match(/^RESEND_API_KEY=(.*)$/m);
if (!match) {
  console.error("No RESEND_API_KEY found.");
  process.exit(1);
}

const resend = new Resend(match[1].trim());
const report = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/c9ce5aac-b3cb-4ced-b975-3c8c44f84664/audit_report_25_march.md', 'utf8');

resend.emails.send({
  from: 'LOKMA System <info@lokma.shop>',
  to: 'metin.oez@gmail.com',
  subject: 'Günlük Audit Raporu - 25 Mart 2026',
  html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${report}</div>`
}).then(data => {
  console.log('Email sent:', data);
}).catch(err => {
  console.error('Email error:', err);
});
