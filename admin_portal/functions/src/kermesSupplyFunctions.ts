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

    try {
      // Fetch Kermes Admins (or anyone assigned as Tedarik, but we notify Kermes Admins generally for now)
      const kermesDoc = await admin.firestore().collection('kermes_events').doc(kermesId).get();
      if (!kermesDoc.exists) return;
      const kData = kermesDoc.data()!;
      const kermesAdmins = kData.kermesAdmins || [];

      if (kermesAdmins.length === 0) return;

      const title = `🚨 Acil Malzeme Lazım: ${itemName}`;
      const body = `${requestedByName} (${reqZone}) acil ${itemName} bekliyor.`;

      // FCM Tokens to notify
      const tokens: string[] = [];
      const userSnaps = await admin.firestore().collection('users').where(admin.firestore.FieldPath.documentId(), 'in', kermesAdmins.slice(0, 10)).get();
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
        // Unique tokens
        const uniqueTokens = [...new Set(tokens)];
        await admin.messaging().sendEachForMulticast({
          tokens: uniqueTokens,
          notification: {
            title,
            body,
          },
          data: {
            type: 'supply_alarm',
            kermesId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
          apns: {
             payload: {
                aps: { sound: 'default' }
             }
          }
        });
        console.log(`[kermesSupplyFunctions] Sent supply alarm to ${uniqueTokens.length} devices for ${itemName}.`);
      }
    } catch (err) {
      console.error('Error onKermesSupplyRequested:', err);
    }
  });
