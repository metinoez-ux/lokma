const { Resend } = require('resend');
const fs = require('fs');
const execSync = require('child_process').execSync;

const resend = new Resend("re_5652Y16U_4vAQyzKHKbgEV2Y5dSsUXzyC");
const reportPath = '/Users/metinoz/.gemini/antigravity/brain/af4d00f1-3f95-4bc6-a492-a44644204217/LOKMA_2x_Audit_Report.md';
const report = fs.readFileSync(reportPath, 'utf8');

// Email sending
resend.emails.send({
  from: 'LOKMA System <info@lokma.shop>',
  to: 'metin.oez@gmail.com',
  subject: 'LOKMA 2x Comprehensive Audit Report - 26 Mart 2026',
  html: '<div style="font-family: sans-serif; white-space: pre-wrap;">' + report + '</div>'
}).then(data => {
  console.log('📬 Email sent successfully:', data);
}).catch(err => {
  console.error('Email error:', err);
});

// Copy to NAS
const nasTargetDir = '/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit';
try {
  execSync(`mkdir -p "${nasTargetDir}"`);
  execSync(`cp "${reportPath}" "${nasTargetDir}/"`);
  console.log('💾 Report successfully copied to Synology NAS.');
} catch (error) {
  console.error('NAS Copy Error:', error.message);
}
