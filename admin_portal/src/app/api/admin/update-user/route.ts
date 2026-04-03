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

 let auth: any, db: any;
 try {
 const admin = await getFirebaseAdmin();
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
 kermesAllowedSections
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

 // Calculate final business ID from assignments if empty
 let finalBusinessId = butcherId;
 let finalBusinessName = butcherName;
 
 if (!finalBusinessId && assignments && Array.isArray(assignments) && assignments.length > 0) {
 const firstBusiness = assignments.find((a: any) => a.type === 'business');
 if (firstBusiness) {
 finalBusinessId = firstBusiness.id;
 finalBusinessName = firstBusiness.name;
 } else {
 const firstKermes = assignments.find((a: any) => a.type === 'kermes');
 if (firstKermes) {
 finalBusinessId = firstKermes.id;
 finalBusinessName = firstKermes.name;
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
 
 if (Object.keys(authUpdatePayload).length > 0) {
 try {
 await auth.updateUser(userId, authUpdatePayload);
 } catch (authError: any) {
 console.error('Failed to update auth user:', authError);
 return NextResponse.json(
 { error: `Kimlik doğrulama güncellenirken hata oluştu: ${authError.message}` },
 { status: 400 }
 );
 }
 }

 const updatedAt = new Date();

 // 2. Update Firestore `users` Document
 const userUpdateData: any = {
 firstName: firstName !== undefined ? firstName : null,
 lastName: lastName !== undefined ? lastName : null,
 displayName: displayName !== undefined ? displayName : null,
 email: email !== undefined ? email : null,
 phoneNumber: phoneNumber !== undefined ? phoneNumber : null,
 dialCode: dialCode !== undefined ? dialCode : '+49',
 address: address !== undefined ? address : null,
 houseNumber: houseNumber !== undefined ? houseNumber : null,
 addressLine2: addressLine2 !== undefined ? addressLine2 : null,
 city: city !== undefined ? city : null,
 country: country !== undefined ? country : null,
 postalCode: postalCode !== undefined ? postalCode : null,
 latitude: latitude !== undefined ? latitude : null,
 longitude: longitude !== undefined ? longitude : null,
 photoURL: photoURL !== undefined ? photoURL : null,
 butcherId: finalBusinessId !== undefined ? finalBusinessId : null,
 butcherName: finalBusinessName !== undefined ? finalBusinessName : null,
 businessId: finalBusinessId !== undefined ? finalBusinessId : null,
 businessName: finalBusinessName !== undefined ? finalBusinessName : null,
 isAdmin: isAdmin !== undefined ? isAdmin : false,
 adminType: isAdmin ? (adminType !== undefined ? adminType : null) : null,
 assignments: assignments !== undefined ? assignments : [],
 kermesAllowedSections: kermesAllowedSections !== undefined ? kermesAllowedSections : [],
 isActive: isActive !== false, // default true
 updatedAt,
 updatedBy: updatedBy || 'system'
 };

 if (isActive === false) {
 userUpdateData.deactivatedBy = deactivatedBy || 'system';
 userUpdateData.deactivatedAt = deactivatedAt ? new Date(deactivatedAt) : updatedAt;
 userUpdateData.deactivationReason = deactivationReason || null;
 } else {
 userUpdateData.deactivatedBy = null;
 userUpdateData.deactivatedAt = null;
 userUpdateData.deactivationReason = null;
 }

 await db.collection('users').doc(userId).set(userUpdateData, { merge: true });

 // 3. Update Firestore `admins` Document if the user is an admin
 let roleChangedToAdmin = false;

 if (isAdmin && adminType) {
 const adminRef = db.collection('admins').doc(userId);
 const adminDoc = await adminRef.get();
 
 const adminUpdateData: any = {
 adminType: adminType,
 type: adminType, // For backward compatibility
 displayName: displayName !== undefined ? displayName : null,
 firstName: firstName !== undefined ? firstName : null,
 lastName: lastName !== undefined ? lastName : null,
 email: email !== undefined ? email : null,
 phoneNumber: phoneNumber !== undefined ? phoneNumber : null,
 butcherId: finalBusinessId !== undefined ? finalBusinessId : null,
 butcherName: finalBusinessName !== undefined ? finalBusinessName : null,
 businessId: finalBusinessId !== undefined ? finalBusinessId : null,
 businessName: finalBusinessName !== undefined ? finalBusinessName : null,
 organizationId: organizationId !== undefined ? organizationId : null,
 organizationName: organizationName !== undefined ? organizationName : null,
 photoURL: photoURL !== undefined ? photoURL : null,
 isActive: isActive !== false,
 updatedAt,
 updatedBy: updatedBy || 'system'
 };

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
 if (assignments !== undefined) driverUpdateData.assignments = assignments;
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
 deactivationReason: 'Admin role removed'
 });
 }
 }
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
