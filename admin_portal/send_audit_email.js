const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);
const filePath = process.argv[2] || '/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/LOKMA_git_commit_audit_2026_03_27.md';
const content = fs.readFileSync(filePath, 'utf8');

let htmlContent = content.split('\n').map(line => {
  if (line.startsWith('# ')) return `<h1 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; padding-top: 10px;">${line.substring(2)}</h1>`;
  if (line.startsWith('## ')) return `<h2 style="color: #444; margin-top: 20px;">${line.substring(3)}</h2>`;
  if (line.startsWith('### ')) return `<h3 style="color: #555; margin-top: 15px;">${line.substring(4)}</h3>`;
  if (line.trim().startsWith('- ')) return `<li style="margin-left: 20px; line-height: 1.6; margin-bottom: 5px;">${line.substring(line.indexOf('- ') + 2)}</li>`;
  return line ? `<p style="line-height: 1.6; margin: 0 0 10px 0; color: #222;">${line}</p>` : '<br>';
}).join('');

htmlContent = htmlContent
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.*?)`/g, '<code style="background-color: #f4f4f4; border: 1px solid #ddd; padding: 2px 4px; border-radius: 4px; font-family: monospace; color: #d63384;">$1</code>');

const finalHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333; background: #fff; padding: 20px;">
  ${htmlContent}
</div>
`;

async function send() {
  try {
    const data = await resend.emails.send({
      from: 'LOKMA Audit <noreply@lokma.shop>',
      to: ['metin.oez@gmail.com'],
      subject: 'LOKMA Git Commit Audit Raporu',
      html: finalHtml
    });
    console.log("Email sent successfully", data);
  } catch (err) {
    console.error("Error sending email", err);
  }
}
send();
