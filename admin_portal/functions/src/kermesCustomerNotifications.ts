import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = admin.firestore();

export const onKermesOrderCreatedNotif = onDocumentCreated(
  {
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
  },
  async (event) => {
    const orderData = event.data?.data();
    if (!orderData) return;

    const orderId = event.params.orderId;
    const userId = orderData.userId as string | undefined;
    if (!userId) {
      console.log(`[OrderCreatedNotif] Siparis ${orderId}: userId yok, atlanıyor.`);
      return;
    }

    const orderNumber = orderData.orderNumber as string;

    const title = "Siparişiniz Alındı";
    const body = `#${orderNumber} numaralı siparişiniz sistemimize ulaştı.`;
    const notifType = "kermes_order_created";

    // Write to user notifications
    try {
      await db.collection("users").doc(userId).collection("notifications").add({
        title,
        body,
        type: notifType,
        orderId: orderId,
        orderNumber: orderNumber,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    } catch (e) {
      console.error("[OrderCreatedNotif] Failed to write to DB notifications", e);
    }

    // Read user token and send FCM
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken as string | undefined;

        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: title,
              body: body,
            },
            data: {
              type: notifType,
              orderId: orderId,
              orderNumber: orderNumber,
            },
            android: {
              priority: "high",
              notification: {
                channelId: "kermes_orders",
                sound: "default",
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          });
          console.log(`[OrderCreatedNotif] Push sent to user ${userId}`);
        }
      }
    } catch (pushErr) {
      console.error("[OrderCreatedNotif] Push failed:", pushErr);
    }
  }
);

export const onKermesOrderPaidNotif = onDocumentUpdated(
  {
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Sadece isPaid değiştiğinde
    const wasPaid = before.isPaid === true;
    const isPaidNow = after.isPaid === true;

    if (wasPaid === isPaidNow) return; 

    // Ödeme yapıldıysa
    if (isPaidNow) {
      const orderId = event.params.orderId;
      const userId = after.userId as string | undefined;
      const orderNumber = after.orderNumber as string;

      console.log(`[OrderPaymentNotif] Sipariş ${orderId} (${orderNumber}) ödendi!`);

      if (!userId) return;

      const title = "Ödemeniz Alındı";
      const body = `#${orderNumber} numaralı siparişinizin ödemesi başarıyla alınmıştır. Teşekkür ederiz!`;
      const notifType = "kermes_order_paid";

      // DB'ye kaydet
      try {
        await db.collection("users").doc(userId).collection("notifications").add({
          title,
          body,
          type: notifType,
          orderId: orderId,
          orderNumber: orderNumber,
          status: "paid",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      } catch (e) {
        console.error("[OrderPaymentNotif] Failed to write DB notification", e);
      }

      // FCM gönder
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const fcmToken = userData?.fcmToken as string | undefined;

          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: { title, body },
              data: {
                type: notifType,
                orderId: orderId,
                orderNumber: orderNumber,
              },
              android: {
                priority: "high",
                notification: {
                  channelId: "kermes_orders",
                  sound: "default",
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    badge: 1,
                  },
                },
              },
            });
            console.log(`[OrderPaymentNotif] Push sent to user ${userId}`);
          }
        }
      } catch (pushErr) {
        console.error("[OrderPaymentNotif] Push failed:", pushErr);
      }
    }
  }
);
