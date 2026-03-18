const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/268d57ca-0172-4430-b17a-67e2cf8eb180/audit_report_endswith_crash.md', 'utf8');
    
    console.log("Sending email...");
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Audit Report: endsWith Crash Resolution & Dark Mode',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
