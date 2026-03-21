
import { sendEmailWithResend } from '../src/lib/resend-email';
import * as fs from 'fs';

async function send() {
  const content = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/01a9e118-81bb-4ce3-a363-03b07585dad3/audit_ameise_group_orders.md', 'utf-8');
  const result = await sendEmailWithResend({
    to: 'metin.oez@gmail.com',
    subject: 'LOKMA Admin Portal: Ameise & Group Orders Audit Raporu',
    html: `<pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre>`
  });
  console.log("Email sent result:", result);
}
send();
