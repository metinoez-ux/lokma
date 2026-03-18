const admin = require('firebase-admin');
const fs = require('fs');

try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const serviceAccountLine = envFile.split('\n').find(line => line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
  
  if (!serviceAccountLine) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
  }
  
  // Extract JSON string and parse
  const jsonStr = serviceAccountLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim().replace(/^'|'$/g, "");
  const serviceAccount = JSON.parse(jsonStr);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

async function checkUsersDeep() {
    try {
        console.log('Fetching users collection...');
        const snapshot = await admin.firestore().collection('users').get();
        console.log(`Found ${snapshot.size} users.`);

        let errorCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            let hasError = false;
            let issues = [];

            if (data.adminProfile) {
                if (data.adminProfile.butcherName && typeof data.adminProfile.butcherName === 'object') {
                    hasError = true;
                    issues.push(`adminProfile.butcherName is an object`);
                }
                if (data.adminProfile.assignedBusinessNames && Array.isArray(data.adminProfile.assignedBusinessNames)) {
                    data.adminProfile.assignedBusinessNames.forEach((n, i) => {
                        if (typeof n === 'object') {
                            hasError = true;
                            issues.push(`adminProfile.assignedBusinessNames[${i}] is an object`);
                        }
                    });
                }
                if (data.adminProfile.roles && Array.isArray(data.adminProfile.roles)) {
                    data.adminProfile.roles.forEach((r, i) => {
                        if (r && typeof r === 'object') {
                            if (r.businessName && typeof r.businessName === 'object') {
                                hasError = true;
                                issues.push(`adminProfile.roles[${i}].businessName is an object`);
                            }
                            if (r.type && typeof r.type === 'object') {
                                hasError = true;
                                issues.push(`adminProfile.roles[${i}].type is an object`);
                            }
                        }
                    });
                }
            }
            
            if (data.roles && Array.isArray(data.roles)) {
                 data.roles.forEach((r, i) => {
                        if (r && typeof r === 'object') {
                            if (r.businessName && typeof r.businessName === 'object') {
                                hasError = true;
                                issues.push(`roles[${i}].businessName is an object`);
                            }
                            if (r.type && typeof r.type === 'object') {
                                hasError = true;
                                issues.push(`roles[${i}].type is an object`);
                            }
                        }
                 });
            }

            if (hasError) {
                errorCount++;
                console.log(`\n--- Issue found in user: ${doc.id} (${data.email || 'no-email'}) ---`);
                issues.forEach(issue => console.log(`  - ${issue}`));
            }
        });

        console.log(`\nCheck complete. Found issues in ${errorCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Error during deep check:', error);
        process.exit(1);
    }
}

checkUsersDeep();
