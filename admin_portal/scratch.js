const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Wait, we might not have a serviceAccountKey.json in this directory. 
// We can use the default app if we are inside functions, or we can use foodpaket_data/test_parse.py? No, we can use firestore API via node if we initialize with default credentials.
