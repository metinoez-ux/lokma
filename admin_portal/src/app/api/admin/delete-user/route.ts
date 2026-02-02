import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    let auth, db;

    // Step 1: Initialize Firebase Admin
    try {
        const admin = getFirebaseAdmin();
        auth = admin.auth;
        db = admin.db;
    } catch (initError) {
        console.error('Firebase Admin init error:', initError);
        return NextResponse.json({
            error: 'Firebase Admin initialization failed',
            details: initError instanceof Error ? initError.message : String(initError),
        }, { status: 500 });
    }

    try {
        const { userId, email, phoneNumber } = await request.json();

        if (!userId && !email && !phoneNumber) {
            return NextResponse.json({ error: 'userId, email veya phoneNumber gereklidir' }, { status: 400 });
        }

        let authUid: string | null = null;

        // Find user in Firebase Auth
        if (userId) {
            try {
                const userRecord = await auth.getUser(userId);
                authUid = userRecord.uid;
            } catch (e) {
                console.log('User not found by UID:', userId);
            }
        }

        if (!authUid && email) {
            try {
                const userRecord = await auth.getUserByEmail(email);
                authUid = userRecord.uid;
            } catch (e) {
                console.log('User not found by email:', email);
            }
        }

        if (!authUid && phoneNumber) {
            try {
                const userRecord = await auth.getUserByPhoneNumber(phoneNumber);
                authUid = userRecord.uid;
            } catch (e) {
                console.log('User not found by phone:', phoneNumber);
            }
        }

        const results = {
            authDeleted: false,
            firestoreUsersDeleted: false,
            firestoreAdminsDeleted: false,
            firestoreUserProfilesDeleted: false,
        };

        // Delete from Firebase Auth (if user exists there)
        if (authUid) {
            try {
                await auth.deleteUser(authUid);
                results.authDeleted = true;
                console.log('✅ Deleted from Firebase Auth:', authUid);
            } catch (e) {
                console.error('Failed to delete from Auth:', e);
            }
        } else {
            console.log('⚠️ User not found in Firebase Auth - will only delete from Firestore');
        }

        // CRITICAL FIX: Use userId directly for Firestore deletion
        // This handles orphan records (in Firestore but not in Firebase Auth)
        const docId = userId || authUid;

        // Delete from Firestore collections
        if (docId) {
            // Delete from users collection
            try {
                const userDoc = await db.collection('users').doc(docId).get();
                if (userDoc.exists) {
                    await db.collection('users').doc(docId).delete();
                    results.firestoreUsersDeleted = true;
                    console.log('✅ Deleted from users collection:', docId);
                } else {
                    console.log('User doc not found in Firestore:', docId);
                }
            } catch (e) {
                console.log('User doc deletion error:', e);
            }

            // Delete from admins collection
            try {
                const adminDoc = await db.collection('admins').doc(docId).get();
                if (adminDoc.exists) {
                    await db.collection('admins').doc(docId).delete();
                    results.firestoreAdminsDeleted = true;
                    console.log('✅ Deleted from admins collection:', docId);
                } else {
                    console.log('Admin doc not found in Firestore:', docId);
                }
            } catch (e) {
                console.log('Admin doc deletion error:', e);
            }

            // Delete from user_profiles collection
            try {
                const profileDoc = await db.collection('user_profiles').doc(docId).get();
                if (profileDoc.exists) {
                    await db.collection('user_profiles').doc(docId).delete();
                    results.firestoreUserProfilesDeleted = true;
                    console.log('✅ Deleted from user_profiles collection:', docId);
                } else {
                    console.log('User profile doc not found in Firestore:', docId);
                }
            } catch (e) {
                console.log('User profile doc deletion error:', e);
            }
        } else {
            console.log('❌ No docId available for Firestore deletion');
        }

        return NextResponse.json({
            success: true,
            message: 'Kullanıcı tüm sistemlerden silindi',
            results,
        });

    } catch (error) {
        console.error('Delete user error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: 'Kullanıcı silinemedi',
            details: errorMessage,
            envCheck: {
                hasAdminServiceAccount: !!process.env.ADMIN_SERVICE_ACCOUNT,
                hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
            }
        }, { status: 500 });
    }
}
