const { Resend } = require('resend');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);
const content = fs.readFileSync('/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/duns_enrollment_audit_20260325_v2.md', 'utf8');

async function send() {
  try {
    const data = await resend.emails.send({
      from: 'LOKMA Audit <noreply@lokma.shop>',
      to: ['metin.oez@gmail.com'],
      subject: 'LOKMA Apple Developer DUNS/Enrollment Audit (25 Mart 2026)',
      html: `<h3>LOKMA Apple Developer DUNS/Enrollment Audit</h3><pre style="font-family: sans-serif; white-space: pre-wrap;">${content}</pre>`
    });
    console.log("Email sent successfully", data);
  } catch (err) {
    console.error("Error sending email", err);
  }
}
send();
