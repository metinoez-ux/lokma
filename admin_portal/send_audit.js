const fs = require('fs');
const content = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/audit_foodpaket_kategori_ve_erp_ui.md', 'utf8');

fetch('http://localhost:3000/api/email/audit-report', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        to: 'metin.oez@gmail.com',
        subject: 'LOKMA Audit Report: Foodpaket Kategori Düzeltmesi & ERP UI Modernizasyonu',
        content: content
    })
})
.then(res => res.json())
.then(data => console.log('Email sent:', data))
.catch(err => {
    // If the local server is not running or the route doesn't exist, we fallback to just console.log
    console.error('Failed to send email. Ensure server is running.', err.message);
});
