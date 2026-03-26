const fs = require('fs');
async function send() {
  const content = fs.readFileSync('/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/business_standalone_orders_audit.md', 'utf8');
  try {
    const res = await fetch('http://localhost:3000/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'metin.oez@gmail.com',
        subject: '[Audit] Reservation Pre-Orders Refactor',
        html: `<h3>LOKMA Admin Portal Audit</h3><pre style="font-family: sans-serif; white-space: pre-wrap;">${content}</pre>`
      })
    });
    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}
send();
