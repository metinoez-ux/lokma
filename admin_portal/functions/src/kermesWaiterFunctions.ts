import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = admin.firestore();

/**
 * Kermes Garson Atama Timeout (3 Dakika)
 *
 * Her dakika calisir. Eger bir siparise garson atanmis ama 3 dakika icinde
 * teslim etmemisse:
 * 1. Garsonun siparis sayacini dusur
 * 2. Garsonu "paused" yap (o an yok, pause dugmesine basmayi unutmus)
 * 3. Siparisi en az mesgul diger aktif garsona devret
 *
 * Kural: Aile Bolumu dahil tum bolumlerde erkek garson servis yapar
 *
 * Siparisler butun bolumlerden (Kadin/Erkek/Aile) gelen itemlari
 * kendi bolumlerinin PrepZone'larinda hazirlanir, sonra o bolumun
 * Tezgah'inda (genel alma noktasi) toplanir.
 * - Masada: Garson Tezgah'tan alip masaya goturur
 * - GelAl: Musteri push notification ile Tezgah'a gelip alir
 */
export const kermesWaiterTimeoutCheck = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west1",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const threeMinutesAgo = new Date(now.toMillis() - 3 * 60 * 1000);

    try {
      // Atanmis ama teslim edilmemis siparisleri bul
      const overdueOrders = await db
        .collection("kermes_orders")
        .where("status", "in", ["ready"])
        .where("assignedWaiterId", "!=", null)
        .where("deliveryType", "==", "masada")
        .get();

      let reassignedCount = 0;

      for (const orderDoc of overdueOrders.docs) {
        const orderData = orderDoc.data();
        const assignedAt = orderData.waiterAssignedAt as admin.firestore.Timestamp | undefined;

        if (!assignedAt) continue;
        if (assignedAt.toDate() > threeMinutesAgo) continue; // Henuz 3dk olmamis

        const kermesId = orderData.kermesId as string;
        const currentWaiterId = orderData.assignedWaiterId as string;
        const tableSection = orderData.tableSection as string | undefined;

        if (!kermesId || !currentWaiterId) continue;

        console.log(
          `[WaiterTimeout] Siparis ${orderDoc.id}: garson ${currentWaiterId} 3dk asti`
        );

        // 1. Eski garsonun sayacini dusur ve paused yap
        const oldStaffDocId = `${kermesId}__${currentWaiterId}`;
        await db
          .collection("kermes_staff_status")
          .doc(oldStaffDocId)
          .update({
            currentOrderCount: admin.firestore.FieldValue.increment(-1),
            status: "paused",
            pausedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        // 2. Ayni bolumdeki en az mesgul aktif garsonu bul
        let newWaiterQuery = db
          .collection("kermes_staff_status")
          .where("kermesId", "==", kermesId)
          .where("status", "==", "active");

        if (tableSection) {
          newWaiterQuery = newWaiterQuery.where(
            "assignedSection",
            "==",
            tableSection
          );
        }

        const candidates = await newWaiterQuery
          .orderBy("currentOrderCount", "asc")
          .limit(1)
          .get();

        if (candidates.empty) {
          console.log(
            `[WaiterTimeout] Siparis ${orderDoc.id}: bos garson yok, atanmamis olarak birakiliyor`
          );
          // Siparisi atanmamis olarak birak
          await orderDoc.ref.update({
            assignedWaiterId: null,
            assignedWaiterName: null,
            waiterAssignedAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        const newWaiter = candidates.docs[0].data();
        const newWaiterId = newWaiter.staffId as string;
        const newWaiterName = newWaiter.staffName as string;

        // 3. Siparisi yeni garsona devret
        await orderDoc.ref.update({
          assignedWaiterId: newWaiterId,
          assignedWaiterName: newWaiterName,
          waiterAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Yeni garsonun sayacini artir
        const newStaffDocId = `${kermesId}__${newWaiterId}`;
        await db
          .collection("kermes_staff_status")
          .doc(newStaffDocId)
          .update({
            currentOrderCount: admin.firestore.FieldValue.increment(1),
            lastAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        reassignedCount++;
        console.log(
          `[WaiterTimeout] Siparis ${orderDoc.id}: ${currentWaiterId} -> ${newWaiterId} (${newWaiterName})`
        );
      }

      if (reassignedCount > 0) {
        console.log(
          `[WaiterTimeout] Toplam ${reassignedCount} siparis yeniden atandi`
        );
      }

      // ── Kurye Timeout (ayni 3dk mantigi) ──────────────────────────────────
      const overdueKuryeOrders = await db
        .collection("kermes_orders")
        .where("status", "in", ["ready"])
        .where("assignedCourierId", "!=", null)
        .where("deliveryType", "==", "kurye")
        .get();

      let kuryeReassigned = 0;

      for (const orderDoc of overdueKuryeOrders.docs) {
        const orderData = orderDoc.data();
        const assignedAt = orderData.courierAssignedAt as admin.firestore.Timestamp | undefined;

        if (!assignedAt) continue;
        if (assignedAt.toDate() > threeMinutesAgo) continue;

        const kermesId = orderData.kermesId as string;
        const currentCourierId = orderData.assignedCourierId as string;

        if (!kermesId || !currentCourierId) continue;

        console.log(
          `[CourierTimeout] Siparis ${orderDoc.id}: kurye ${currentCourierId} 3dk asti`
        );

        // Eski kuryeyi paused yap
        const oldStaffDocId = `${kermesId}__${currentCourierId}`;
        await db
          .collection("kermes_staff_status")
          .doc(oldStaffDocId)
          .update({
            currentOrderCount: admin.firestore.FieldValue.increment(-1),
            status: "paused",
            pausedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        // En az mesgul aktif kuryeyi bul
        const candidates = await db
          .collection("kermes_staff_status")
          .where("kermesId", "==", kermesId)
          .where("role", "==", "courier")
          .where("status", "==", "active")
          .orderBy("currentOrderCount", "asc")
          .limit(1)
          .get();

        if (candidates.empty) {
          await orderDoc.ref.update({
            assignedCourierId: null,
            assignedCourierName: null,
            courierAssignedAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        const newCourier = candidates.docs[0].data();
        const newCourierId = newCourier.staffId as string;
        const newCourierName = newCourier.staffName as string;

        await orderDoc.ref.update({
          assignedCourierId: newCourierId,
          assignedCourierName: newCourierName,
          courierAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const newStaffDocId = `${kermesId}__${newCourierId}`;
        await db
          .collection("kermes_staff_status")
          .doc(newStaffDocId)
          .update({
            currentOrderCount: admin.firestore.FieldValue.increment(1),
            lastAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        kuryeReassigned++;
        console.log(
          `[CourierTimeout] Siparis ${orderDoc.id}: ${currentCourierId} -> ${newCourierId} (${newCourierName})`
        );
      }

      if (kuryeReassigned > 0) {
        console.log(
          `[CourierTimeout] Toplam ${kuryeReassigned} kurye siparis yeniden atandi`
        );
      }
    } catch (error) {
      console.error("[WaiterTimeout] Hata:", error);
    }
  }
);

/**
 * Kermes siparisi ready oldugunda otomatik garson atamasi
 *
 * Siparis KDS'de tum itemlari "ready" olarak isaretlendiginde tetiklenir.
 * - Masa siparisi: en az mesgul aktif garsona atar. Garson Tezgah'tan alip masaya goturur.
 * - Gel-Al (McDonald's usulu): push notification gonderir. Musteri Tezgah'a gelip alir.
 *
 * Her bolumun kendi Tezgah/alma noktasi vardir. Siparis o bolumun Tezgah'ina duser.
 */
export const onKermesOrderReady = onDocumentUpdated(
  {
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Sadece status degistiginde calis
    if (before.status === after.status) return;
    if (after.status !== "ready") return;

    const orderId = event.params.orderId;
    const kermesId = after.kermesId as string;
    const deliveryType = after.deliveryType as string;
    const tableSection = after.tableSection as string | undefined;

    console.log(`[OrderReady] Siparis ${orderId} hazir, tip: ${deliveryType}`);

    if (deliveryType === "masada") {
      // Masa siparişi: İlgili bölümdeki tüm aktif garsonlara bildirim gönder (Sahiplenme modeli)
      let query = db
        .collection("kermes_staff_status")
        .where("kermesId", "==", kermesId)
        .where("status", "==", "active")
        .where("role", "==", "waiter");

      if (tableSection) {
        query = query.where("assignedSection", "==", tableSection);
      }

      const activeWaiters = await query.get();

      if (activeWaiters.empty) {
        console.log(`[OrderReady] Siparis ${orderId}: aktif garson yok`);
        return;
      }

      // Aktif garsonların user dökümanlarını bulup FCM tokenlarını al
      const tokens: string[] = [];
      const waiterIds = activeWaiters.docs.map(doc => doc.data().staffId as string);

      for (const wId of waiterIds) {
        const userDoc = await db.collection("users").doc(wId).get();
        if (userDoc.exists) {
          const fcmToken = userDoc.data()?.fcmToken;
          if (fcmToken) {
            tokens.push(fcmToken);
          }
        }
      }

      const tableNo = after.tableNo as string || "Bilinmiyor";

      if (tokens.length > 0) {
        try {
          await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: {
              title: `Masa ${tableNo} Siparişi Hazır!`,
              body: "Teslimat bekliyor. Sahiplenmek için dokunun.",
            },
            data: {
              type: "kermes_waiter_order_ready",
              orderId: orderId,
              tableNo: tableNo,
              tableSection: tableSection || "",
            },
            android: {
              priority: "high",
              notification: {
                channelId: "kermes_orders",
                sound: "notification_sound",
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "notification_sound",
                  badge: 1,
                },
              },
            },
          });
          console.log(`[OrderReady] Masa ${tableNo} siparişi için ${tokens.length} garsona bildirim gönderildi.`);
        } catch (pushErr) {
          console.error(`[OrderReady] Garsonlara push gönderilemedi:`, pushErr);
        }
      }

    } else if (deliveryType === "kurye") {
      // Kurye siparisi: en az mesgul aktif surucu atanir
      // Garson mantigi ile ayni: round-robin, en bos surucu
      // Tek surucu varsa siradaki gorev olarak beklenir

      const candidates = await db
        .collection("kermes_staff_status")
        .where("kermesId", "==", kermesId)
        .where("role", "==", "courier")
        .where("status", "==", "active")
        .orderBy("currentOrderCount", "asc")
        .limit(1)
        .get();

      if (candidates.empty) {
        console.log(`[OrderReady] Siparis ${orderId}: aktif kurye yok`);
        return;
      }

      const courier = candidates.docs[0].data();
      const courierId = courier.staffId as string;
      const courierName = courier.staffName as string;

      // Siparisi kuryeye ata
      await event.data!.after.ref.update({
        assignedCourierId: courierId,
        assignedCourierName: courierName,
        courierAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Kurye sayacini artir
      const staffDocId = `${kermesId}__${courierId}`;
      await db
        .collection("kermes_staff_status")
        .doc(staffDocId)
        .update({
          currentOrderCount: admin.firestore.FieldValue.increment(1),
          lastAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(
        `[OrderReady] Kurye siparis ${orderId} -> ${courierName} (${courierId})`
      );

    } else if (deliveryType === "gelAl") {
      // Gel-Al (McDonald's usulu): "Siparisiz hazir!" push notification
      // Musteri ilgili bolumun Tezgah'ina gidip siparisini alacak
      const userId = after.userId as string | undefined;
      if (!userId) {
        console.log(`[OrderReady] Siparis ${orderId}: userId yok, push gonderilemez`);
        return;
      }

      // Kullanicinin FCM token'ini bul
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken as string | undefined;
      if (!fcmToken) {
        console.log(`[OrderReady] Kullanici ${userId}: FCM token yok`);
        return;
      }

      const orderNumber = after.orderNumber as string;

      // Bolumun Tezgah ismini bul (genel alma noktasi)
      let tezgahLabel = "Tezgah";
      if (tableSection && kermesId) {
        try {
          const eventDoc = await db.collection("kermes_events").doc(kermesId).get();
          if (eventDoc.exists) {
            const eventData = eventDoc.data();
            const sectionsV2 = eventData?.tableSectionsV2 as Record<string, any> | undefined;
            if (sectionsV2 && sectionsV2[tableSection]) {
              const sectionData = sectionsV2[tableSection];
              const tezgahlar = sectionData.tezgahlar as string[] | undefined;
              const sectionLabel = sectionData.label as string || tableSection;
              if (tezgahlar && tezgahlar.length > 0) {
                tezgahLabel = `${sectionLabel} - ${tezgahlar[0]}`;
              } else {
                tezgahLabel = `${sectionLabel} Tezgahi`;
              }
            }
          }
        } catch (e) {
          console.warn(`[OrderReady] Bolum tezgah bilgisi alinamadi: ${e}`);
        }
      }

      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: "Siparisiz Hazir!",
            body: `#${orderNumber} numarali siparisiz ${tezgahLabel} alma noktasindan teslim alinabilir.`,
          },
          data: {
            type: "kermes_order_ready",
            orderId: orderId,
            orderNumber: orderNumber,
            tezgah: tezgahLabel,
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

        console.log(
          `[OrderReady] Push gonderildi: ${userId} -> siparis #${orderNumber} (tezgah: ${tezgahLabel})`
        );
      } catch (pushErr) {
        console.error(`[OrderReady] Push gonderilemedi:`, pushErr);
      }
    }
  }
);
