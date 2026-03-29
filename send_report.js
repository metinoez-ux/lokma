const fs = require('fs');

async function sendReport() {
    try {
        const reportPath = '/Users/metinoz/.gemini/antigravity/brain/99d91ac9-3c79-4643-9e8a-a51131b1a008/lokma_kermes_listing_audit_2026_03_29.md';
        const content = fs.readFileSync(reportPath, 'utf-8');
        
        const htmlContent = `
            <h2>LOKMA Kermes Comprehensive Audit & Fix Report</h2>
            <pre style="white-space: pre-wrap; font-family: sans-serif;">${content}</pre>
        `;

        const payload = {
            to: 'metin.oez@gmail.com',
            subject: 'LOKMA Kermes Listing Audit & Fix Report (29 March 2026)',
            html: htmlContent
        };

        const domains = ['https://admin.lokma.app', 'http://localhost:3000'];
        let success = false;
        
        for (const domain of domains) {
            console.log('Trying', domain + '/api/email/send...');
            try {
                const response = await fetch(domain + '/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Email API response:', data);
                    success = true;
                    break;
                }
            } catch (e) {
                console.log('Failed:', e.message);
            }
        }
        
        if (!success) {
            console.log("Both API URLs failed or servers are offline.");
        }
    } catch (err) {
        console.error('Error in sendReport:', err);
    }
}

sendReport();
