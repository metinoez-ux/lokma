const { Resend } = require('resend');
const fs = require('fs');
const resend = new Resend('re_5652Y16U_4vAQyzKHKbgEV2Y5dSsUXzyC');

const markdown = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/3a2cef24-76fe-4d30-98aa-e83b4c030e4d/audit_driver_assignments.md', 'utf-8');

let html = markdown
  .replace(/^# (.+)$/gm, '<h1 style="color:#FB335B;font-family:sans-serif">$1</h1>')
  .replace(/^## (.+)$/gm, '<h2 style="color:#333;font-family:sans-serif;border-bottom:2px solid #FB335B;padding-bottom:6px">$2</h2>')
  .replace(/^### (.+)$/gm, '<h3 style="font-family:sans-serif;color:#555">$1</h3>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:3px">$1</code>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/^---$/gm, '<hr style="border:1px solid #eee;margin:24px 0">')
  .replace(/\n\n/g, '<br><br>')
  .replace(/\n/g, '<br>');

html = '<div style="max-width:800px;margin:auto;padding:24px;font-family:sans-serif;line-height:1.6">' + html + '</div>';

(async () => {
  const { data, error } = await resend.emails.send({
    from: 'LOKMA Marketplace <noreply@lokma.shop>',
    to: 'metin.oez@gmail.com',
    subject: '🔍 LOKMA Sürücü (Driver) Atama Sistemi Audit Raporu — 2026-03-30',
    html,
    text: markdown,
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Email sent! ID:', data?.id);
  }
})();
