const fs = require('fs');
const content = fs.readFileSync('src/app/[locale]/admin/plans/page.tsx', 'utf8');

const mfcStart = content.indexOf('{/* MAIN FEATURES CARD (Unified) */}');
const limitRules = content.indexOf('{/* Limits & Rules moved here */}');
const mfcEnd = content.indexOf('</div>', limitRules) + 10; // approximate
const kurier = content.indexOf('{/* KURIERLIEFERUNGEN (Kurye Siparişleri) */}');

console.log('MAIN FEATURES CARD start:', mfcStart);
console.log('Limits & Rules inside MFC:', limitRules > mfcStart && limitRules < kurier);
console.log('Kurierlieferungen start:', kurier);
console.log('Kurier is AFTER MFC end?', kurier > limitRules);
