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
    const { kermesId, kermesTitle, message, targetRadiusKm = 1, kermesLat, kermesLng,
      vehiclePlate, vehicleColor, vehicleBrand, vehicleImageUrl,
      targetGroups = { favorites: false, staff: false, nearby: true } } = body;

    if (!kermesId || !message) {
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

    // Hedef kitle: kermes bildirimlerini acmis ve 1km icindeki kullanicilar
    let targetTokens = new Set<string>();
    const tokenToUserId = new Map<string, string>();
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('fcmToken', '!=', null).get();

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      const token = data.fcmToken || data.customerFcmToken;
      if (!token) return;

      // Kermes bildirimlerini kapatmis kullanicilari atla
      const prefs = data.notificationPreferences;
      if (prefs && prefs.kermesNotifications === false && prefs.promotions === false) return;

      let shouldSend = false;

      // Favoriler
      if (targetGroups.favorites) {
        if ((data.favoriteKermes || []).includes(kermesId) || (data.favorites || []).includes(kermesId)) shouldSend = true;
      }

      // Personel
      if (targetGroups.staff && staffUserIds.has(doc.id)) shouldSend = true;

      // Yakin cevredekiler (1km default) - TEST AMACLI BYPASS EDILDI (Mesafeden bagimsiz herkese gidecek)
      if (targetGroups.nearby) {
        shouldSend = true;
        console.log(`[PARKING-PUSH] User ${doc.id}: Sending! (Radius check is temporarily BYPASSED for testing)`);
      }

      if (shouldSend) { targetTokens.add(token); tokenToUserId.set(token, doc.id); }
    });

    const tokensArray = Array.from(targetTokens);
    console.log(`[PARKING-PUSH] Found ${tokensArray.length} target tokens from ${querySnapshot.size} total users`);
    if (tokensArray.length === 0) {
      // Hedef kitle bos - yine de basarili kabul et, kullaniciya bildir
      // Gecmis kaydi yaz
      const admin = require('firebase-admin');
      const now = admin.firestore.Timestamp.now();
      await db.collection('kermesEvents').doc(kermesId).collection('notificationHistory').add({
        type: 'acil_arac', title: `${kermesTitle} - Acil Arac Anonsu`, body: message,
        vehiclePlate: vehiclePlate || null, sentCount: 0, sentAt: now, note: 'Hedef kitlede kullanici bulunamadi',
      });
      return NextResponse.json({ success: true, sentCount: 0, failedCount: 0, warning: 'Yakin cevreda bildirim alabilecek kullanici bulunamadi. Anons gecmise kaydedildi.' });
    }

    // Acil Arac Anonsu baslik
    const title = `${kermesTitle} - Acil Arac Anonsu`;

    const fcmPayload: any = {
      notification: { title, body: message },
      data: {
        type: 'kermes_parking',
        kermesId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens: tokensArray,
    };

    // Resim varsa FCM'e ekle
    if (vehicleImageUrl) {
      fcmPayload.notification.imageUrl = vehicleImageUrl;
      fcmPayload.data.imageUrl = vehicleImageUrl;
    }

    let successCount = 0, failureCount = 0;
    for (let i = 0; i < tokensArray.length; i += 500) {
      const chunk = tokensArray.slice(i, i + 500);
      const resp = await messaging.sendEachForMulticast({ ...fcmPayload, tokens: chunk });
      successCount += resp.successCount; failureCount += resp.failureCount;
    }

    // Inbox kaydi - her kullanicinin notifications sub-collection'ina yaz
    const now = admin.firestore.Timestamp.now();
    const userIds = Array.from(new Set(tokenToUserId.values()));
    for (let i = 0; i < userIds.length; i += 500) {
      const batch = db.batch();
      for (const userId of userIds.slice(i, i + 500)) {
        const ref = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(ref, {
          type: 'kermes_parking',
          tag: 'acil_arac',
          title,
          body: message,
          kermesId,
          vehiclePlate: vehiclePlate || null,
          vehicleColor: vehicleColor || null,
          vehicleBrand: vehicleBrand || null,
          imageUrl: vehicleImageUrl || null,
          read: false,
          createdAt: now,
        });
      }
      await batch.commit();
    }

    // Gecmis kaydi
    await db.collection('kermesEvents').doc(kermesId).collection('notificationHistory').add({
      type: 'acil_arac',
      title,
      body: message,
      vehiclePlate: vehiclePlate || null,
      vehicleColor: vehicleColor || null,
      vehicleBrand: vehicleBrand || null,
      imageUrl: vehicleImageUrl || null,
      sentCount: successCount,
      sentAt: now,
    });

    return NextResponse.json({ success: true, sentCount: successCount, failedCount: failureCount });
  } catch (error) {
    console.error('Parking Announcement Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
