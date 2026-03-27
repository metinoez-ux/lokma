const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
// Fix the dotenv path depending on where the script is executed
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const filePath = process.argv[2] || '';
const subject = process.argv[3] || 'LOKMA Audit Report';

if (!filePath) {
    console.error("Please provide a file path as the first argument.");
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

async function send() {
  try {
    const data = await resend.emails.send({
      from: 'LOKMA Audit <noreply@lokma.shop>',
      to: ['metin.oez@gmail.com'],
      subject: subject,
      html: `<h3>${subject}</h3><pre style="font-family: sans-serif; white-space: pre-wrap;">${content}</pre>`
    });
    console.log("Email sent successfully", data);
  } catch (err) {
    console.error("Error sending email", err);
  }
}
send();
