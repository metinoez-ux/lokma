import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getPushTranslations, getUserLanguage } from "./utils/translation";

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
    const orderNumber = orderData.orderNumber as string;
    const totalAmount = orderData.totalAmount as number || 0;
    const kermesId = orderData.kermesId as string | undefined;

    const userId = orderData.userId as string | undefined;
    if (userId && !userId.startsWith("guest_")) {
      const userLang = await getUserLanguage(userId);
      const trans = await getPushTranslations(userLang);
      const title = trans.kermesOrderReceivedTitle || "Siparişiniz Alındı";
      const body = (trans.kermesOrderReceivedBody || "#{{orderNumber}} numaralı siparişiniz sistemimize ulaştı.").replace("{{orderNumber}}", orderNumber);
      const notifType = "kermes_order_created";

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

      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const fcmToken = userData?.fcmToken as string | undefined;
          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: { title, body },
              data: { type: notifType, orderId, orderNumber },
              android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
              apns: { payload: { aps: { sound: "default", badge: 1 } } },
            });
            console.log(`[OrderCreatedNotif] Push sent to user ${userId}`);
          }
        }
      } catch (pushErr) {
        console.error("[OrderCreatedNotif] Push failed for user:", pushErr);
      }
    } else {
      console.log(`[OrderCreatedNotif] Siparis ${orderId}: userId yok veya guest, müşteri bildirimi atlanıyor.`);
    }

    // 2. Kermes personeline (Admin / KDS) bildirim gönder
    if (kermesId) {
      try {
        const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
        if (kermesDoc.exists) {
          const kData = kermesDoc.data();
          const kermesName = kData?.kermesName || kData?.city || "Kermes";
          
          const staffUids = new Set<string>();
          ['kermesAdmins', 'assignedStaff', 'assignedWaiters', 'assignedDrivers'].forEach(field => {
            if (Array.isArray(kData?.[field])) {
              kData![field].forEach((uid: string) => staffUids.add(uid));
            }
          });
          if (kData?.prepZoneAssignments) {
            Object.values(kData.prepZoneAssignments).forEach((uids: any) => {
              if (Array.isArray(uids)) {
                uids.forEach((uid: string) => staffUids.add(uid));
              }
            });
          }

          if (staffUids.size > 0) {
            const adminPromises = Array.from(staffUids).map(uid => db.collection("admins").doc(uid).get());
            const adminDocs = await Promise.all(adminPromises);

            const mobileTokens: string[] = [];
            const webTokens: string[] = [];

            adminDocs.forEach(doc => {
              if (doc.exists) {
                const data = doc.data();
                // Mobile app writes singular fcmToken, check both formats
                if (data?.fcmToken && typeof data.fcmToken === 'string') mobileTokens.push(data.fcmToken);
                if (data?.fcmTokens && Array.isArray(data.fcmTokens)) mobileTokens.push(...data.fcmTokens);
                if (data?.webFcmTokens && Array.isArray(data.webFcmTokens)) webTokens.push(...data.webFcmTokens);
              }
            });

            const staffLang = "tr"; // Multicast default for staff
            const trans = await getPushTranslations(staffLang);
            const staffTitle = (trans.kermesNewStaffTitle || `🔔 Yeni Sipariş ({{kermesName}})!`).replace("{{kermesName}}", kermesName);
            let staffBody = (trans.kermesNewStaffBody || `#{{orderNumber}} - {{amount}}€ [{{deliveryType}}]`)
                .replace("{{orderNumber}}", orderNumber)
                .replace("{{amount}}", totalAmount.toFixed(2));
            
            if (orderData.deliveryType) {
              staffBody = staffBody.replace("{{deliveryType}}", orderData.deliveryType);
            } else {
              staffBody = staffBody.replace(" [{{deliveryType}}]", "").replace("[{{deliveryType}}]", "");
            }

            const sendObj = (tokens: string[], isWeb: boolean) => ({
              notification: { title: staffTitle, body: staffBody },
              data: { type: "kermes_new_order", orderId, orderNumber, kermesId },
              tokens,
              android: { priority: "high" as const, notification: { channelId: "kermes_orders", sound: "notification_sound" } },
              apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
              webpush: isWeb ? { fcmOptions: { link: `/kermes/orders` } } : undefined,
            });

            if (mobileTokens.length > 0) {
              const res = await admin.messaging().sendEachForMulticast(sendObj(mobileTokens, false));
              console.log(`[Mobile] Sent to ${res.successCount}/${mobileTokens.length} devices`);
            }
            if (webTokens.length > 0) {
              const res = await admin.messaging().sendEachForMulticast(sendObj(webTokens, true));
              console.log(`[Web] Sent to ${res.successCount}/${webTokens.length} devices`);
            }

            // Write to personnel_notifications subcollection for in-app inbox
            const batch = db.batch();
            for (const uid of staffUids) {
              const notifRef = db.collection("users").doc(uid).collection("personnel_notifications").doc();
              batch.set(notifRef, {
                title: staffTitle,
                body: staffBody,
                type: "kermes_new_order",
                orderId,
                orderNumber,
                kermesId,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
            await batch.commit();
            console.log(`[Inbox] Written to ${staffUids.size} staff inboxes`);
          }
        }
      } catch (e) {
        console.error("[OrderCreatedNotif] Failed to notify Kermes staff:", e);
      }
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

      const userLang = await getUserLanguage(userId);
      const trans = await getPushTranslations(userLang);
      const title = trans.kermesPaymentReceivedTitle || "Ödemeniz Alındı";
      const body = (trans.kermesPaymentReceivedBody || "#{{orderNumber}} numaralı siparişinizin ödemesi başarıyla alınmıştır. Teşekkür ederiz!").replace("{{orderNumber}}", orderNumber);
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

    // PERSONELE BİLDİR (Ödeme Yapıldı)
    const kermesId = after.kermesId as string | undefined;
    const orderNumber2 = after.orderNumber as string;
    if (kermesId && isPaidNow) {
      try {
        const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
        if (kermesDoc.exists) {
          const kData = kermesDoc.data();
          const staffUids = new Set<string>();
          ['kermesAdmins', 'assignedStaff', 'assignedWaiters', 'assignedDrivers'].forEach(field => {
            if (Array.isArray(kData?.[field])) {
              kData![field].forEach((uid: string) => staffUids.add(uid));
            }
          });
          if (kData?.prepZoneAssignments) {
            Object.values(kData.prepZoneAssignments).forEach((uids: any) => {
              if (Array.isArray(uids)) {
                uids.forEach((uid: string) => staffUids.add(uid));
              }
            });
          }

          if (staffUids.size > 0) {
            const adminPromises = Array.from(staffUids).map(uid => db.collection("admins").doc(uid).get());
            const adminDocs = await Promise.all(adminPromises);

            const mobileTokens: string[] = [];
            const webTokens: string[] = [];

            adminDocs.forEach(doc => {
              if (doc.exists) {
                const data = doc.data();
                // Mobile app writes singular fcmToken, check both formats
                if (data?.fcmToken && typeof data.fcmToken === 'string') mobileTokens.push(data.fcmToken);
                if (data?.fcmTokens && Array.isArray(data.fcmTokens)) mobileTokens.push(...data.fcmTokens);
                if (data?.webFcmTokens && Array.isArray(data.webFcmTokens)) webTokens.push(...data.webFcmTokens);
              }
            });

            const staffLang = "tr";
            const trans = await getPushTranslations(staffLang);
            const staffTitle = trans.kermesPaymentStaffTitle || `💳 Ödeme Alındı!`;
            const staffBody = (trans.kermesPaymentStaffBody || `#{{orderNumber}} numaralı siparişin ödemesi yapıldı.`).replace("{{orderNumber}}", orderNumber2);

            const sendObj = (tokens: string[], isWeb: boolean) => ({
              notification: { title: staffTitle, body: staffBody },
              data: { type: "kermes_order_paid", orderId: event.params.orderId, orderNumber: orderNumber2 },
              tokens,
              android: { priority: "high" as const, notification: { channelId: "kermes_orders", sound: "notification_sound" } },
              apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
              webpush: isWeb ? { fcmOptions: { link: `/kermes/orders` } } : undefined,
            });

            if (mobileTokens.length > 0) admin.messaging().sendEachForMulticast(sendObj(mobileTokens, false));
            if (webTokens.length > 0) admin.messaging().sendEachForMulticast(sendObj(webTokens, true));

            // Write to personnel_notifications subcollection for in-app inbox
            const batch2 = db.batch();
            for (const uid of staffUids) {
              const notifRef = db.collection("users").doc(uid).collection("personnel_notifications").doc();
              batch2.set(notifRef, {
                title: staffTitle,
                body: staffBody,
                type: "kermes_order_paid",
                orderId: event.params.orderId,
                orderNumber: orderNumber2,
                kermesId,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
            await batch2.commit();
            console.log(`[Inbox] Payment notification written to ${staffUids.size} staff inboxes`);
          }
        }
      } catch (e) {
        console.error("[OrderPaymentNotif] Failed to notify staff:", e);
      }
    }
  }
);
