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

    const stats: Record<string, any> = {
        authDeleted: 0, usersDeleted: 0, adminsDeleted: 0,
        ordersDeleted: 0, ratingsDeleted: 0, commissionRecordsDeleted: 0,
        notificationsDeleted: 0, scheduledNotificationsDeleted: 0,
        sponsoredConversionsDeleted: 0, referralsDeleted: 0,
        groupOrdersDeleted: 0, reservationsDeleted: 0, businessesReset: 0,
        errors: [] as string[],
    };

    try {
        // 1. Collect Auth users to delete
        const toDelete: string[] = [];
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

        // 2. Delete notification sub-collections
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

        // 3. Delete Firestore user docs
        const uidSet = new Set(toDelete);
        const usersSnap = await adminDb.collection('users').limit(500).get();
        const usersBatch = adminDb.batch();
        usersSnap.docs.forEach(doc => {
            if (uidSet.has(doc.id)) { usersBatch.delete(doc.ref); stats.usersDeleted++; }
        });
        await usersBatch.commit();

        // 4. Delete non-super admins
        const adminsSnap = await adminDb.collection('admins').get();
        const adminsBatch = adminDb.batch();
        adminsSnap.docs.forEach(doc => {
            if (doc.id === callerUid) return;
            if (doc.data().adminType === 'super') return;
            adminsBatch.delete(doc.ref);
            stats.adminsDeleted++;
        });
        await adminsBatch.commit();

        // 5. Delete Firebase Auth users
        for (let i = 0; i < toDelete.length; i += 1000) {
            const chunk = toDelete.slice(i, i + 1000);
            const result = await adminAuth.deleteUsers(chunk);
            stats.authDeleted += result.successCount;
            result.errors.forEach(e => stats.errors.push(`auth/${chunk[e.index]}: ${e.error.message}`));
        }

        // 6-14. Delete all data collections
        stats.ordersDeleted               = await deleteCollection(adminDb, 'meat_orders');
        stats.ratingsDeleted              = await deleteCollection(adminDb, 'ratings');
        stats.commissionRecordsDeleted    = await deleteCollection(adminDb, 'commission_records');
        stats.scheduledNotificationsDeleted = await deleteCollection(adminDb, 'scheduled_notifications');
        stats.sponsoredConversionsDeleted = await deleteCollection(adminDb, 'sponsored_conversions');
        stats.referralsDeleted            = await deleteCollection(adminDb, 'referrals');
        stats.groupOrdersDeleted          = await deleteCollection(adminDb, 'group_orders');
        stats.reservationsDeleted         = await deleteCollection(adminDb, 'reservations');
        await deleteCollection(adminDb, 'courier_locations');
        await deleteCollection(adminDb, 'delivery_proofs');
        await deleteCollection(adminDb, 'carts');
        await deleteCollection(adminDb, 'kermes_carts');
        await deleteCollection(adminDb, 'promo_usages');
        await deleteCollection(adminDb, 'coupon_usages');
        await deleteCollection(adminDb, 'promotion_usages');

        // 15. Reset businesses
        const bizSnap = await adminDb.collection('businesses').limit(500).get();
        if (!bizSnap.empty) {
            const batch = adminDb.batch();
            bizSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    usage: {},
                    accountBalance: 0,
                    averageRating: FieldValue.delete(),
                    totalRatings: FieldValue.delete(),
                    ratingCount: FieldValue.delete(),
                });
            });
            await batch.commit();
            stats.businessesReset = bizSnap.size;
        }

        // 16. Clear FCM tokens from butcher_admins
        const baSnap = await adminDb.collection('butcher_admins').limit(500).get();
        if (!baSnap.empty) {
            const batch = adminDb.batch();
            baSnap.docs.forEach(doc => batch.update(doc.ref, { fcmTokens: [], webFcmTokens: [] }));
            await batch.commit();
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stats }, { status: 500 });
    }
}
