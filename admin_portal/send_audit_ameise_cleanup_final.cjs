const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/audit_ameise_cleanup_final.md', 'utf8');
    
    console.log("Sending email...");
    const data = await resend.emails.send({
      from: 'LOKMA Audit <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Final Audit Report: Ameise Orders Cleanup & Precondition Fix',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
