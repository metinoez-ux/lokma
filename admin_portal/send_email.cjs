const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/f667eae5-1355-4aff-bb3c-5fd529cea2a6/audit_report_business_detail.md', 'utf8');
    
    console.log("Sending email...");
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Audit Report: Business Detail Render Crash Resolution',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
