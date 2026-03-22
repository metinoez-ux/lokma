import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialization — Firebase client SDK is only initialized on first use,
// NOT at module evaluation time. This prevents build failures when env vars
// are absent during Next.js static page data collection.
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp {
    if (!_app) {
        if (getApps().length === 0) {
            _app = initializeApp(firebaseConfig);
        } else {
            _app = getApps()[0];
        }
    }
    return _app;
}

// Getter functions that return REAL instances (not Proxies).
// Firestore collection() does internal type checks and rejects Proxy wrappers.
export function getDb(): Firestore {
    if (!_db) _db = getFirestore(getFirebaseApp());
    return _db;
}

export function getAuthInstance(): Auth {
    if (!_auth) _auth = getAuth(getFirebaseApp());
    return _auth;
}

export function getStorageInstance(): FirebaseStorage {
    if (!_storage) _storage = getStorage(getFirebaseApp());
    return _storage;
}

// Backward-compatible named exports.
// These use defineProperty so they are lazy — evaluated on first access,
// not at module load time. Safe for Next.js build.
const _exports = {} as { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage };

Object.defineProperty(_exports, 'app', { get: () => getFirebaseApp(), enumerable: true });
Object.defineProperty(_exports, 'auth', { get: () => getAuthInstance(), enumerable: true });
Object.defineProperty(_exports, 'db', { get: () => getDb(), enumerable: true });
Object.defineProperty(_exports, 'storage', { get: () => getStorageInstance(), enumerable: true });

export const app = _exports.app;
export const auth = _exports.auth;
export const db = _exports.db;
export const storage = _exports.storage;
