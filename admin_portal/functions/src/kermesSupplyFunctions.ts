import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onKermesSupplyRequested = functions.firestore
  .document('kermes_events/{kermesId}/supply_requests/{requestId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data) return;

    const kermesId = context.params.kermesId;
    const itemName = data.itemName || 'Malzeme';
    const reqZone = data.requestedZone || 'Personel';
    const requestedByName = data.requestedByName || 'Biri';
    const requestId = context.params.requestId;

    try {
      const db = admin.firestore();
      // Fetch Kermes Admins (or anyone assigned as Tedarik, but we notify Kermes Admins generally for now)
      const kermesDoc = await db.collection('kermes_events').doc(kermesId).get();
      if (!kermesDoc.exists) return;
      const kData = kermesDoc.data()!;
      const kermesAdmins = kData.kermesAdmins || [];

      if (kermesAdmins.length === 0) return;

      const title = `🚨 Acil Malzeme Lazım: ${itemName}`;
      const body = `${requestedByName} (${reqZone}) acil ${itemName} bekliyor.`;

      // 1. DYNAMIC INBOX MESSAGE FOR ADMINS
      const batch = db.batch();
      for (const uid of kermesAdmins) {
         const notifRef = db.collection("users").doc(uid).collection("personnel_notifications").doc(requestId);
         batch.set(notifRef, {
            title,
            body,
            type: "supply_alarm",
            kermesId,
            requestId,
            itemName,
            status: "pending",
            read: false,
            createdAt: new Date().toISOString(),
         });
      }
      await batch.commit();

      // 2. FCM PUSH FOR ADMINS
      const tokens: string[] = [];
      const userSnaps = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', kermesAdmins.slice(0, 10)).get();
      userSnaps.forEach((doc) => {
          const ud = doc.data();
          if (ud.fcmToken) {
              if (Array.isArray(ud.fcmToken)) {
                  tokens.push(...ud.fcmToken);
              } else {
                  tokens.push(ud.fcmToken);
              }
          }
      });

      if (tokens.length > 0) {
        const uniqueTokens = [...new Set(tokens)];
        await admin.messaging().sendEachForMulticast({
          tokens: uniqueTokens,
          notification: { title, body },
          data: { type: 'supply_alarm', kermesId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
          apns: { payload: { aps: { sound: 'default' } } }
        });
        console.log(`[kermesSupplyFunctions] Sent supply alarm to ${uniqueTokens.length} devices for ${itemName}.`);
      }
    } catch (err) {
      console.error('Error onKermesSupplyRequested:', err);
    }
  });

export const onKermesSupplyStatusUpdated = functions.firestore
  .document('kermes_events/{kermesId}/supply_requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;
    
    // Yalnızca status değişirse inbox & push tetikleyelim
    if (before.status === after.status) return;

    const kermesId = context.params.kermesId;
    const requestId = context.params.requestId;
    const itemName = after.itemName || 'Malzeme';
    const reqUid = after.requestedByUid; // Personel ID
    const newStatus = after.status;

    try {
      const db = admin.firestore();
      
      // Update the admin's inbox messages! (We want to change the visual green ok for everyone)
      // First, get admins to update their inbox
      const kermesDoc = await db.collection('kermes_events').doc(kermesId).get();
      if (kermesDoc.exists) {
         const kData = kermesDoc.data()!;
         const kermesAdmins = kData.kermesAdmins || [];
         const batch = db.batch();
         for (const adminUid of kermesAdmins) {
             const notifRef = db.collection("users").doc(adminUid).collection("personnel_notifications").doc(requestId);
             batch.update(notifRef, {
                 status: newStatus,
                 body: newStatus === 'on_the_way' ? `${after.requestedByName} talebine YOLA ÇIKTI damgası vurdunuz.` : `${after.requestedByName} talebi TAMAMLANDI.`,
                 updatedAt: new Date().toISOString()
             }).catch(() => {}); // ignore if it doesn't exist
         }
         await batch.commit();
      }

      // If personnel who requested it exists
      if (!reqUid) return;

      const title = newStatus === 'on_the_way' ? `✅ Malzeme Yola Çıktı!` : `✅ Malzeme Tamamlandı`;
      const body = newStatus === 'on_the_way' 
             ? `Kermes Yetkilisi, "${itemName}" talebinizi onayladı ve yola çıkardı!` 
             : `"${itemName}" talebi tamam olarak işaretlendi.`;

      // 1. INBOX MESSAGE FOR THE REQUESTER
      await db.collection("users").doc(reqUid).collection("personnel_notifications").doc(requestId).set({
         title,
         body,
         type: "supply_alarm_status",
         kermesId,
         requestId,
         itemName,
         status: newStatus,
         read: false,
         createdAt: new Date().toISOString(),
      });

      // 2. FCM PUSH FOR THE REQUESTER
      const userDoc = await db.collection('users').doc(reqUid).get();
      if (!userDoc.exists) return;
      const fcmToken = userDoc.data()?.fcmToken;
      
      if (fcmToken) {
         const tokens = Array.isArray(fcmToken) ? fcmToken : [fcmToken];
         if (tokens.length > 0) {
             await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data: { type: 'supply_alarm_status', status: newStatus, kermesId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
                apns: { payload: { aps: { sound: 'default' } } }
             });
             console.log(`[kermesSupplyFunctions] Push sent to requester ${reqUid} for status ${newStatus}.`);
         }
      }
    } catch (err) {
      console.error('Error onKermesSupplyStatusUpdated:', err);
    }
  });

