// Firebase Admin SDK for server-side operations (push notifications, storage)
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let messaging: Messaging;
let db: Firestore;
let auth: Auth;
let storage: Storage;

function initializeFirebaseAdmin() {
    if (getApps().length === 0) {
        // Using service account from environment variable
        // Try ADMIN_SERVICE_ACCOUNT first (for Firebase Functions - FIREBASE_ prefix is reserved)
        // Fall back to FIREBASE_SERVICE_ACCOUNT_KEY for local development
        const serviceAccount = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccount) {
            throw new Error('ADMIN_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
        }

        try {
            const parsedServiceAccount = JSON.parse(serviceAccount);
            adminApp = initializeApp({
                credential: cert(parsedServiceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        } catch (error) {
            console.error('Failed to parse service account:', error);
            throw error;
        }
    } else {
        adminApp = getApps()[0];
    }

    messaging = getMessaging(adminApp);
    db = getFirestore(adminApp);
    auth = getAuth(adminApp);
    storage = getStorage(adminApp);
    return { adminApp, messaging, db, auth, storage };
}

export function getFirebaseMessaging(): Messaging {
    if (!messaging) {
        initializeFirebaseAdmin();
    }
    return messaging;
}

export function getFirebaseAdmin(): { auth: Auth; db: Firestore; storage: Storage } {
    if (!db || !auth || !storage) {
        initializeFirebaseAdmin();
    }
    return { auth, db, storage };
}

// Available notification topics
export const NOTIFICATION_TOPICS = {
    ALL_USERS: 'all_users',
    PRAYER_REMINDERS: 'prayer_reminders',
    KANDIL_NOTIFICATIONS: 'kandil_notifications',
    NEWS: 'news',
    PROMOTIONS: 'promotions',
} as const;

export type NotificationTopic = typeof NOTIFICATION_TOPICS[keyof typeof NOTIFICATION_TOPICS];
