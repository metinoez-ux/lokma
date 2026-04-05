const admin = require('firebase-admin');
const serviceAccount = require('./firebase.json'); // Wait, default credential should work
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function fix() {
  const uid = 'yspOQz8nmTbjK0vRM6NoiQwCOMB3';
  
  await db.collection('users').doc(uid).set({
    address: "",
    addressLine2: "",
    adminType: null,
    assignments: [],
    businessId: null,
    businessName: null,
    butcherId: null,
    butcherName: null,
    city: "",
    country: "Almanya",
    createdAt: new Date("2026-04-04T22:41:07.156Z"),
    customId: "YHUNT",
    deactivatedAt: null,
    deactivatedBy: null,
    deactivationReason: null,
    dialCode: "+49",
    displayName: "Ferihan Oez",
    email: "ferihan.oez05@gmail.com",
    fcmToken: "eZkscD34TsK2jJ4b-A9mW0:APA91bHj1chl1liQFaN7uZxysfQV9hV-KNQZs0F5a914_d1VfnbJJCajrsPK6vZn-0uaiVFgtRZkbcv1TL_Nylue6c6qgl6NuNzMS9BFU8M9t3JUXTM8sfE",
    fcmTokenUpdatedAt: new Date("2026-04-05T02:02:35.444Z"),
    firstName: "Ferihan",
    gender: "female",
    houseNumber: "",
    isActive: true,
    isAdmin: false,
    kermesAllowedSections: [],
    kermesAssignments: [],
    lastName: "Oez",
    notifyOrderEmail: true,
    notifyOrderPush: true,
    phone: "+491784443415",
    phoneNumber: "+491784443415",
    phoneVerified: false,
    photoURL: null,
    postalCode: "",
    roles: ["customer"],
    uid: uid,
    updatedAt: new Date(),
    updatedBy: "system"
  }, { merge: false });
  
  await db.collection('admins').doc(uid).update({
    isActive: false,
    isDriver: false,
    deactivationReason: 'Admin role removed',
    roles: ['customer'],
    assignments: [],
    assignedKermesEvents: [],
    assignedKermesNames: [],
    assignedBusinesses: [],
    assignedBusinessNames: [],
    kermesAssignments: [],
    kermesAllowedSections: [],
    adminType: null
  });

  console.log('Fixed users and admins coll');
}

fix().catch(console.error);
