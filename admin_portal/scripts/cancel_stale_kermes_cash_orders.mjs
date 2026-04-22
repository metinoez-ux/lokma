import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { resolve } from 'path';

import serviceAccount from '../service-account.json' with { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const messaging = getMessaging();

async function backfillStaleCashOrders() {
  console.log('Starting backfill for stale Kermes cash orders...');
  
  // Cutoff is 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  // Do not send push notifications for orders older than 24 hours to avoid spamming
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const ordersSnapshot = await db.collection("kermes_orders")
      .where("paymentMethod", "==", "cash")
      .where("isPaid", "==", false)
      .get();
      
    if (ordersSnapshot.empty) {
      console.log("No unpaid cash orders found.");
      return;
    }
    
    let cancelledCount = 0;
    const batch = db.batch();
    
    for (const doc of ordersSnapshot.docs) {
      const data = doc.data();
      
      if (data.status === "cancelled" || data.status === "delivered") continue;
      
      const createdAt = data.createdAt?.toDate();
      if (!createdAt || createdAt.getTime() > twoHoursAgo.getTime()) continue;
      
      const orderId = doc.id;
      const orderNumber = data.orderNumber;
      const userId = data.userId;
      const isAncient = createdAt.getTime() < twentyFourHoursAgo.getTime();
      
      const updateData = {
        status: "cancelled",
        completedAt: FieldValue.serverTimestamp(),
        notes: data.notes 
          ? `${data.notes}\n(Otomatik iptal: 2 saat içinde ödeme yapılmadı)`
          : "(Otomatik iptal: 2 saat içinde ödeme yapılmadı)"
      };
      
      batch.update(doc.ref, updateData);
      cancelledCount++;
      console.log(`Cancelling order: ${orderId} (created at ${createdAt.toISOString()})`);
      
      // Notify customer if applicable and not ancient
      if (userId && !userId.startsWith("guest_")) {
        // In-app notification
        const notifRef = db.collection("users").doc(userId).collection("notifications").doc();
        batch.set(notifRef, {
          title: "Sipariş İptal Edildi",
          body: `#${orderNumber} numaralı siparişiniz, 2 saat içinde ödeme yapılmadığı için iptal edilmiştir.`,
          type: "kermes_order_cancelled",
          orderId,
          orderNumber,
          status: "cancelled",
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        });
        
        if (!isAncient) {
          // Push notification
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const fcmToken = userData?.fcmToken;
              if (fcmToken) {
                await messaging.send({
                  token: fcmToken,
                  notification: { 
                    title: "Sipariş İptal Edildi", 
                    body: `#${orderNumber} numaralı siparişiniz, 2 saat içinde ödeme yapılmadığı için iptal edilmiştir.` 
                  },
                  data: { type: "kermes_order_cancelled", orderId, orderNumber },
                  android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                  apns: { payload: { aps: { sound: "default", badge: 1 } } },
                });
                console.log(`Sent push notification to ${userId} for order ${orderId}`);
              }
            }
          } catch (err) {
            console.error(`Failed to send push for user ${userId}`, err);
          }
        } else {
            console.log(`Skipping push notification for ${userId} because order is ancient (> 24h)`);
        }
      }
    }
    
    if (cancelledCount > 0) {
      await batch.commit();
      console.log(`Successfully cancelled ${cancelledCount} stale cash orders.`);
    } else {
      console.log("No cash orders were older than 2 hours.");
    }
    
  } catch (err) {
    console.error("Error fetching or updating orders", err);
  }
}

backfillStaleCashOrders().then(() => process.exit(0));
