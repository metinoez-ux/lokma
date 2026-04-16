const fs = require('fs');
const file = 'admin_portal/src/lib/firebase-admin.ts';
let content = fs.readFileSync(file, 'utf8');

// Also adding a check inside getFirebaseAdmin to throw errors instead of returning undefined db
content = content.replace(
  /export function getFirebaseAdmin\(\): \{ auth: Auth; db: Firestore; storage: Storage \} \{[\s\S]*?return \{ auth, db, storage \};\n\}/g,
  `export function getFirebaseAdmin(): { auth: Auth; db: Firestore; storage: Storage } {
 if (!db || !auth || !storage) {
 initializeFirebaseAdmin();
 }
 if (!db) {
   // This will cause a clear error instead of a collection read crash down the line
   throw new Error('Firebase Admin DB is NOT initialized! Please check SERVICE_ACCOUNT environment variable and JSON validity.');
 }
 return { auth, db, storage };
}`
);

fs.writeFileSync(file, content);
console.log('Fixed fix_firebase_admin.js');
