const { Resend } = require('resend');
const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');
const fs = require('fs');

async function send() {
  try {
    const reportPath = '/Users/metinoz/.gemini/antigravity/brain/af4d00f1-3f95-4bc6-a492-a44644204217/audit_reservation_critical_fixes.md';
    const content = fs.readFileSync(reportPath, 'utf8');
    
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Audit Report: Reservation Sync & Crash Fixes',
      text: content,
    });
    console.log('Email sent successfully:', data);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

send();
