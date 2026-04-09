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
    const { 
      kermesId, 
      kermesTitle, 
      discountedItems, 
      targetRadiusKm = 2, 
      kermesLat, 
      kermesLng,
      targetGroups = { favorites: true, staff: true, nearby: true },
    } = body;

    if (!kermesId || !discountedItems || discountedItems.length === 0) {
      return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const messaging = getFirebaseMessaging();

    // 0. Kermes personel/admin listesini al (staff checkbox icin)
    let staffUserIds = new Set<string>();
    if (targetGroups.staff) {
      try {
        const staffSnap = await db.collection('kermesEvents').doc(kermesId).collection('staff').get();
        staffSnap.forEach(doc => {
          const data = doc.data();
          const uid = data.userId || doc.id;
          if (uid) staffUserIds.add(uid);
        });
      } catch (e) {
        console.warn('Staff collection read warning:', e);
      }
    }

    let targetTokens = new Set<string>();
    let targetUserIds = new Set<string>();

    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('fcmToken', '!=', null).get();
    
    querySnapshot.forEach(doc => {
      const data = doc.data();

      // ZORUNLU: Kullanicinin kermes bildirimlerini acmis olmasi gerekiyor
      const prefs = data.notificationPreferences;
      if (prefs) {
        // Eger acikca kapatmissa -> atla
        if (prefs.kermesNotifications === false && prefs.promotions === false && prefs.marketing === false) {
          return;
        }
      } else {
        // Eski model: eger acikca kapattiysa atla
        if (data.notifyOrderPush === false) {
          return;
        }
      }

      let shouldSend = false;

      // Grup 1: Kermes Favorileri
      if (targetGroups.favorites) {
        if (data.favoriteKermes && Array.isArray(data.favoriteKermes) && data.favoriteKermes.includes(kermesId)) {
          shouldSend = true;
        }
        if (data.favorites && Array.isArray(data.favorites) && data.favorites.includes(kermesId)) {
          shouldSend = true;
        }
      }

      // Grup 2: Personel & Adminler
      if (targetGroups.staff && staffUserIds.has(doc.id)) {
        shouldSend = true;
      }

      // Grup 3: Yakin Cevredekiler (konum bazli)
      if (targetGroups.nearby && kermesLat && kermesLng) {
        if (data.lastKnownLocation && data.lastKnownLocation.latitude && data.lastKnownLocation.longitude) {
          const dist = calculateDistance(
            data.lastKnownLocation.latitude, data.lastKnownLocation.longitude, 
            kermesLat, kermesLng
          );
          if (dist <= targetRadiusKm) shouldSend = true;
        }
      }

      if (shouldSend) {
        targetUserIds.add(doc.id);
        const token = data.fcmToken || data.customerFcmToken;
        if (token) targetTokens.add(token);
      }
    });

    const tokensArray = Array.from(targetTokens);

    if (targetUserIds.size === 0) {
      return NextResponse.json({ success: false, error: 'Hedef kitle bos.' }, { status: 404 });
    }

    // 2. Bildirim icerigini olustur
    const sortedItems = [...discountedItems].sort((a: any, b: any) => {
      const percA = (a.price - a.discountPrice) / a.price;
      const percB = (b.price - b.discountPrice) / b.price;
      return percB - percA;
    });

    const topItem = sortedItems[0];
    const itemImage = topItem.image;

    const title = `${kermesTitle} - Aksam Pazari Basladi!`;
    const messageBody = `Son firsatlar! ${topItem.name} ${topItem.price.toFixed(2)} EUR yerine sadece ${topItem.discountPrice.toFixed(2)} EUR! Tum indirimler stoklarla sinirlidir, tukenmeden yetisin!`;

    // FCM Payload
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(itemImage ? { imageUrl: itemImage, image: itemImage } : {})
      },
      data: {
        type: 'kermes_flash_sale',
        kermesId: kermesId,
        kermesTitle: kermesTitle || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...(itemImage ? { imageUrl: itemImage } : {})
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1
          }
        },
        fcm_options: {
          ...(itemImage ? { image: itemImage } : {})
        }
      },
      tokens: tokensArray,
    };

    // 3. FCM Push gonder
    const chunkSize = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokensArray.length; i += chunkSize) {
      const chunk = tokensArray.slice(i, i + chunkSize);
      const chunkMessage = { ...message, tokens: chunk };
      
      const response = await messaging.sendEachForMulticast(chunkMessage);
      successCount += response.successCount;
      failureCount += response.failureCount;
    }

    // 4. Firestore Inbox'a kaydet
    const admin = require('firebase-admin');
    const now = admin.firestore.Timestamp.now();
    const MAX_BATCH = 500;
    const userIds = Array.from(targetUserIds);

    const discountSummary = discountedItems.map((item: any) => ({
      name: item.name,
      price: item.price,
      discountPrice: item.discountPrice,
    }));

    // Firestore batch'leri 500 limitini asmamali
    for (let i = 0; i < userIds.length; i += MAX_BATCH) {
      const batch = db.batch();
      const chunk = userIds.slice(i, i + MAX_BATCH);
      
      for (const userId of chunk) {
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
          type: 'kermes_flash_sale',
          tag: 'kampanya',
          title: title,
          body: messageBody,
          kermesId: kermesId,
          kermesTitle: kermesTitle || '',
          discountedItems: discountSummary,
          imageUrl: itemImage || null,
          read: false,
          createdAt: now,
        });
      }
      
      await batch.commit();
    }

    // Gecmis kaydi
    await db.collection('kermesEvents').doc(kermesId).collection('notificationHistory').add({
      type: 'flash_sale', title, body: messageBody, sentCount: successCount, sentAt: now,
    });

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      targetSize: tokensArray.length,
      inboxSaved: userIds.length,
    });

  } catch (error) {
    console.error('Kermes Flash Sale Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
