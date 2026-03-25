const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/daily_audit_report_20260324.md', 'utf8');
    
    console.log("Sending daily audit email...");
    const data = await resend.emails.send({
      from: 'LOKMA Daily Report <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Daily Audit: Comprehensive 24h Activity Report',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
