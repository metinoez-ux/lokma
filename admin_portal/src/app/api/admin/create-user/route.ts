export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend } from '@/lib/resend-email';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {

 // 🔍 DEBUG: Early error catching
 let body: any;
 try {
 body = await request.json();
 } catch (parseError) {
 console.error('🚨 CRITICAL: Failed to parse request body:', parseError);
 return NextResponse.json(
 { error: 'Geçersiz istek gövdesi', debug: String(parseError) },
 { status: 400 }
 );
 }

 // 🔍 DEBUG: Check Firebase Admin init
 let auth: any, db: any;
 try {
 const admin = await getFirebaseAdmin();
 auth = admin.auth;
 db = admin.db;
 } catch (initError: any) {
 console.error('🚨 CRITICAL: Firebase Admin init failed:', initError);
 // Expose the actual error to the client for debugging
 return NextResponse.json(
 { error: `Sunucu Hatası: ${initError.message || String(initError)}`, debug: String(initError) },
 { status: 500 }
 );
 }

 try {
 const {
 email, password, displayName, phone, dialCode, gender,
 firstName: bodyFirstName, lastName: bodyLastName,
 address, houseNumber, addressLine2, city, country, postalCode,
 role, adminType, location, createdBy, isPrimaryAdmin,
 // 🔑 UNIVERSAL BUSINESS FIELDS (accept both new and legacy names)
 businessId: bodyBusinessId, businessName: bodyBusinessName, businessType: bodyBusinessType,
 butcherId: legacyButcherId, butcherName: legacyButcherName, // Legacy support
 // 🚗 Driver fields
 isDriver: bodyIsDriver, driverType: bodyDriverType, assignedBusinesses, assignedKermesEvents,
 // Assigner details for welcome email
 assignerName, assignerEmail, assignerPhone, assignerRole,
 // Locale for email content
 locale: requestLocale,
 // Array of workspace assignments (M:N)
 assignments,
 } = body;

 // Resolve locale (default German for DACH market)
 const emailLocale = requestLocale || 'de';

 // Resolve business ID - prefer new name, fallback to legacy
 const businessId = bodyBusinessId || legacyButcherId;
 const businessName = bodyBusinessName || legacyButcherName;
 const businessType = bodyBusinessType || adminType?.replace('_staff', '').replace('_admin', '');

 // 🔍 DEBUG: Log all received values
 console.log('🔍 CREATE-USER API DEBUG:', {
 receivedBusinessId: bodyBusinessId,
 receivedButcherId: legacyButcherId,
 resolvedBusinessId: businessId,
 resolvedBusinessName: businessName,
 resolvedBusinessType: businessType,
 role,
 adminType,
 email,
 displayName,
 });

 // Validate required fields
 // Email OR Phone must be provided (at least one contact method)
 if (!email && !phone) {
 return NextResponse.json(
 { error: 'E-posta veya telefon numarasından en az biri zorunludur' },
 { status: 400 }
 );
 }

 if (!password || !displayName) {
 return NextResponse.json(
 { error: 'Şifre ve isim zorunludur' },
 { status: 400 }
 );
 }

 // Validate password length
 if (password.length < 6) {
 return NextResponse.json(
 { error: 'Şifre en az 6 karakter olmalıdır' },
 { status: 400 }
 );
 }

 // For ALL business admin roles, businessId is required
 // Only super admin and regular 'user' roles don't need a business assignment
 const needsBusinessAssignment = role === 'admin' && adminType && adminType !== 'super';
 if (needsBusinessAssignment && !businessId && (!assignments || assignments.length === 0)) {
 return NextResponse.json(
 {
 error: `İşletme rolleri için işletme seçimi zorunludur. [DEBUG: role = ${role}, adminType = ${adminType}, businessId = ${businessId || 'MISSING'}]`,
 debug: {
 role,
 adminType,
 businessId: businessId || null,
 businessName: businessName || null,
 needsBusinessAssignment,
 receivedFields: Object.keys(body)
 }
 },
 { status: 400 }
 );
 }

 // 🛑 PERSONNEL LIMIT ENFORCEMENT
 if (businessId && role === 'admin' && adminType !== 'super') {
 const businessDoc = await db.collection('businesses').doc(businessId).get();
 if (businessDoc.exists) {
 const businessData = businessDoc.data();
 const planId = businessData?.subscriptionPlan || businessData?.plan || 'free';

 let personnelLimit: number | null = null;
 let personnelOverageFee = 0;

 const planDoc = await db.collection('plans').doc(planId).get();
 if (planDoc.exists) {
 const planData = planDoc.data();
 personnelLimit = planData?.personnelLimit ?? null;
 personnelOverageFee = planData?.personnelOverageFee ?? 0;
 } else {
 if (planId === 'free') { personnelLimit = 1; personnelOverageFee = 5; }
 else if (planId === 'basic') { personnelLimit = 3; personnelOverageFee = 5; }
 else if (planId === 'premium') { personnelLimit = null; personnelOverageFee = 0; }
 }

 if (personnelLimit !== null) {
 const adminsSnapshot = await db.collection('admins')
 .where('businessId', '==', businessId)
 .where('isActive', '==', true)
 .get();

 const currentCount = adminsSnapshot.size;

 if (currentCount >= personnelLimit && personnelOverageFee <= 0) {
 return NextResponse.json(
 { error: `Maksimum personel limitine (${personnelLimit}) ulaştınız. Yeni personel eklemek için paketinizi yükseltin veya aşım ücretine izin verin.` },
 { status: 403 }
 );
 }
 }
 }
 }

 // auth and db are already initialized above

 // Prepare phone number in E.164 format if provided
 let formattedPhone: string | undefined = undefined;
 if (phone) {
 // Clean phone number (remove non-digits)
 const cleanedPhone = phone.replace(/\D/g, '');
 // Remove leading zero from local number (e.g. 01775710057 -> 1775710057)
 const localNumber = cleanedPhone.replace(/^0+/, '');
 
 if (localNumber.length >= 7) {
 if (dialCode) {
 // Combine dialCode with local number: +49 + 1775710057 = +491775710057
 const cleanDialCode = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
 formattedPhone = `${cleanDialCode}${localNumber}`;
 } else {
 // No dialCode provided, assume the number already includes country code
 formattedPhone = `+${localNumber}`;
 }
 }
 }

 // If no email is provided, generate a pseudo-email based on the phone number
 // This ensures the user can always log in via Email/Password provider
 const finalEmail = email || (formattedPhone ? `${formattedPhone.replace('+', '')}@lokma.shop` : undefined);

 // Create user in Firebase Auth
 // Email OR phone is required, but both are optional individually
 const userRecord = await auth.createUser({
 email: finalEmail,
 password,
 displayName,
 emailVerified: false,
 phoneNumber: formattedPhone,
 });

 // Use provided firstName/lastName or parse from displayName
 const nameParts = displayName.trim().split(' ');
 const firstName = bodyFirstName || nameParts[0] || '';
 const lastName = bodyLastName || nameParts.slice(1).join(' ') || '';

 // Create user document in Firestore
 await db.collection('users').doc(userRecord.uid).set({
 email: finalEmail || null,
 displayName,
 firstName,
 lastName,
 gender: gender || null,
 createdAt: new Date().toISOString(),
 location: location || null,
 phoneNumber: formattedPhone || phone || null,
 dialCode: dialCode || null,
 // Address fields
 address: address || null,
 houseNumber: houseNumber || null,
 addressLine2: addressLine2 || null,
 city: city || null,
 country: country || null,
 postalCode: postalCode || null,
 photoURL: null,
 // Assignments
 assignments: assignments || [],
 // Audit tracking
 createdBy: createdBy || 'system',
 createdBySource: body.createdBySource || 'super_admin',
 isActive: true,
 requirePasswordChange: true, // 🔒 Force password reset on first login
 });

 // If admin role is assigned, create admin document
 if (role === 'admin' && adminType) {
 const adminData: Record<string, unknown> = {
 email: finalEmail || null,
 displayName,
 firstName,
 lastName,
 phoneNumber: formattedPhone || phone || null,
 dialCode: dialCode || null,
 role: 'admin',
 adminType,
 location: location || null,
 permissions: [],
 isActive: true,
 createdAt: new Date().toISOString(),
 createdBy: createdBy || 'system',
 firebaseUid: userRecord.uid, // Link to Firebase Auth user
 requirePasswordChange: true, // 🔒 Shared flag in admin doc
 };

 // 🔑 UNIVERSAL BUSINESS ASSIGNMENT (Sector-agnostic)
 // Store businessId for ALL business admin types
 if (businessId) {
 // PRIMARY: Universal business fields
 adminData.businessId = businessId;
 adminData.businessName = businessName || null;
 adminData.businessType = businessType || null;

 // LEGACY: Keep butcherId for backward compatibility with existing code
 adminData.butcherId = businessId;
 adminData.butcherName = businessName || null;
 }

 // 🟣 Mark as Primary Admin if assigned by Super Admin (protected from deletion/demotion)
 if (isPrimaryAdmin === true) {
 adminData.isPrimaryAdmin = true;
 }

 // Track who assigned this role (for audit and welcome email)
 if (assignerName) {
 adminData.assignedBy = {
 name: assignerName,
 email: assignerEmail || null,
 phone: assignerPhone || null,
 role: assignerRole || null,
 };
 }

 // Auto-detect driver roles from adminType (server-side consistency)
 const DRIVER_ADMIN_TYPES = ['teslimat'];
 if (DRIVER_ADMIN_TYPES.includes(adminType || '')) {
 adminData.isDriver = true;
 adminData.driverType = bodyDriverType || 'business';
 if (assignedBusinesses !== undefined) adminData.assignedBusinesses = assignedBusinesses;
 if (assignedKermesEvents !== undefined) adminData.assignedKermesEvents = assignedKermesEvents;
 } else if (bodyIsDriver) {
 adminData.isDriver = true;
 adminData.driverType = bodyDriverType || 'business';
 if (assignedBusinesses !== undefined) adminData.assignedBusinesses = assignedBusinesses;
 if (assignedKermesEvents !== undefined) adminData.assignedKermesEvents = assignedKermesEvents;
 }

 if (assignments !== undefined) {
 adminData.assignments = assignments;
 }

 await db.collection('admins').doc(userRecord.uid).set(adminData);
 }

 // 🚗 If driver role is assigned (without admin role), create admin doc with driver fields
 if (bodyIsDriver && !(role === 'admin' && adminType)) {
 const driverAdminData: Record<string, unknown> = {
 email: finalEmail || null,
 displayName,
 firstName,
 lastName,
 phoneNumber: formattedPhone || phone || null,
 dialCode: dialCode || null,
 role: 'admin',
 isDriver: true,
 driverType: bodyDriverType || 'business',
 isActive: true,
 createdAt: new Date().toISOString(),
 createdBy: createdBy || 'system',
 firebaseUid: userRecord.uid,
 requirePasswordChange: true, // 🔒 Shared flag in admin doc
 };

 if (businessId) {
 driverAdminData.businessId = businessId;
 driverAdminData.businessName = businessName || null;
 driverAdminData.businessType = businessType || null;
 }

 if (assignments !== undefined) {
 driverAdminData.assignments = assignments;
 }

 if (assignerName) {
 driverAdminData.assignedBy = {
 name: assignerName,
 email: assignerEmail || null,
 phone: assignerPhone || null,
 role: assignerRole || null,
 };
 }

 if (assignedBusinesses !== undefined) driverAdminData.assignedBusinesses = assignedBusinesses;
 if (assignedKermesEvents !== undefined) driverAdminData.assignedKermesEvents = assignedKermesEvents;

 await db.collection('admins').doc(userRecord.uid).set(driverAdminData);
 }

 // If admin role WITH driver flag, add driver fields to existing admin record
 if (bodyIsDriver && role === 'admin' && adminType) {
 const updateProps: Record<string, any> = {
 isDriver: true,
 driverType: bodyDriverType || 'business',
 };
 if (assignedBusinesses !== undefined) updateProps.assignedBusinesses = assignedBusinesses;
 if (assignedKermesEvents !== undefined) updateProps.assignedKermesEvents = assignedKermesEvents;
 
 await db.collection('admins').doc(userRecord.uid).update(updateProps);
 }

 // ═══════════════════════════════════════════════════════════════════════
 // SEND WELCOME NOTIFICATIONS (Email + SMS)
 // ═══════════════════════════════════════════════════════════════════════

 const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

 // Determine email type and content based on role
 const isAdminOrStaff = role === 'admin' && adminType;
 const businessDisplayName = businessName || 'LOKMA'; // Business name or LOKMA for super admin

 // Get assigner role display name
 const assignerRoleDisplay = assignerRole === 'super' ? 'Super Admin' :
 assignerRole === 'kasap' ? 'Kasap Admin' :
 assignerRole === 'restoran' ? 'Restoran Admin' :
 assignerRole === 'kermes' ? 'Kermes Admin' :
 assignerRole === 'market' ? 'Market Admin' :
 assignerRole || 'Admin';

 // Get new user role display name (extended for all business types)
 const roleDisplayName = adminType === 'kasap' ? 'Kasap Admin' :
 adminType === 'kasap_staff' ? 'Kasap Personel' :
 adminType === 'restoran' ? 'Restoran Admin' :
 adminType === 'restoran_staff' ? 'Restoran Personel' :
 adminType === 'kermes' ? 'Kermes Admin' :
 adminType === 'market' ? 'Market Admin' :
 adminType === 'market_staff' ? 'Market Personel' :
 adminType === 'cicekci' ? 'Cicekci Admin' :
 adminType === 'super' ? 'Super Admin' :
 adminType?.includes('_staff') ? 'Personel' :
 adminType || 'Personel';

 // 1. Send Welcome Email via API
 let emailSent = false;
 let emailError = null;

 if (email) {
 try {
 // ══════════════════════════════════════════════════════
 // LOCALIZED EMAIL STRINGS
 // ══════════════════════════════════════════════════════
 const emailStrings: Record<string, Record<string, string>> = {
 de: {
 staffSubject: `${businessDisplayName} - Ihre neue Berechtigung`,
 staffGreeting: `Hallo ${firstName}!`,
 staffIntro: `Sie wurden als <strong>${roleDisplayName}</strong> zugewiesen.`,
 assignedBy: 'Zugewiesen von',
 assignerLabelName: 'Name',
 assignerLabelRole: 'Rolle',
 assignerLabelEmail: 'E-Mail',
 assignerLabelPhone: 'Telefon',
 detailsTitle: 'Zuweisungsdetails',
 businessLabel: 'Unternehmen',
 roleLabel: 'Ihre Rolle',
 credTitle: 'Ihre Zugangsdaten',
 emailLabel: 'E-Mail',
 passLabel: 'Passwort',
 tempPasswordLabel: 'Temporaeres Passwort',
 passWarning: 'Bitte aendern Sie Ihr Passwort umgehend nach dem ersten Login!',
 loginBtn: 'Zum Portal',
 footer1: 'Diese E-Mail wurde automatisch ueber die LOKMA-Plattform gesendet.',
 footer2: 'Alle Rechte vorbehalten.',
 customerSubject: 'Willkommen bei LOKMA!',
 customerGreeting: `Hallo ${firstName}!`,
 customerIntro: 'Willkommen bei LOKMA! Ihr Konto wurde erfolgreich erstellt.',
 },
 en: {
 staffSubject: `${businessDisplayName} - Your New Permission`,
 staffGreeting: `Hello ${firstName}!`,
 staffIntro: `You have been assigned as <strong>${roleDisplayName}</strong>.`,
 assignedBy: 'Assigned by',
 assignerLabelName: 'Name',
 assignerLabelRole: 'Role',
 assignerLabelEmail: 'Email',
 assignerLabelPhone: 'Phone',
 detailsTitle: 'Assignment Details',
 businessLabel: 'Business',
 roleLabel: 'Your Role',
 credTitle: 'Your Login Credentials',
 emailLabel: 'Email',
 passLabel: 'Password',
 tempPasswordLabel: 'Temporary Password',
 passWarning: 'Please change your password immediately after your first login!',
 loginBtn: 'Go to Portal',
 footer1: 'This email was sent automatically via the LOKMA platform.',
 footer2: 'All rights reserved.',
 customerSubject: 'Welcome to LOKMA!',
 customerGreeting: `Hello ${firstName}!`,
 customerIntro: 'Welcome to LOKMA! Your account has been created successfully.',
 },
 tr: {
 staffSubject: `${businessDisplayName} - Yeni Yetkiniz`,
 staffGreeting: `Merhaba ${firstName}!`,
 staffIntro: `Sizi <strong>${roleDisplayName}</strong> olarak atadik.`,
 assignedBy: 'Sizi Atayan Kisi',
 assignerLabelName: 'Isim',
 assignerLabelRole: 'Rol',
 assignerLabelEmail: 'E-posta',
 assignerLabelPhone: 'Telefon',
 detailsTitle: 'Atama Detaylari',
 businessLabel: 'Isletme',
 roleLabel: 'Sizin Rolunuz',
 credTitle: 'Giris Bilgileriniz',
 emailLabel: 'E-posta',
 passLabel: 'Sifre',
 tempPasswordLabel: 'Gecici Sifre',
 passWarning: 'Lutfen ilk girisinizde sifrenizi hemen degistirin!',
 loginBtn: 'Panele Giris Yap',
 footer1: 'Bu e-posta LOKMA platformu uzerinden otomatik olarak gonderilmistir.',
 footer2: 'Tum haklari saklidir.',
 customerSubject: 'LOKMA Ailesine Hos Geldiniz!',
 customerGreeting: `Merhaba ${firstName}!`,
 customerIntro: 'LOKMA ailesine hos geldiniz! Hesabiniz basariyla olusturuldu.',
 },
 };

 const s = emailStrings[emailLocale] || emailStrings.de;
 const logoUrl = `${baseUrl}/lokma_logo_new_red.png`;

 let emailSubject: string;
 let emailHtml: string;

 if (isAdminOrStaff) {
 // ══════════════════════════════════════════════════════
 // ADMIN/STAFF WELCOME EMAIL - BRANDED DARK THEME
 // ══════════════════════════════════════════════════════
 emailSubject = s.staffSubject;
 emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;">
<div style="background-color:#f9fafb;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -1px rgba(0,0,0,0.03);border:1px solid #f3f4f6;">

<!-- Header with Logo -->
<div style="padding:40px 40px 24px 40px;text-align:center;">
 <img src="${logoUrl}" alt="LOKMA" style="height:32px;margin-bottom:8px;" />
 <p style="color:#6b7280;margin:0;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">${businessDisplayName}</p>
</div>

<!-- Main Body -->
<div style="padding:0 40px 32px 40px;">
 <h2 style="color:#111827;margin:0 0 12px 0;font-size:24px;font-weight:700;">${s.staffGreeting}</h2>
 <p style="color:#4b5563;line-height:1.6;margin:0 0 24px 0;font-size:16px;">${s.staffIntro}</p>

 <div style="background-color:#f9fafb;border-radius:8px;padding:24px;margin-bottom:24px;border:1px solid #f3f4f6;">
 <!-- Assignment Details -->
 <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
 ${assignerName ? `
 <tr>
 <td style="padding:0 0 8px 0;color:#6b7280;font-size:13px;width:120px;">${s.assignedBy}</td>
 <td style="padding:0 0 8px 0;color:#111827;font-size:14px;font-weight:500;">${assignerName} ${assignerRoleDisplay ? `<span style="color:#9ca3af;font-weight:normal;">(${assignerRoleDisplay})</span>` : ''}</td>
 </tr>` : ''}
 <tr>
 <td style="padding:0 0 8px 0;color:#6b7280;font-size:13px;width:120px;">${s.roleLabel}</td>
 <td style="padding:0 0 8px 0;color:#111827;font-size:14px;font-weight:500;">${roleDisplayName}</td>
 </tr>
 </table>

 <div style="height:1px;background-color:#e5e7eb;margin:16px 0;"></div>

 <!-- Credentials -->
 <p style="margin:0 0 12px 0;color:#111827;font-weight:600;font-size:14px;">${s.credTitle}</p>
 <table style="width:100%;border-collapse:collapse;">
 <tr>
 <td style="padding:0 0 8px 0;color:#6b7280;font-size:13px;width:120px;">${s.emailLabel}</td>
 <td style="padding:0 0 8px 0;color:#111827;font-size:15px;font-weight:600;">${email}</td>
 </tr>
 <tr>
 <td style="padding:0;color:#6b7280;font-size:13px;">${s.passLabel}</td>
 <td style="padding:0;">
 <span style="background-color:#f3f4f6;color:#111827;padding:4px 8px;border-radius:4px;font-size:15px;font-family:monospace;letter-spacing:1px;font-weight:600;">${password}</span>
 <div style="font-size:11px;color:#dc2626;margin-top:4px;font-weight:600;">(${s.tempPasswordLabel})</div>
 </td>
 </tr>
 </table>
 </div>

 <p style="margin:0 0 32px 0;color:#dc2626;font-size:13px;font-weight:500;">
 ${s.passWarning}
 </p>

 <!-- CTA Button -->
 <div style="text-align:center;">
 <a href="${baseUrl}/login" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">${s.loginBtn}</a>
 </div>
</div>

</div>

<!-- Footer -->
<div style="text-align:center;margin-top:24px;padding:0 20px;">
 <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;line-height:1.5;">
 ${s.footer1}<br/>
 <strong>${assignerName ? `${assignerName} &middot; ` : ''}${businessDisplayName}</strong>
 </p>
 <p style="color:#9ca3af;font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} LOKMA &middot; ${s.footer2}</p>
</div>

</div>
</body>
</html>`;
 } else {
 // ══════════════════════════════════════════════════════
 // CUSTOMER WELCOME EMAIL - BRANDED DARK THEME
 // ══════════════════════════════════════════════════════
 emailSubject = s.customerSubject;
 emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;">
<div class="email-body" style="background-color:#111827;padding:32px 16px;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;">

<!-- Header with Logo -->
<div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;border-radius:16px 16px 0 0;text-align:center;">
 <img src="${logoUrl}" alt="LOKMA" style="height:36px;margin-bottom:4px;" />
</div>

<!-- Main Card -->
<div class="email-card" style="background-color:#1f2937;padding:32px;border-radius:0 0 16px 16px;">
 <h2 class="text-primary" style="color:#f9fafb;margin:0 0 8px 0;font-size:22px;">${s.customerGreeting}</h2>
 <p class="text-secondary" style="color:#d1d5db;line-height:1.6;margin:0 0 24px 0;">${s.customerIntro}</p>

 <!-- Credentials -->
 <div class="cred-box" style="background-color:rgba(255,255,255,0.05);padding:20px;border-radius:10px;margin:0 0 16px 0;border:1px solid rgba(255,255,255,0.1);">
 <table style="width:100%;border-collapse:collapse;">
 <tr>
 <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:80px;">${s.emailLabel}</td>
 <td class="text-primary" style="padding:6px 0;color:#f3f4f6;font-size:14px;font-weight:600;">${email}</td>
 </tr>
 <tr>
 <td style="padding:6px 0;color:#9ca3af;font-size:13px;">${s.passLabel}</td>
 <td style="padding:6px 0;">
 <code style="background:rgba(239,68,68,0.15);color:#fca5a5;padding:4px 10px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:1px;">${password}</code>
 <div style="font-size:11px;color:#fca5a5;margin-top:4px;font-weight:700;">(${s.tempPasswordLabel})</div>
 </td>
 </tr>
 </table>
 </div>

 <!-- Password Change Warning -->
 <div class="warn-box" style="background-color:rgba(239,68,68,0.1);padding:14px 18px;border-radius:10px;margin:0 0 24px 0;border:1px solid rgba(239,68,68,0.3);">
 <p class="warn-text" style="margin:0;color:#fca5a5;font-size:13px;font-weight:700;text-align:center;">
 ${s.passWarning}
 </p>
 </div>

 <!-- CTA Button -->
 <div style="text-align:center;">
 <a href="${baseUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">${s.loginBtn}</a>
 </div>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:24px;">
 <p class="footer-text" style="color:#6b7280;font-size:11px;margin:0;">${s.footer1}</p>
 <p class="footer-text" style="color:#4b5563;font-size:10px;margin:8px 0 0 0;">&copy; 2026 LOKMA &middot; ${s.footer2}</p>
</div>

</div>
</div>
</body>
</html>`;
 }


 const emailResponse = await sendEmailWithResend({
 to: email,
 subject: emailSubject,
 html: emailHtml,
 });

 if (emailResponse.success) {
 emailSent = true;
 console.log(`✅ ${isAdminOrStaff ? 'Role assignment' : 'Welcome'} email sent successfully to:`, email);
 } else {
 emailError = emailResponse.error || 'Unknown error';
 console.error('❌ Email send failed:', emailError);
 }
 } catch (emailErr) {
 emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
 console.error('❌ Welcome email exception:', emailErr);
 // Don't fail the whole request if email fails
 }
 }



 // 2. Staff Onboarding via Firebase Phone Auth & Notifications
 const onboardingUrl = `${baseUrl}/login`;

 let whatsappSent = false;
 let whatsappError = null;
 let smsSent = false;
 let smsError = null;

 if (phone) {
 // Updated messages explaining Phone Auth logic based on user's feedback
 const businessNameText = businessName ? `${businessName} işletmesinde ` : '';
 const assignerText = assignerName ? `Sizi atayan: ${assignerName}\n\n` : '';
 
 // 2A. Send WhatsApp Message (Primary)
 try {
 const whatsappMessage = 
 `LOKMA - Merhaba ${firstName}!\n\n` +
 `Size ${businessNameText}${roleDisplayName} yetkisi verildi.\n\n` +
 `Uygulamaya telefon numaranızla giriş yaparak SMS doğrulama kodu alabilir ve kendi şifrenizi belirleyebilirsiniz.\n\n` +
 `Giriş Yap: ${onboardingUrl}\n\n` +
 assignerText + 
 `LOKMA Marketplace`;

 const whatsappResponse = await fetch(`${baseUrl}/api/whatsapp/send`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 to: formattedPhone || phone,
 message: whatsappMessage,
 templateType: 'custom',
 }),
 });

 if (whatsappResponse.ok) {
 whatsappSent = true;
 console.log('✅ WhatsApp onboarding sent successfully to:', phone);
 } else {
 const errorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown error' }));
 whatsappError = errorData.error || `WhatsApp API returned ${whatsappResponse.status}`;
 console.error('❌ WhatsApp send failed:', whatsappError);
 }
 } catch (whatsappErr) {
 whatsappError = whatsappErr instanceof Error ? whatsappErr.message : String(whatsappErr);
 console.error('❌ WhatsApp exception:', whatsappErr);
 }

 // 2B. Send SMS (Fallback or Secondary)
 try {
 const smsMessage = `LOKMA: Merhaba ${firstName}! ${businessNameText}${roleDisplayName} olarak atandiniz. Telefon numaranizla giris yapip sifrenizi belirlemek icin tiklayin: ${onboardingUrl}`;

 const smsResponse = await fetch(`${baseUrl}/api/sms/send`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 to: formattedPhone || phone,
 message: smsMessage,
 }),
 });

 if (smsResponse.ok) {
 smsSent = true;
 console.log('✅ SMS onboarding sent successfully to:', phone);
 } else {
 const errorData = await smsResponse.json().catch(() => ({ error: 'Unknown error' }));
 smsError = errorData.error || `SMS API returned ${smsResponse.status}`;
 console.error('❌ SMS send failed:', smsError);
 }
 } catch (smsErr) {
 smsError = smsErr instanceof Error ? smsErr.message : String(smsErr);
 console.error('❌ SMS exception:', smsErr);
 }
 }


 return NextResponse.json({
 success: true,
 user: {
 uid: userRecord.uid,
 email: userRecord.email,
 displayName: userRecord.displayName,
 },
 message: role === 'admin'
 ? `${displayName} admin olarak olusturuldu`
 : `${displayName} kullanici olarak olusturuldu`,
 notifications: {
 email: {
 sent: emailSent,
 error: emailError,
 address: email || null,
 },
 whatsapp: {
 sent: whatsappSent,
 error: whatsappError,
 address: phone || null,
 },
 sms: {
 sent: smsSent,
 error: smsError,
 address: phone || null,
 },
 },
 onboardingUrl,
 });
 } catch (error: unknown) {
 console.error('Create user error:', error);

 // Handle specific Firebase Auth errors
 const firebaseError = error as { code?: string; message?: string };
 if (firebaseError.code === 'auth/email-already-exists') {
 return NextResponse.json(
 { error: 'Bu e-posta adresi zaten kullanımda' },
 { status: 400 }
 );
 }
 if (firebaseError.code === 'auth/invalid-email') {
 return NextResponse.json(
 { error: 'Geçersiz e-posta adresi' },
 { status: 400 }
 );
 }
 if (firebaseError.code === 'auth/weak-password') {
 return NextResponse.json(
 { error: 'Şifre çok zayıf' },
 { status: 400 }
 );
 }

 return NextResponse.json(
 { error: firebaseError.message || 'Kullanıcı oluşturulurken bir hata oluştu' },
 { status: 500 }
 );
 }
}
