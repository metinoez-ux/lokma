import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseMessaging, getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = "force-dynamic";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kermesId, kermesTitle, title, body: notifBody, targetRadiusKm = 5, kermesLat, kermesLng,
      targetGroups = { favorites: true, staff: true, nearby: true } } = body;

    if (!kermesId || !title || !notifBody) {
      return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const messaging = getFirebaseMessaging();
    const admin = require('firebase-admin');

    // Staff listesi
    let staffUserIds = new Set<string>();
    if (targetGroups.staff) {
      try {
        const staffSnap = await db.collection('kermesEvents').doc(kermesId).collection('staff').get();
        staffSnap.forEach((doc: any) => { const uid = doc.data().userId || doc.id; if (uid) staffUserIds.add(uid); });
      } catch (e) { console.warn('Staff read warning:', e); }
    }

    // Hedef kitle
    let targetTokens = new Set<string>();
    const tokenToUserId = new Map<string, string>();
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('fcmToken', '!=', null).get();

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      const token = data.fcmToken || data.customerFcmToken;
      if (!token) return;

      const prefs = data.notificationPreferences;
      if (prefs && prefs.kermesNotifications === false && prefs.promotions === false) return;

      let shouldSend = false;
      if (targetGroups.favorites) {
        if ((data.favoriteKermes || []).includes(kermesId) || (data.favorites || []).includes(kermesId)) shouldSend = true;
      }
      if (targetGroups.staff && staffUserIds.has(doc.id)) shouldSend = true;
      if (targetGroups.nearby && kermesLat && kermesLng && data.lastKnownLocation?.latitude) {
        const dist = calculateDistance(data.lastKnownLocation.latitude, data.lastKnownLocation.longitude, kermesLat, kermesLng);
        if (dist <= targetRadiusKm) shouldSend = true;
      }

      if (shouldSend) { targetTokens.add(token); tokenToUserId.set(token, doc.id); }
    });

    const tokensArray = Array.from(targetTokens);
    if (tokensArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Hedef kitlede FCM token bulunamadi.' }, { status: 404 });
    }

    const fullTitle = `${kermesTitle} - ${title}`;

    const fcmMessage = {
      notification: { title: fullTitle, body: notifBody },
      data: { type: 'kermes_announcement', kermesId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      tokens: tokensArray,
    };

    let successCount = 0, failureCount = 0;
    for (let i = 0; i < tokensArray.length; i += 500) {
      const chunk = tokensArray.slice(i, i + 500);
      const resp = await messaging.sendEachForMulticast({ ...fcmMessage, tokens: chunk });
      successCount += resp.successCount; failureCount += resp.failureCount;
    }

    // Inbox kaydi
    const now = admin.firestore.Timestamp.now();
    const userIds = Array.from(new Set(tokenToUserId.values()));
    for (let i = 0; i < userIds.length; i += 500) {
      const batch = db.batch();
      for (const userId of userIds.slice(i, i + 500)) {
        const ref = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(ref, { type: 'kermes_announcement', tag: 'duyuru', title: fullTitle, body: notifBody, kermesId, read: false, createdAt: now });
      }
      await batch.commit();
    }

    // Gecmis kaydi
    await db.collection('kermesEvents').doc(kermesId).collection('notificationHistory').add({
      type: 'manual', title: fullTitle, body: notifBody, sentCount: successCount, sentAt: now,
    });

    return NextResponse.json({ success: true, sentCount: successCount, failedCount: failureCount });
  } catch (error) {
    console.error('Manual Notification Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
