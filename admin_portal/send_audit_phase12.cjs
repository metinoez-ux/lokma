const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/business_admin_i18n_final_audit.md', 'utf8');
    
    console.log("Sending email...");
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Audit: Phase 12 - Final Translation Completeness (Business Admin)',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
