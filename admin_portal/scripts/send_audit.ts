import { sendEmailWithResend } from '../src/lib/resend-email';
import * as fs from 'fs';

async function send() {
  const content = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/3ce0980a-b152-46bf-8b57-1f5444872bb9/landing_page_audit_20260319.md', 'utf-8');
  const result = await sendEmailWithResend({
    to: 'metin.oez@gmail.com',
    subject: 'LOKMA Landing Page Audit Raporu',
    html: `<pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre>`
  });
  console.log("Email sent result:", result);
}
send();
