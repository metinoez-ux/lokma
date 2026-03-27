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

async function deleteCollectionGroup(db: Firestore, colName: string, batchSize = 400) {
    let deleted = 0;
    let hasMore = true;
    while (hasMore) {
        const snap = await db.collectionGroup(colName).limit(batchSize).get();
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
    'activity_logs', 'legal_reports', 'businesses', 'shifts'
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
    } catch (error: any) {
        console.error('Test Data Cleanup Auth Error:', error);
        return NextResponse.json({ error: 'Invalid token: ' + error.message }, { status: 401 });
    }

    // Parse selected categories from request body
    let selectedCategories: Set<string>;
    let businessDateFilter: string = 'all';
    try {
        const body = await req.json();
        const cats: string[] = body.categories || [];
        // Validate categories
        selectedCategories = new Set(cats.filter(c => VALID_CATEGORIES.has(c)));
        if (selectedCategories.size === 0) {
            return NextResponse.json({ error: 'Mindestens eine Kategorie muss ausgewählt werden' }, { status: 400 });
        }
        if (body.businessDateFilter) {
            businessDateFilter = body.businessDateFilter;
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
        activityLogsDeleted: 0, legalReportsDeleted: 0, businessesReset: 0, businessesDeleted: 0,
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

            // Delete order status notifications across all users to clear order history on mobile
            // Use in-memory filtering to avoid requiring a composite CollectionGroup index (9 FAILED_PRECONDITION)
            let hasMoreNotifs = true;
            let lastDoc: any = null;
            while (hasMoreNotifs) {
                let query = adminDb.collectionGroup('notifications').limit(500);
                if (lastDoc) query = query.startAfter(lastDoc);
                const snap = await query.get();
                
                if (snap.empty) { hasMoreNotifs = false; break; }
                lastDoc = snap.docs[snap.docs.length - 1];

                const batch = adminDb.batch();
                let batchCount = 0;
                snap.docs.forEach(d => {
                    if (d.data().type === 'order_status') {
                        batch.delete(d.ref);
                        batchCount++;
                    }
                });
                if (batchCount > 0) await batch.commit();
            }
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

            // Delete reservation status notifications across all users to clear reservation history on mobile
            // Use in-memory filtering to avoid requiring a composite CollectionGroup index (9 FAILED_PRECONDITION)
            let hasMoreNotifs = true;
            let lastDoc: any = null;
            while (hasMoreNotifs) {
                let query = adminDb.collectionGroup('notifications').limit(500);
                if (lastDoc) query = query.startAfter(lastDoc);
                const snap = await query.get();
                
                if (snap.empty) { hasMoreNotifs = false; break; }
                lastDoc = snap.docs[snap.docs.length - 1];

                const batch = adminDb.batch();
                let batchCount = 0;
                snap.docs.forEach(d => {
                    if (d.data().type === 'reservation_status') {
                        batch.delete(d.ref);
                        batchCount++;
                    }
                });
                if (batchCount > 0) await batch.commit();
            }
        }

        // ── Activity Logs category ──
        if (selectedCategories.has('activity_logs')) {
            stats.activityLogsDeleted = await deleteCollection(adminDb, 'activity_logs');
        }

        // ── Legal Reports category ──
        if (selectedCategories.has('legal_reports')) {
            stats.legalReportsDeleted = await deleteCollection(adminDb, 'legal_reports');
        }

        // ── Businesses category (date filtered) ──
        if (selectedCategories.has('businesses')) {
            let cutoffDate: Date | null = null;
            const now = new Date();
            if (businessDateFilter === 'today') {
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (businessDateFilter === 'yesterday') {
                const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                yesterday.setDate(yesterday.getDate() - 1);
                cutoffDate = yesterday;
            } else if (businessDateFilter === '7days') {
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (businessDateFilter === '30days') {
                cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            // cutoffDate === null means 'all'

            let bizQuery: any = adminDb.collection('businesses');
            if (cutoffDate) {
                bizQuery = bizQuery.where('createdAt', '>=', cutoffDate);
            }
            const bizSnap = await bizQuery.get();

            for (const bizDoc of bizSnap.docs) {
                try {
                    // Sub-collection: categories
                    const catsSnap = await bizDoc.ref.collection('categories').get();
                    if (!catsSnap.empty) {
                        const chunks = [];
                        for (let i = 0; i < catsSnap.docs.length; i += 400) {
                            chunks.push(catsSnap.docs.slice(i, i + 400));
                        }
                        for (const chunk of chunks) {
                            const batch = adminDb.batch();
                            chunk.forEach((d: any) => batch.delete(d.ref));
                            await batch.commit();
                        }
                    }
                    // Sub-collection: products
                    const prodsSnap = await bizDoc.ref.collection('products').get();
                    if (!prodsSnap.empty) {
                        const chunks = [];
                        for (let i = 0; i < prodsSnap.docs.length; i += 400) {
                            chunks.push(prodsSnap.docs.slice(i, i + 400));
                        }
                        for (const chunk of chunks) {
                            const batch = adminDb.batch();
                            chunk.forEach((d: any) => batch.delete(d.ref));
                            await batch.commit();
                        }
                    }
                    await bizDoc.ref.delete();
                    stats.businessesDeleted++;
                } catch (e: any) {
                    stats.errors.push(`biz/${bizDoc.id}: ${e.message}`);
                }
            }
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

        // ── Shifts (Business Hours) category ──
        if (selectedCategories.has('shifts')) {
            const bizSnap = await adminDb.collection('businesses').get();
            if (!bizSnap.empty) {
                const batch = adminDb.batch();
                bizSnap.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        pickupHours: FieldValue.delete(),
                        deliveryHours: FieldValue.delete(),
                    });
                });
                await batch.commit();
                stats.shiftsDeleted = bizSnap.size;
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stats }, { status: 500 });
    }
}
