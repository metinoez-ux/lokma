const admin = require('firebase-admin');
console.log('firestore:', admin.firestore);
try {
  const x = admin.firestore();
  console.log('x:', x);
} catch(e) {
  console.log('error calling firestore():', e.message);
}
