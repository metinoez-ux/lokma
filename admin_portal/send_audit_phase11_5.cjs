const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/audit_multi_tenancy_indexes.md', 'utf8');
    
    console.log("Sending email...");
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: '🚨 CRITICAL LOKMA Audit: Multi-Tenancy Index Verification (Failure Prevented)',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
