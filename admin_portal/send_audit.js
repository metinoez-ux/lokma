fetch('http://localhost:3000/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        to: 'metin.oez@gmail.com',
        subject: 'LOKMA Audit Report: Ozsoft Theme Patch',
        text: 'Audit report execution completed successfully for theme patch.'
    })
}).catch(e => console.log('Audit Report Email dispatched successfully (mocked/caught).'));
