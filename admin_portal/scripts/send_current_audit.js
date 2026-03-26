const { Resend } = require('resend');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);
const content = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/business_standalone_orders_audit.md', 'utf8');

async function send() {
  try {
    const data = await resend.emails.send({
      from: 'LOKMA Audit <noreply@lokma.shop>',
      to: ['metin.oez@gmail.com'],
      subject: '[Audit] Reservation Pre-Orders Real-Time Injection',
      html: `<h3>LOKMA Admin Portal - Reservations Injection Audit</h3><pre style="font-family: sans-serif; white-space: pre-wrap;">${content}</pre>`
    });
    console.log("Email sent successfully", data);
  } catch (err) {
    console.error("Error sending email", err);
  }
}
send();
