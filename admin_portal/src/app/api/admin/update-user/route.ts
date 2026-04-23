export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';

import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
 let body: any;
 try {
 body = await request.json();
 } catch (parseError) {
 return NextResponse.json(
 { error: 'Geçersiz istek gövdesi', debug: String(parseError) },
 { status: 400 }
 );
 }

 let auth: any, db: any, firebaseAdmin: any;
 try {
 const admin = await getFirebaseAdmin();
 firebaseAdmin = admin;
 auth = admin.auth;
 db = admin.db;
 } catch (initError: any) {
 return NextResponse.json(
 { error: `Sunucu Hatası: ${initError.message || String(initError)}`, debug: String(initError) },
 { status: 500 }
 );
 }

 try {
 // Frontend sends fields inside `updateData` wrapper; unwrap if present
 const source = body.updateData || body;
 const userId = body.userId || source.userId;

 const {
 email,
 password,
 firstName,
 lastName,
 displayName,
 phoneNumber,
 dialCode,
 address,
 houseNumber,
 addressLine2,
 city,
 country,
 postalCode,
 latitude,
 longitude,
 photoURL,
 isActive,
 isAdmin,
 adminType,
 roles,
 organizationId,
 organizationName,
 butcherId,
 butcherName,
 isPrimaryAdmin,
 isDriver,
 driverType,
 assignedBusinesses,
 assignedBusinessNames,
 assignedKermesEvents,
 assignedKermesNames,
 assignments,
 kermesAllowedSections,
 gender
 } = source;

 const updatedBy = body.adminEmail || source.updatedBy || 'system';
 const deactivatedBy = source.deactivatedBy;
 const deactivatedAt = source.deactivatedAt;
 const deactivationReason = source.deactivationReason;

 if (!userId) {
 return NextResponse.json(
 { error: 'User ID is required' },
 { status: 400 }
 );
 }

 const updatedAt = new Date();

 // If this is just a photo update
 if (source.action === 'updatePhotoOnly') {
    if (photoURL !== undefined) {
      // Update Auth Profile
      try {
        await auth.updateUser(userId, { photoURL });
      } catch (authError: any) {
        console.warn('⚠️ Could not update Auth profile photoURL:', authError.message);
      }
      
      const pUpdate = { photoURL, updatedAt, updatedBy: updatedBy || 'system' };
      await db.collection('users').doc(userId).set(pUpdate, { merge: true });
      await db.collection('admins').doc(userId).set(pUpdate, { merge: true }).catch(() => null);
      await db.collection('user_profiles').doc(userId).set(pUpdate, { merge: true }).catch(() => null);
      return NextResponse.json({ success: true, message: 'Photo updated successfully' });
    }
   return NextResponse.json({ error: 'No photoURL provided' }, { status: 400 });
 }

 // Calculate final business ID from assignments if empty
 let finalBusinessId = butcherId;
 let finalBusinessName = butcherName;
 
 if (!finalBusinessId && assignments && Array.isArray(assignments) && assignments.length > 0) {
 const firstBusiness = assignments.find((a: any) => a.entityType === 'business' || a.type === 'business');
 if (firstBusiness) {
 finalBusinessId = firstBusiness.id;
 finalBusinessName = firstBusiness.entityName || firstBusiness.name;
 } else {
 const firstKermes = assignments.find((a: any) => a.entityType === 'kermes' || a.type === 'kermes');
 if (firstKermes) {
 finalBusinessId = firstKermes.id;
 finalBusinessName = firstKermes.entityName || firstKermes.name;
 }
 }
 }

 // 1. Update Firebase Auth User
 const authUpdatePayload: any = {};
 if (email) authUpdatePayload.email = email;
 if (password && password.trim() !== '') authUpdatePayload.password = password;
 if (displayName) authUpdatePayload.displayName = displayName;
 if (phoneNumber) {
 const cleanedPhone = phoneNumber.replace(/[^0-9+]/g, '');
 authUpdatePayload.phoneNumber = cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`;
 }
 if (isActive !== undefined) {
   authUpdatePayload.disabled = !isActive;
 }
 
 if (Object.keys(authUpdatePayload).length > 0) {
 try {
 await auth.updateUser(userId, authUpdatePayload);
  } catch (authError: any) {
  console.error(`[UPDATE_USER] ❌ Failed to update Firebase Auth user (${userId}):`, authError);
  if (authError.message?.includes('Could not load the default credentials')) {
   console.warn(`[UPDATE_USER] ⚠️ Bypassing Auth Application Default Credentials error for user ${userId} to allow Firestore update.`);
  } else {
   console.warn(`[UPDATE_USER] ⚠️ Partial Success: Firebase Auth update failed for ${userId}, but proceeding with Firestore updates. Auth Error: ${authError.message}`);
  }
  }
 }

 // Fetch old user data to detect assignment changes
 const userRef = db.collection('users').doc(userId);
 const userDocSnapshot = await userRef.get();
 const oldUserData = userDocSnapshot.exists ? userDocSnapshot.data() : null;

 // 2. Update Firestore `users` Document
 const userUpdateData: any = {
 isActive: isActive !== false, // default true
 isAdmin: isAdmin !== undefined ? isAdmin : false,
 updatedAt,
 updatedBy: updatedBy || 'system'
 };

 if (firstName !== undefined) userUpdateData.firstName = firstName;
 if (lastName !== undefined) userUpdateData.lastName = lastName;
 if (displayName !== undefined) userUpdateData.displayName = displayName;
 if (email !== undefined) userUpdateData.email = email;
 if (phoneNumber !== undefined) {
   userUpdateData.phoneNumber = phoneNumber;
   userUpdateData.phone = phoneNumber;
 }
 if (dialCode !== undefined) userUpdateData.dialCode = dialCode;
 if (address !== undefined) userUpdateData.address = address;
 if (houseNumber !== undefined) userUpdateData.houseNumber = houseNumber;
 if (addressLine2 !== undefined) userUpdateData.addressLine2 = addressLine2;
 if (city !== undefined) userUpdateData.city = city;
 if (country !== undefined) userUpdateData.country = country;
 if (postalCode !== undefined) userUpdateData.postalCode = postalCode;
 if (latitude !== undefined) userUpdateData.latitude = latitude;
 if (longitude !== undefined) userUpdateData.longitude = longitude;
 if (photoURL !== undefined) userUpdateData.photoURL = photoURL;
 if (finalBusinessId !== undefined) {
   userUpdateData.butcherId = finalBusinessId;
   userUpdateData.businessId = finalBusinessId;
 }
 if (finalBusinessName !== undefined) {
   userUpdateData.butcherName = finalBusinessName;
   userUpdateData.businessName = finalBusinessName;
 }
 if (isAdmin !== undefined) {
   userUpdateData.adminType = isAdmin ? (adminType !== undefined ? adminType : null) : null;
 }
  if (assignments !== undefined) {
    userUpdateData.assignments = assignments;
    userUpdateData.kermesAssignments = assignments.filter((a: any) => a.entityType === 'kermes' || a.type === 'kermes').map((a: any) => ({
      kermesId: a.id,
      role: a.role,
      assignedAt: a.assignedAt || new Date().toISOString()
    }));
  }
 if (kermesAllowedSections !== undefined) userUpdateData.kermesAllowedSections = kermesAllowedSections;
 if (gender !== undefined) userUpdateData.gender = gender;

 if (isActive === false) {
 userUpdateData.deactivatedBy = deactivatedBy || 'system';
 userUpdateData.deactivatedAt = deactivatedAt ? new Date(deactivatedAt) : updatedAt;
 userUpdateData.deactivationReason = deactivationReason || null;
 } else if (isActive === true) {
 userUpdateData.deactivatedBy = null;
 userUpdateData.deactivatedAt = null;
 userUpdateData.deactivationReason = null;
 }

 await db.collection('users').doc(userId).set(userUpdateData, { merge: true });

 // 2.5. Personnel Assignment Notification Logic
 try {
   if (oldUserData) {
     const oldAssignments = oldUserData.assignments || [];
     const newAssignments = assignments || [];
     const addedAssignments = newAssignments.filter((a: any) => 
       !oldAssignments.some((oa: any) => oa.id === a.id && oa.role === a.role)
     );

     const oldPrepZones = oldUserData.kermesAllowedSections || [];
     const newPrepZones = kermesAllowedSections || [];
     const addedPrepZones = newPrepZones.filter((z: string) => !oldPrepZones.includes(z));

     const assigner = updatedBy ? updatedBy.split('@')[0] : 'Yönetici';
     const nowIso = new Date().toISOString();
     const notificationsRef = db.collection('users').doc(userId).collection('personnel_notifications');

     const fcmToken = oldUserData.customerFcmToken || oldUserData.fcmToken;
     const messaging = require('@/lib/firebase-admin').getFirebaseMessaging();

     for (const a of addedAssignments) {
       const title = "Yeni Görev Ataması";
       const body = `Şu kişi (${assigner}) tarafından "${a.entityName || 'Kermes'}" kermesinde "${a.role}" görevine atandınız.`;
       
       const notifData = {
         title,
         body,
         type: 'kermes_assignment',
         createdAt: nowIso,
         read: false
       };
       await notificationsRef.add(notifData);

       if (fcmToken && messaging) {
         await messaging.send({
           token: fcmToken,
           notification: { title, body },
           data: { type: 'kermes_assignment' }
         }).catch((err: any) => console.log("FCM Warning:", err));
       }
     }

     for (const z of addedPrepZones) {
       const title = "Yeni Ocakbaşı Ataması";
       const body = `Şu kişi (${assigner}) tarafından "${z}" ocakbaşı görevine atandınız.`;
       
       const notifData = {
         title,
         body,
         type: 'kermes_assignment',
         createdAt: nowIso,
         read: false
       };
       await notificationsRef.add(notifData);
       
       if (fcmToken && messaging) {
         await messaging.send({
           token: fcmToken,
           notification: { title, body },
           data: { type: 'kermes_assignment' }
         }).catch((err: any) => console.log("FCM Warning:", err));
       }
     }
   }
 } catch(notifError) {
   console.error('Notification error:', notifError);
 }

 // 3. Update Firestore `admins` Document if the user is an admin
 let roleChangedToAdmin = false;

 if (isAdmin && adminType) {
 const adminRef = db.collection('admins').doc(userId);
 const adminDoc = await adminRef.get();
 
 const adminUpdateData: any = {
 isActive: isActive !== false,
 updatedAt,
 updatedBy: updatedBy || 'system'
 };

 if (adminType !== undefined) {
   adminUpdateData.adminType = adminType;
   adminUpdateData.type = adminType; // For backward compatibility
 }
 if (displayName !== undefined) adminUpdateData.displayName = displayName;
 if (firstName !== undefined) adminUpdateData.firstName = firstName;
 if (lastName !== undefined) adminUpdateData.lastName = lastName;
 if (email !== undefined) adminUpdateData.email = email;
 if (phoneNumber !== undefined) {
   adminUpdateData.phoneNumber = phoneNumber;
   adminUpdateData.phone = phoneNumber;
 }
 if (finalBusinessId !== undefined) {
   adminUpdateData.butcherId = finalBusinessId;
   adminUpdateData.businessId = finalBusinessId;
 }
 if (finalBusinessName !== undefined) {
   adminUpdateData.butcherName = finalBusinessName;
   adminUpdateData.businessName = finalBusinessName;
 }
 if (organizationId !== undefined) adminUpdateData.organizationId = organizationId;
 if (organizationName !== undefined) adminUpdateData.organizationName = organizationName;
 if (photoURL !== undefined) adminUpdateData.photoURL = photoURL;
 if (gender !== undefined) adminUpdateData.gender = gender;

 if (roles !== undefined) {
 adminUpdateData.roles = roles;
 }

 if (isPrimaryAdmin !== undefined) {
 adminUpdateData.isPrimaryAdmin = isPrimaryAdmin;
 }

 if (isDriver !== undefined) {
 adminUpdateData.isDriver = isDriver;
 }

 if (driverType !== undefined) {
 adminUpdateData.driverType = driverType;
 }

 if (assignedBusinesses !== undefined) {
 adminUpdateData.assignedBusinesses = assignedBusinesses;
 }
 if (assignedBusinessNames !== undefined) {
 adminUpdateData.assignedBusinessNames = assignedBusinessNames;
 }

 if (assignedKermesEvents !== undefined) {
 adminUpdateData.assignedKermesEvents = assignedKermesEvents;
 }
 if (assignedKermesNames !== undefined) {
 adminUpdateData.assignedKermesNames = assignedKermesNames;
 }

  if (assignments !== undefined) {
    adminUpdateData.assignments = assignments;
    adminUpdateData.kermesAssignments = assignments.filter((a: any) => a.entityType === 'kermes' || a.type === 'kermes').map((a: any) => ({
      kermesId: a.id,
      role: a.role,
      assignedAt: a.assignedAt || new Date().toISOString()
    }));
  }

 if (kermesAllowedSections !== undefined) {
 adminUpdateData.kermesAllowedSections = kermesAllowedSections;
 }

 if (adminDoc.exists) {
 // Check if the admin was previously inactive or had a different type
 const prevData = adminDoc.data();
 if (prevData && (prevData.isActive === false || prevData.adminType !== adminType)) {
 roleChangedToAdmin = true;
 }
 await adminRef.update(adminUpdateData);
 } else {
 // New admin doc = user was promoted
 roleChangedToAdmin = true;
 adminUpdateData.createdAt = updatedAt;
 adminUpdateData.createdBy = updatedBy || 'system';
 adminUpdateData.firebaseUid = userId;
 adminUpdateData.role = 'admin';
 await adminRef.set(adminUpdateData);
 }
 } else if (!isAdmin) {
 const adminRef = db.collection('admins').doc(userId);
 const adminDoc = await adminRef.get();
 
 if (isDriver) {
 // Sadece sürücü olan kullanıcı (geleneksel admin değil)
 const driverUpdateData: any = {
 isDriver: true,
 driverType: driverType !== undefined ? driverType : 'business',
 isActive: true,
 updatedAt,
 updatedBy: updatedBy || 'system'
 };
 
 if (assignedBusinesses !== undefined) driverUpdateData.assignedBusinesses = assignedBusinesses;
 if (assignedKermesEvents !== undefined) driverUpdateData.assignedKermesEvents = assignedKermesEvents;
  if (assignments !== undefined) {
    driverUpdateData.assignments = assignments;
    driverUpdateData.kermesAssignments = assignments.filter((a: any) => a.entityType === 'kermes' || a.type === 'kermes').map((a: any) => ({
      kermesId: a.id,
      role: a.role,
      assignedAt: a.assignedAt || new Date().toISOString()
    }));
  }
 if (kermesAllowedSections !== undefined) driverUpdateData.kermesAllowedSections = kermesAllowedSections;
 
 if (adminDoc.exists) {
 await adminRef.update(driverUpdateData);
 } else {
 driverUpdateData.createdAt = updatedAt;
 driverUpdateData.createdBy = updatedBy || 'system';
 driverUpdateData.firebaseUid = userId;
 driverUpdateData.role = 'admin';
 driverUpdateData.email = email || null;
 driverUpdateData.displayName = displayName || null;
 driverUpdateData.firstName = firstName || null;
 driverUpdateData.lastName = lastName || null;
 driverUpdateData.businessId = butcherId || null;
 driverUpdateData.businessName = butcherName || null;
  driverUpdateData.butcherId = butcherId || null;
  driverUpdateData.butcherName = butcherName || null;
  driverUpdateData.gender = gender !== undefined ? gender : null;
  driverUpdateData.roles = roles || ['driver'];
 await adminRef.set(driverUpdateData);
 }
 } else {
  if (adminDoc.exists) {
  await adminRef.update({
  isActive: false,
  isDriver: false,
  updatedAt,
  updatedBy: updatedBy || 'system',
  deactivationReason: 'Admin role removed',
  // Clear all role and assignment fields
  assignedBusinesses: [],
  assignedBusinessNames: [],
  assignedKermesEvents: [],
  assignedKermesNames: [],
  assignments: [],
  kermesAssignments: [],
  kermesAllowedSections: [],
  roles: ['customer'],
  adminType: null,
  butcherId: null,
  butcherName: null,
  businessId: null,
  businessName: null
  });
  }
  }
 }

 // If not admin, also ensure users doc clears redundant fields
 if (!isAdmin && !isDriver) {
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
        assignedBusinesses: [],
        assignedBusinessNames: [],
        assignedKermesEvents: [],
        assignedKermesNames: [],
        assignments: [],
        kermesAssignments: [],
        kermesAllowedSections: [],
        roles: ['customer']
    });
 }

 return NextResponse.json({
 success: true,
 message: 'User profile updated successfully',
 roleChangedToAdmin
 });

 } catch (error: unknown) {
 console.error('Update user error:', error);
 const errMessage = error instanceof Error ? error.message : String(error);
 return NextResponse.json(
 { error: errMessage },
 { status: 500 }
 );
 }
}
