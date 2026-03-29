const { Resend } = require('resend');
const fs = require('fs');

const envFile = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/.env.local', 'utf8');
const match = envFile.match(/^RESEND_API_KEY=(.*)$/m);
if (!match) {
  console.error("No RESEND_API_KEY found.");
  process.exit(1);
}

const resend = new Resend(match[1].trim());
const reportPath = '/Users/metinoz/.gemini/antigravity/brain/3a2cef24-76fe-4d30-98aa-e83b4c030e4d/audit_report_kermes_sms.md';
const report = fs.readFileSync(reportPath, 'utf8');

resend.emails.send({
  from: 'LOKMA System <info@lokma.shop>',
  to: 'metin.oez@gmail.com',
  subject: 'LOKMA Kermes SMS & OTP Login Security Audit - 29 Mart 2026',
  html: '<div style="font-family: sans-serif; white-space: pre-wrap;">' + report + '</div>'
}).then(data => {
  console.log('Email sent:', data);
}).catch(err => {
  console.error('Email error:', err);
});
