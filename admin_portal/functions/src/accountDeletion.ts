import * as admin from 'firebase-admin';
import * as auth from 'firebase-functions/v1/auth';

// V1 Auth trigger
export const onUserAccountDeleted = auth.user().onDelete(async (user: auth.UserRecord) => {
    const uid = user.uid;
    const db = admin.firestore();

    console.log(`[GDPR] Starting data cleanup for deleted user: ${uid}`);

    try {
        const batch = db.batch();

        // 1. Delete user from 'users' collection
        const userRef = db.collection('users').doc(uid);
        batch.delete(userRef);

        // 2. Delete user from 'user_profiles' collection
        const profileRef = db.collection('user_profiles').doc(uid);
        batch.delete(profileRef);

        // 3. Anonymize past orders in 'meat_orders' collection
        console.log(`[GDPR] Querying meat_orders for user: ${uid}...`);
        
        // Sometimes orders use 'userId', sometimes 'customerId'
        const ordersByUserId = await db.collection('meat_orders').where('userId', '==', uid).get();
        const ordersByCustomerId = await db.collection('meat_orders').where('customerId', '==', uid).get();
        
        // Combine unique order references
        const orderRefs = new Map<string, admin.firestore.DocumentReference>();
        
        ordersByUserId.docs.forEach(doc => orderRefs.set(doc.id, doc.ref));
        ordersByCustomerId.docs.forEach(doc => orderRefs.set(doc.id, doc.ref));

        console.log(`[GDPR] Found ${orderRefs.size} orders to anonymize for user: ${uid}`);

        const anonymizedData = {
            customerName: 'Silinmiş Kullanıcı',
            customerPhone: '0000000000',
            customerEmail: 'deleted@user.lokma',
            deliveryAddress: 'Gizlenmiş Adres',
            addressDetails: 'Gizlenmiş Adres',
            city: 'Gizlenmiş',
            ort: 'Gizlenmiş',
            zip: '00000',
            postalCode: '00000',
            notes: 'Kullanıcı silindiği için notlar gizlenmiştir.',
            fcmToken: admin.firestore.FieldValue.delete(),
            customerFcmToken: admin.firestore.FieldValue.delete(),
            fcmTokens: admin.firestore.FieldValue.delete(),
            userId: 'DELETED_USER',
            customerId: 'DELETED_USER'
        };

        orderRefs.forEach((ref) => {
            batch.update(ref, anonymizedData);
        });

        // Execute all deletes and updates
        await batch.commit();

        console.log(`[GDPR] Data cleanup successfully completed for user: ${uid}`);

    } catch (error) {
        console.error(`[GDPR] Error during data cleanup for user ${uid}:`, error);
        throw error;
    }
});
