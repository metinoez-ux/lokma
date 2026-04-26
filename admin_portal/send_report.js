require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');
const fs = require('fs');

const key = process.env.RESEND_API_KEY || (fs.readFileSync('.env.local', 'utf8').match(/RESEND_API_KEY=(.+)/) || [])[1]?.replace(/["']/g, '');
if (!key) {
    console.error('No key found');
    process.exit(1);
}

const resend = new Resend(key);
const filePath = process.argv[2];
const subject = process.argv[3];
const content = fs.readFileSync(filePath, 'utf8');

resend.emails.send({
  from: 'LOKMA Audit System <onboarding@resend.dev>',
  to: 'metin.oez@gmail.com',
  subject: subject,
  text: content
}).then(console.log).catch(console.error);
