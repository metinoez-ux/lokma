import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const PROTECTED_EMAILS = new Set(['metin.oez@gmail.com']);

import { Firestore } from 'firebase-admin/firestore';

async function deleteCollection(db: Firestore, colName: string, batchSize = 400) {
    let deleted = 0;
    let hasMore = true;
    while (hasMore) {
        const snap = await db.collection(colName).limit(batchSize).get();
        if (snap.empty) { hasMore = false; break; }
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < batchSize) hasMore = false;
    }
    return deleted;
}

// Valid cleanup categories
const VALID_CATEGORIES = new Set([
    'auth', 'users', 'admins', 'orders', 'ratings',
    'finance', 'notifications', 'referrals', 'reservations',
    'activity_logs', 'legal_reports',
]);

export async function POST(req: NextRequest) {
    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();
    // Verify Bearer token
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let callerUid: string;
    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        callerUid = decoded.uid;

        const callerDoc = await adminDb.collection('admins').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.adminType !== 'super') {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse selected categories from request body
    let selectedCategories: Set<string>;
    try {
        const body = await req.json();
        const cats: string[] = body.categories || [];
        // Validate categories
        selectedCategories = new Set(cats.filter(c => VALID_CATEGORIES.has(c)));
        if (selectedCategories.size === 0) {
            return NextResponse.json({ error: 'Mindestens eine Kategorie muss ausgewählt werden' }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const stats: Record<string, any> = {
        authDeleted: 0, usersDeleted: 0, adminsDeleted: 0,
        ordersDeleted: 0, ratingsDeleted: 0, commissionRecordsDeleted: 0,
        notificationsDeleted: 0, scheduledNotificationsDeleted: 0,
        sponsoredConversionsDeleted: 0, referralsDeleted: 0,
        groupOrdersDeleted: 0, reservationsDeleted: 0,
        activityLogsDeleted: 0, legalReportsDeleted: 0, businessesReset: 0,
        errors: [] as string[],
        cleanedCategories: Array.from(selectedCategories),
    };

    try {
        // Collect Auth user UIDs (needed for auth, users, notifications)
        const needUserList = selectedCategories.has('auth') || selectedCategories.has('users');
        const toDelete: string[] = [];

        if (needUserList) {
            let pageToken: string | undefined;
            do {
                const result = await adminAuth.listUsers(1000, pageToken);
                for (const user of result.users) {
                    if (user.email && PROTECTED_EMAILS.has(user.email)) continue;
                    if (user.uid === callerUid) continue;
                    toDelete.push(user.uid);
                }
                pageToken = result.pageToken;
            } while (pageToken);
        }

        // ── Users category: Firestore user docs + notification sub-collections ──
        if (selectedCategories.has('users') && toDelete.length > 0) {
            // Delete notification sub-collections
            for (const uid of toDelete) {
                try {
                    const notifSnap = await adminDb.collection('users').doc(uid)
                        .collection('notifications').limit(500).get();
                    if (!notifSnap.empty) {
                        const batch = adminDb.batch();
                        notifSnap.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                        stats.notificationsDeleted += notifSnap.size;
                    }
                } catch (e: any) { stats.errors.push(`notif/${uid}: ${e.message}`); }
            }

            // Delete Firestore user docs
            const uidSet = new Set(toDelete);
            const usersSnap = await adminDb.collection('users').limit(500).get();
            const usersBatch = adminDb.batch();
            usersSnap.docs.forEach(doc => {
                if (uidSet.has(doc.id)) { usersBatch.delete(doc.ref); stats.usersDeleted++; }
            });
            await usersBatch.commit();
        }

        // ── Admins category ──
        if (selectedCategories.has('admins')) {
            const adminsSnap = await adminDb.collection('admins').get();
            const adminsBatch = adminDb.batch();
            adminsSnap.docs.forEach(doc => {
                if (doc.id === callerUid) return;
                if (doc.data().adminType === 'super') return;
                adminsBatch.delete(doc.ref);
                stats.adminsDeleted++;
            });
            await adminsBatch.commit();
        }

        // ── Auth category: Firebase Authentication ──
        if (selectedCategories.has('auth') && toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 1000) {
                const chunk = toDelete.slice(i, i + 1000);
                const result = await adminAuth.deleteUsers(chunk);
                stats.authDeleted += result.successCount;
                result.errors.forEach(e => stats.errors.push(`auth/${chunk[e.index]}: ${e.error.message}`));
            }
        }

        // ── Orders category ──
        if (selectedCategories.has('orders')) {
            stats.ordersDeleted = await deleteCollection(adminDb, 'meat_orders');
            stats.groupOrdersDeleted = await deleteCollection(adminDb, 'group_orders');
            await deleteCollection(adminDb, 'courier_locations');
            await deleteCollection(adminDb, 'delivery_proofs');
            await deleteCollection(adminDb, 'carts');
            await deleteCollection(adminDb, 'kermes_carts');
        }

        // ── Ratings category ──
        if (selectedCategories.has('ratings')) {
            stats.ratingsDeleted = await deleteCollection(adminDb, 'ratings');

            // Reset business rating stats
            const bizSnap = await adminDb.collection('businesses').limit(500).get();
            if (!bizSnap.empty) {
                const batch = adminDb.batch();
                bizSnap.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        averageRating: FieldValue.delete(),
                        totalRatings: FieldValue.delete(),
                        ratingCount: FieldValue.delete(),
                    });
                });
                await batch.commit();
                stats.businessesReset = bizSnap.size;
            }
        }

        // ── Finance category ──
        if (selectedCategories.has('finance')) {
            stats.commissionRecordsDeleted = await deleteCollection(adminDb, 'commission_records');
            stats.sponsoredConversionsDeleted = await deleteCollection(adminDb, 'sponsored_conversions');
            await deleteCollection(adminDb, 'promo_usages');
            await deleteCollection(adminDb, 'coupon_usages');
            await deleteCollection(adminDb, 'promotion_usages');

            // Reset business usage & balance
            const bizSnap = await adminDb.collection('businesses').limit(500).get();
            if (!bizSnap.empty) {
                const batch = adminDb.batch();
                bizSnap.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        usage: {},
                        accountBalance: 0,
                    });
                });
                await batch.commit();
            }
        }

        // ── Notifications category (scheduled) ──
        if (selectedCategories.has('notifications')) {
            stats.scheduledNotificationsDeleted = await deleteCollection(adminDb, 'scheduled_notifications');
        }

        // ── Referrals category ──
        if (selectedCategories.has('referrals')) {
            stats.referralsDeleted = await deleteCollection(adminDb, 'referrals');
        }

        // ── Reservations category ──
        if (selectedCategories.has('reservations')) {
            stats.reservationsDeleted = await deleteCollection(adminDb, 'reservations');
        }

        // ── Activity Logs category ──
        if (selectedCategories.has('activity_logs')) {
            stats.activityLogsDeleted = await deleteCollection(adminDb, 'activity_logs');
        }

        // ── Legal Reports category ──
        if (selectedCategories.has('legal_reports')) {
            stats.legalReportsDeleted = await deleteCollection(adminDb, 'legal_reports');
        }

        // ── Clean FCM tokens if auth or users selected ──
        if (selectedCategories.has('auth') || selectedCategories.has('users')) {
            const baSnap = await adminDb.collection('butcher_admins').limit(500).get();
            if (!baSnap.empty) {
                const batch = adminDb.batch();
                baSnap.docs.forEach(doc => batch.update(doc.ref, { fcmTokens: [], webFcmTokens: [] }));
                await batch.commit();
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stats }, { status: 500 });
    }
}
