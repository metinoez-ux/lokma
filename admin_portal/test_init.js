require('dotenv').config({ path: '.env.local' });
console.log('ACCOUNT:', process.env.ADMIN_SERVICE_ACCOUNT ? 'EXISTS' : 'NO');
console.log('PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

const serviceAccount = process.env.ADMIN_SERVICE_ACCOUNT;
console.log('BEFORE:', serviceAccount.substring(0, 150));

try {
  let parsed = JSON.parse(serviceAccount);
  console.log('SUCCESS 1');
} catch (e1) {
  console.log('FAILED 1:', e1.message);
  try {
    const s2 = serviceAccount.replace(/\n/g, '\\n');
    let parsed2 = JSON.parse(s2);
    console.log('SUCCESS 2');
  } catch(e2) {
    console.log('FAILED 2:', e2.message);
  }
}
