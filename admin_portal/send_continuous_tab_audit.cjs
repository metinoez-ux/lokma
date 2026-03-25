const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend('re_Fj6keGwM_5Cx6q55RAMkhiWpUNh7ZxeAQ');

async function sendEmail() {
  try {
    const reportText = fs.readFileSync('/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/lokma_continuous_tab_architecture_audit_2026_03_25.md', 'utf8');
    
    console.log("Sending Continuous Tab audit email...");
    const data = await resend.emails.send({
      from: 'LOKMA Architecture Report <onboarding@resend.dev>',
      to: 'metin.oez@gmail.com',
      subject: 'LOKMA Audit: Continuous Tab & Pre-Payment Architecture',
      text: reportText,
    });
    console.log("Email sent successfully:", data);
  } catch(e) {
    console.error("Error sending email:", e);
  }
}

sendEmail();
