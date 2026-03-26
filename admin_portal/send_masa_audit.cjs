const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend("re_5652Y16U_4vAQyzKHKbgEV2Y5dSsUXzyC");
const report = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/lokma_masa_reservation_ux_completion_audit.md', 'utf8');

resend.emails.send({
  from: 'LOKMA System <info@lokma.shop>',
  to: 'metin.oez@gmail.com',
  subject: 'LOKMA Masa Reservation UX Restoration Audit - 26 Mart 2026',
  html: '<div style="font-family: sans-serif; white-space: pre-wrap;">' + report + '</div>'
}).then(data => {
  console.log('Email sent:', data);
}).catch(err => {
  console.error('Email error:', err);
});
