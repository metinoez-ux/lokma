import { sendEmailWithResend } from '../src/lib/resend-email';
import * as fs from 'fs';

async function send() {
  const content = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/a195302f-b389-46f1-beb4-c36d4e43e2e9/dashboard_refinement_audit.md', 'utf-8');
  const result = await sendEmailWithResend({
    to: 'metin.oez@gmail.com',
    subject: 'LOKMA Admin Portal: Dashboard Refinement Audit Raporu',
    html: `<pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre>`
  });
  console.log("Email sent result:", result);
}
send();
