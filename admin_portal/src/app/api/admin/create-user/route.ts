import { NextRequest, NextResponse } from 'next/server';

// Dynamic import for firebase-admin to prevent module load crashes
async function getFirebaseAdmin() {
    try {
        const { getApps, cert, initializeApp, applicationDefault } = await import('firebase-admin/app');
        const { getAuth } = await import('firebase-admin/auth');
        const { getFirestore } = await import('firebase-admin/firestore');

        let app;
        const apps = getApps();

        if (apps.length === 0) {
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            let initialized = false;

            // 1. Try explicit service account key
            if (serviceAccount) {
                try {
                    const account = JSON.parse(serviceAccount);
                    if (account.private_key) {
                        account.private_key = account.private_key.replace(/\\n/g, '\n');
                    }
                    app = initializeApp({
                        credential: cert(account),
                        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    });
                    initialized = true;
                    console.log('✅ Firebase Admin initialized with EXPLICIT key (New App)');
                } catch (parseError) {
                    console.warn('⚠️ Explicit key parsing failed, falling back to ADC:', parseError);
                }
            }

            // 2. Fallback to ADC
            if (!initialized) {
                console.log('🔄 Attempting ADC (Application Default Credentials)...');
                app = initializeApp({
                    credential: applicationDefault(),
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'aylar-a45af',
                });
                console.log('✅ Firebase Admin initialized with ADC (New App)');
            }
        } else {
            app = apps[0];
            console.log('♻️ Reusing existing Firebase Admin app. Total apps:', apps.length);
        }

        if (!app) {
            throw new Error('Firebase Admin app could not be initialized.');
        }

        // Pass the explicit app instance to getters - CRITICAL FIX
        return { auth: getAuth(app), db: getFirestore(app) };
    } catch (error) {
        console.error('🚨 Firebase Admin import/init failed:', error);
        throw error;
    }
}

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
            email, password, displayName, phone, dialCode,
            firstName: bodyFirstName, lastName: bodyLastName,
            address, houseNumber, addressLine2, city, country, postalCode,
            role, adminType, location, createdBy, isPrimaryAdmin,
            // 🔑 UNIVERSAL BUSINESS FIELDS (accept both new and legacy names)
            businessId: bodyBusinessId, businessName: bodyBusinessName, businessType: bodyBusinessType,
            butcherId: legacyButcherId, butcherName: legacyButcherName, // Legacy support
            // Assigner details for welcome email
            assignerName, assignerEmail, assignerPhone, assignerRole
        } = body;

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
        if (needsBusinessAssignment && !businessId) {
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

        // auth and db are already initialized above

        // Prepare phone number in E.164 format if provided
        let formattedPhone: string | undefined = undefined;
        if (phone) {
            // Clean and format phone number
            const cleanedPhone = phone.replace(/\D/g, '');
            if (cleanedPhone.length >= 10) {
                formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+ ${cleanedPhone} `;
            }
        }

        // Create user in Firebase Auth
        // Email OR phone is required, but both are optional individually
        const userRecord = await auth.createUser({
            email: email || undefined,
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
            email,
            displayName,
            firstName,
            lastName,
            createdAt: new Date().toISOString(),
            location: location || null,
            phoneNumber: phone || null,
            dialCode: dialCode || null,
            // Address fields
            address: address || null,
            houseNumber: houseNumber || null,
            addressLine2: addressLine2 || null,
            city: city || null,
            country: country || null,
            postalCode: postalCode || null,
            photoURL: null,
            // Audit tracking
            createdBy: createdBy || 'system',
            createdBySource: body.createdBySource || 'super_admin',
            isActive: true,
        });

        // If admin role is assigned, create admin document
        if (role === 'admin' && adminType) {
            const adminData: Record<string, unknown> = {
                email,
                displayName,
                firstName,
                lastName,
                phoneNumber: phone || null,
                role: 'admin',
                adminType,
                location: location || null,
                permissions: [],
                isActive: true,
                createdAt: new Date().toISOString(),
                createdBy: createdBy || 'system',
                firebaseUid: userRecord.uid,  // Link to Firebase Auth user
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

            await db.collection('admins').doc(userRecord.uid).set(adminData);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SEND WELCOME NOTIFICATIONS (Email + SMS)
        // ═══════════════════════════════════════════════════════════════════════

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lokma.shop';

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
                                    adminType === 'cicekci' ? 'Çiçekçi Admin' :
                                        adminType === 'super' ? 'Super Admin' :
                                            adminType?.includes('_staff') ? 'Personel' :
                                                adminType || 'Personel';

        // 1. Send Welcome Email via API
        let emailSent = false;
        let emailError = null;

        if (email) {
            try {
                let emailSubject: string;
                let emailHtml: string;

                if (isAdminOrStaff) {
                    // ═══════════════════════════════════════════════════════════════
                    // ADMIN/STAFF ROLE ASSIGNMENT EMAIL - WITH FULL ASSIGNER DETAILS
                    // ═══════════════════════════════════════════════════════════════
                    emailSubject = `🎖️ ${businessDisplayName} - Yeni Yetkiniz!`;
                    emailHtml = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;" >
        <div style="background: linear-gradient(135deg, #1e40af, #1e3a8a); padding: 30px; border-radius: 12px; text-align: center;" >
            <h1 style="color: white; margin: 0; font-size: 28px;" >🎖️ ${businessDisplayName} </h1>
                < p style = "color: rgba(255,255,255,0.9); margin-top: 8px;" > Yetki Bildirimi </p>
                    </div>

                    < div style = "padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;" >
                        <h2 style="color: #1f2937; margin-top: 0;" > Merhaba ${firstName} ! 👋</h2>

                            < p style = "color: #4b5563; line-height: 1.6;" >
                                Sizi < strong style = "color: #1e40af;" > ${roleDisplayName} </strong> olarak atadık.
                                    </p>

                                    < !--Atayan Kişi Bilgileri-- >
                                        <div style="background: linear-gradient(135deg, #fef3c7, #fef9c3); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;" >
                                            <p style="margin: 0; color: #92400e; font-weight: bold;" >👤 Sizi Atayan Kişi </p>
                                                < p style = "margin: 8px 0 0 0; color: #78350f;" > <strong>İsim: </strong> ${assignerName || 'Admin'}</p >
                                                    ${assignerRole ? `<p style="margin: 4px 0 0 0; color: #78350f;"><strong>Rol:</strong> ${assignerRoleDisplay}</p>` : ''}
                                    ${assignerEmail ? `<p style="margin: 4px 0 0 0; color: #78350f;"><strong>E-posta:</strong> ${assignerEmail}</p>` : ''}
                                    ${assignerPhone ? `<p style="margin: 4px 0 0 0; color: #78350f;"><strong>Telefon:</strong> ${assignerPhone}</p>` : ''}
</div>

    < !--Atama Detayları-- >
        <div style="background: linear-gradient(135deg, #dbeafe, #eff6ff); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;" >
            <p style="margin: 0; color: #1e3a8a; font-weight: bold;" >📋 Atama Detayları </p>
                < p style = "margin: 8px 0 0 0; color: #374151;" >🏢 İşletme: <strong>${businessDisplayName} </strong></p >
                    <p style="margin: 4px 0 0 0; color: #374151;" >👤 Sizin Rolünüz: <strong>${roleDisplayName} </strong></p >
                        </div>

                        < !--Giriş Bilgileri-- >
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;" >
                                <p style="margin: 0; color: #1e3a8a; font-weight: bold;" >🔑 Giriş Bilgileriniz </p>
                                    < p style = "margin: 8px 0 0 0; color: #374151;" > <strong>📧 E - posta: </strong> ${email}</p >
                                        <p style="margin: 8px 0 0 0; color: #374151;" > <strong>🔐 Şifre: </strong> ${password}</p >
                                            <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;" >
                                        ⚠️ Güvenliğiniz için ilk girişte şifrenizi değiştirmenizi öneririz.
                                    </p>
    </div>

    < a href = "${baseUrl}/login" style = "display: inline-block; background: #1e40af; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;" >
                                    🚀 Panele Giriş Yap
    </a>
    </div>

    < div style = "text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;" >
        <p>Bu e - posta ${assignerName} tarafından LOKMA platformu üzerinden gönderilmiştir.</p>
            <p>© 2026 LOKMA - Tüm hakları saklıdır.</p>
                </div>
                </div>
                    `;
                } else {
                    // ═══════════════════════════════════════════════════════════════
                    // CUSTOMER WELCOME EMAIL
                    // ═══════════════════════════════════════════════════════════════
                    emailSubject = '🎉 LOKMA Ailesine Hoş Geldiniz!';
                    emailHtml = `
                < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;" >
                    <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 12px; text-align: center;" >
                        <h1 style="color: white; margin: 0; font-size: 28px;" >🍖 LOKMA </h1>
                            < p style = "color: rgba(255,255,255,0.9); margin-top: 8px;" > Taze Et, Hızlı Teslimat </p>
                                </div>

                                < div style = "padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;" >
                                    <h2 style="color: #1f2937; margin-top: 0;" > Merhaba ${firstName} ! 👋</h2>

                                        < p style = "color: #4b5563; line-height: 1.6;" >
                                            LOKMA ailesine hoş geldiniz! Hesabınız başarıyla oluşturuldu.
                                </p>

                                                < div style = "background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;" >
                                                    <p style="margin: 0; color: #374151;" > <strong>📧 E - posta: </strong> ${email}</p >
                                                        <p style="margin: 8px 0 0 0; color: #374151;" > <strong>🔐 Şifre: </strong> ${password}</p >
                                                            <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;" >
                                        ⚠️ Güvenliğiniz için ilk girişte şifrenizi değiştirmenizi öneririz.
                                    </p>
    </div>

    < a href = "${baseUrl}/login" style = "display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;" >
                                    🚀 Giriş Yap
    </a>
    </div>

    < div style = "text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;" >
        <p>Bu e - posta LOKMA platformu tarafından gönderilmiştir.</p>
            <p>© 2026 LOKMA - Tüm hakları saklıdır.</p>
                </div>
                </div>
                    `;
                }

                const emailResponse = await fetch(`${baseUrl}/api/email/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: email,
                        subject: emailSubject,
                        html: emailHtml,
                    }),
                });

                if (emailResponse.ok) {
                    emailSent = true;
                    console.log(`✅ ${isAdminOrStaff ? 'Role assignment' : 'Welcome'} email sent successfully to:`, email);
                } else {
                    const errorData = await emailResponse.json().catch(() => ({ error: 'Unknown error' }));
                    emailError = errorData.error || `Email API returned ${emailResponse.status}`;
                    console.error('❌ Email send failed:', emailError);
                }
            } catch (emailErr) {
                emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
                console.error('❌ Welcome email exception:', emailErr);
                // Don't fail the whole request if email fails
            }
        }



        // 2. Send Welcome WhatsApp & SMS 
        let whatsappSent = false;
        let whatsappError = null;
        let smsSent = false;
        let smsError = null;

        if (phone) {
            // 2A. Send WhatsApp Message (Primary)
            try {
                const whatsappMessage = email
                    ? `🎉 LOKMA - Merhaba ${firstName}!\n\nSize ${roleDisplayName} yetkisi verildi.\n\n📧 Email: ${email}\n🔐 Şifre: ${password}\n\n👉 Giriş: ${baseUrl}/login\n\n${assignerName ? `Sizi atayan: ${assignerName}` : ''}\n\nLOKMA Marketplace`
                    : `🎉 LOKMA - Merhaba ${firstName}!\n\nSize ${roleDisplayName} yetkisi verildi.\n\n📱 Telefon ile giriş yapabilirsiniz.\n👉 ${baseUrl}/login\n\n${assignerName ? `Sizi atayan: ${assignerName}` : ''}\n\nLOKMA Marketplace`;

                const whatsappResponse = await fetch(`${baseUrl}/api/whatsapp/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: phone,
                        message: whatsappMessage,
                        templateType: 'custom',
                    }),
                });

                if (whatsappResponse.ok) {
                    whatsappSent = true;
                    console.log('✅ WhatsApp sent successfully to:', phone);
                } else {
                    const errorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown error' }));
                    whatsappError = errorData.error || `WhatsApp API returned ${whatsappResponse.status}`;
                    console.error('❌ WhatsApp send failed:', whatsappError);
                }
            } catch (whatsappErr) {
                whatsappError = whatsappErr instanceof Error ? whatsappErr.message : String(whatsappErr);
                console.error('❌ WhatsApp exception:', whatsappErr);
            }

            // 2B. Send SMS (Fallback)
            try {
                const smsMessage = email
                    ? `LOKMA - Merhaba ${firstName}! ${roleDisplayName} olarak atandiniz. Email: ${email} Sifre: ${password} Giris: ${baseUrl}/login`
                    : `LOKMA - Merhaba ${firstName}! ${roleDisplayName} olarak atandiniz. Giris: ${baseUrl}/login`;

                const smsResponse = await fetch(`${baseUrl}/api/sms/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: phone,
                        message: smsMessage,
                    }),
                });

                if (smsResponse.ok) {
                    smsSent = true;
                    console.log('✅ SMS sent successfully to:', phone);
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
                ? `${displayName} admin olarak oluşturuldu`
                : `${displayName} kullanıcı olarak oluşturuldu`,
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
