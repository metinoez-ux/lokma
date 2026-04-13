import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";

const resendApiKey = defineSecret("RESEND_API_KEY");

/**
 * Triggered when a new roster entry is assigned to a staff member in a Kermes Event.
 * Sends Push Notification, Inbox item, and an Email with Calendar links.
 */
export const onKermesRosterCreated = onDocumentCreated(
    {
        document: "kermes_events/{kermesId}/rosters/{rosterId}",
        secrets: [resendApiKey]
    },
    async (event) => {
        const roster = event.data?.data();
        if (!roster) return;

        const db = admin.firestore();
        const messaging = admin.messaging();

        const userId = roster.userId;
        const role = roster.role || "Görevli";
        const dateStr = roster.date; // YYYY-MM-DD
        const startStr = roster.startTime; // HH:MM
        const endStr = roster.endTime; // HH:MM
        const kermesId = event.params.kermesId;

        if (!userId) return;

        try {
            // 1. Fetch User Data
            const userDoc = await db.collection("users").doc(userId).get();
            if (!userDoc.exists) {
                console.log(`[Roster Notify] User ${userId} not found`);
                return;
            }
            const userData = userDoc.data()!;
            
            // Extract robust user details
            const userName = userData.name || userData.profile?.name || userData.profile?.firstName || userData.displayName || 'Değerli Personelimiz';
            const rawGender = (userData.gender || userData.profile?.gender || '').toLowerCase();
            let bolumStr = "Genel Görev Alanı";
            if (rawGender === 'female' || rawGender === 'kadin' || rawGender === 'kadın') bolumStr = "Hanımlar Bölümü";
            else if (rawGender === 'male' || rawGender === 'erkek') bolumStr = "Erkekler Bölümü";

            // 2. Fetch Kermes Event Data for context
            const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
            const kData = kermesDoc.exists ? kermesDoc.data() : {};
        const kermesName = kData?.title || kData?.kermesName || kData?.name || kData?.city || "Kermes";
        
        if (roster.skipNotification === true) {
            console.log(`[Roster Notify] Skipping notification for roster ${event.params.rosterId} (part of batch)`);
            return;
        }

        // Format dates safely (Firestore Timestamp -> String)
        const safelyFormatDate = (val: any) => {
             if (!val) return null;
             
             // Gecersiz string ise
             if (val === '[object Object]') return null;
             
             // Eger Firestore Timestamp ise
             if (typeof val?.toDate === 'function') {
                 const d = val.toDate();
                 return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
             }
             
             // Eger string ise
             if (typeof val === 'string') {
                 return val;
             }
             
             // Eger _seconds iceren objeyse (Firebase SDK fallback)
             if (val._seconds) {
                 const d = new Date(val._seconds * 1000);
                 return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
             }
             
             // Eger Date objesiyse
             if (val instanceof Date) {
                 return `${val.getDate().toString().padStart(2, '0')}.${(val.getMonth()+1).toString().padStart(2, '0')}.${val.getFullYear()}`;
             }
             
             // Eger saniyeler iceren bir Firebase map'i ise
             if (val.seconds) {
                 const d = new Date(val.seconds * 1000);
                 return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
             }
             return null;
        };
        const kStart = safelyFormatDate(kData?.startDate) || safelyFormatDate(kData?.kermesStart) || "Belirtilmedi";
        const kEnd = safelyFormatDate(kData?.endDate) || safelyFormatDate(kData?.kermesEnd) || "Belirtilmedi";

        // Format Title & Body with potential overrides from UI
        const title = roster.notificationTitleOverride || `📅 Yeni Vardiya Ataması: ${kermesName}`;
        const displayedDate = roster.notificationDateSpan || dateStr;
        const body = roster.notificationBodyOverride || `${displayedDate} tarihinde saat ${startStr} - ${endStr} arasında ${role} olarak görevlendirildiniz.`;

            // Prepare date links for calendar (Format: YYYYMMDDTHHMMSSZ)
            // Note: Simplistic UTC mapping. For absolute accuracy a timezone library would be used, but standard YYYYMMDD string works for most templates.
            const dateStrClean = dateStr.replace(/-/g, '');
            const startClean = startStr.replace(':', '') + '00';
            const endClean = endStr.replace(':', '') + '00';
            const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Kermes+Vardiyasi+-+${encodeURIComponent(role)}&dates=${dateStrClean}T${startClean}/${dateStrClean}T${endClean}&details=${encodeURIComponent(kermesName + ' - ' + bolumStr)}`;

            // 3. Add to Inbox (users/{uid}/notifications)
            await db.collection("users").doc(userId).collection("notifications").add({
                title,
                body,
                type: "roster_shift",
                kermesId,
                role,
                date: dateStr,
                startTime: startStr,
                endTime: endStr,
                batchId: roster.batchId || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                deepLinkUrl: "roster_dashboard" // Instruct app to route to their staff dashboard
            });
            console.log(`[Roster Notify] Inbox stored for ${userId}`);

            // 4. Send Push Notification
            const fcmTokens: string[] = [];
            if (userData.fcmToken) fcmTokens.push(userData.fcmToken);
            if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                userData.fcmTokens.forEach((t: string) => {
                    if (t && !fcmTokens.includes(t)) fcmTokens.push(t);
                });
            }

            if (fcmTokens.length > 0) {
                const message = {
                    notification: { title, body },
                    data: {
                        type: "roster_shift",
                        kermesId,
                        role,
                        date: dateStr,
                        startTime: startStr,
                        endTime: endStr,
                        batchId: roster.batchId || ''
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default",
                                "content-available": 1,
                            },
                        },
                    },
                    tokens: fcmTokens,
                };
                try {
                    await messaging.sendEachForMulticast(message);
                    console.log(`[Roster Notify] FCM sent to ${fcmTokens.length} devices limit for ${userId}`);
                } catch (pushErr) {
                    console.error("[Roster Notify] FCM error:", pushErr);
                }
            }

            // 5. Send Transactional Email via Resend
            if (userData.email) {
                const resend = new Resend(resendApiKey.value());
                
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; border-radius: 8px; overflow: hidden;">
                        <div style="background: #1565C0; padding: 20px; text-align: center;">
                            <h2 style="margin: 0; color: #ffffff;">📅 Yeni Vardiya Ataması</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p style="font-size: 16px; color: #e0e0e0;">Merhaba ${userName},</p>
                            <p style="font-size: 16px; color: #e0e0e0;"><strong>${kermesName}</strong> etkinliğinde yeni bir görev / mesai saatine atandınız.</p>
                            <p style="font-size: 14px; color: #aaaaaa; margin-top: -5px;">(Kermes Genel Süresi: ${kStart} - ${kEnd})</p>
                            
                            <div style="background: #2a2a2a; border-left: 4px solid #1565C0; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Tarih:</strong> ${displayedDate}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Saat:</strong> ${startStr} - ${endStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Görev Alanı / Bölüm:</strong> ${bolumStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Görev / Rol:</strong> ${role}</p>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 20px;">
                                    <a href="https://lokma.shop/api/kermes/roster-action?batchId=${roster.batchId}&action=accept&u=${userId}&k=${kermesId}" style="background-color: #10B981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; flex: 1;">
                                        Görevi Kabul Ediyorum
                                    </a>
                                    <a href="https://lokma.shop/api/kermes/roster-action?batchId=${roster.batchId}&action=reject&u=${userId}&k=${kermesId}" style="background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; flex: 1;">
                                        Üstlenemiyorum
                                    </a>
                                </div>
                                <a href="${googleCalUrl}" style="background-color: #2E7D32; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                                    Google Takvime Ekle
                                </a>
                            </div>
                            
                            <p style="margin-top: 30px; font-size: 12px; color: #888888; text-align: center;">
                                LOKMA Marketplace Staff Management<br>
                                Ekipten ayrılmak veya mazeret bildirmek için Kermes yetkilinizle iletişime geçin.
                            </p>
                        </div>
                    </div>
                `;

                try {
                    await resend.emails.send({
                        from: "LOKMA Marketplace <noreply@lokma.shop>",
                        to: userData.email,
                        subject: `📅 Yeni Vardiya Ataması: ${kermesName}`,
                        html: emailHtml,
                    });
                    console.log(`[Roster Notify] Email sent to ${userData.email}`);
                } catch (emailErr) {
                    console.error("[Roster Notify] Email error:", emailErr);
                }
            } else {
                console.log(`[Roster Notify] User ${userId} has no email address`);
            }

        } catch (error) {
            console.error("[Roster Notify] Top level error:", error);
        }
    }
);

/**
 * Triggered when a Kermes roster entry is updated.
 * Used primarily to alert the Kermes Admin when a staff member rejects a shift.
 */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

export const onKermesRosterUpdated = onDocumentUpdated(
    "kermes_events/{kermesId}/rosters/{rosterId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();
        if (!before || !after) return;

        // Trigger on status change to either 'accepted' or 'rejected'
        if (before.status !== after.status && (after.status === 'rejected' || after.status === 'accepted')) {
            const db = admin.firestore();
            const kermesId = event.params.kermesId;
            const userId = after.userId;
            const role = after.role || "Görevli";

            try {
                const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
                if (!kermesDoc.exists) return;
                const kData = kermesDoc.data()!;
                const adminUid = kData.createdBy || kData.assignedManager;

                if (!adminUid) return;

                // Also fetch user to get their name
                let userName = "Bir personel";
                const userDoc = await db.collection("users").doc(userId).get();
                if (userDoc.exists) {
                    const uD = userDoc.data()!;
                    userName = uD.name || uD.profile?.name || uD.displayName || userName;
                }

                const isRejected = after.status === 'rejected';
                const isAccepted = after.status === 'accepted';

                const title = isRejected 
                  ? `⚠️ Vardiya Reddedildi: ${kData.kermesName || "Kermes"}`
                  : `✅ Vardiya Kabul Edildi: ${kData.kermesName || "Kermes"}`;
                
                const body = isRejected
                  ? `${userName}, ${after.date} tarihindeki ${after.startTime}-${after.endTime} ${role} görevini üstlenemeyeceğini bildirdi.`
                  : `${userName}, ${after.date} tarihindeki ${after.startTime}-${after.endTime} ${role} görevini kabul etti.`;

                // Add to admin's inbox
                await db.collection("users").doc(adminUid).collection("notifications").add({
                    title,
                    body,
                    type: isRejected ? "roster_rejection" : "roster_acceptance",
                    kermesId,
                    userId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
                
                console.log(`[Roster Updated] Rejection alert sent to admin ${adminUid}`);

                // Strip capability array if this was the last active shift for this role
                if (isRejected) {
                    const activeRosters = await db.collection("kermes_events").doc(kermesId).collection("rosters")
                        .where("userId", "==", userId)
                        .where("role", "==", role)
                        .where("status", "in", ["pending", "accepted"])
                        .get();

                    if (activeRosters.empty) {
                        const updateObj: Record<string, any> = {};
                        if (role === "Sürücü" || role.toLowerCase() === "driver") {
                            updateObj.assignedDrivers = admin.firestore.FieldValue.arrayRemove(userId);
                        } else if (role === "Garson" || role.toLowerCase() === "waiter") {
                            updateObj.assignedWaiters = admin.firestore.FieldValue.arrayRemove(userId);
                        } else {
                            const customRoles = kData.customRoles || [];
                            const matchedCustom = customRoles.find((c: any) => c.name === role || c.id === role);
                            if (matchedCustom) {
                                updateObj[`customRoleAssignments.${matchedCustom.id}`] = admin.firestore.FieldValue.arrayRemove(userId);
                            }
                            if (role === "Park Görevlisi" || role.includes("Park")) {
                                updateObj[`customRoleAssignments.role_park`] = admin.firestore.FieldValue.arrayRemove(userId);
                                updateObj[`customRoleAssignments.role_park_system`] = admin.firestore.FieldValue.arrayRemove(userId);
                            }
                            if (role === "Temizlik Görevlisi" || role.includes("Temizlik")) {
                                updateObj[`customRoleAssignments.role_temizlik`] = admin.firestore.FieldValue.arrayRemove(userId);
                                updateObj[`customRoleAssignments.role_temizlik_system`] = admin.firestore.FieldValue.arrayRemove(userId);
                            }
                            const pz = kData.prepZoneAssignments || {};
                            for (const key of Object.keys(pz)) {
                                if (key === role) {
                                   updateObj[`prepZoneAssignments.${key}`] = admin.firestore.FieldValue.arrayRemove(userId);
                                }
                            }
                        }
                        
                        if (Object.keys(updateObj).length > 0) {
                            await kermesDoc.ref.update(updateObj);
                            console.log(`[Roster Updated] Revoked capability arrays for user ${userId} on role ${role}`);
                        }
                    }
                }

                // Also send a transactional email to the Admin if they have an email registered
                const adminDoc = await db.collection("users").doc(adminUid).get();
                if (adminDoc.exists) {
                    const adminData = adminDoc.data()!;
                    if (adminData.email) {
                        const resend = new Resend(resendApiKey.value());
                        const headerColor = isRejected ? "#D32F2F" : "#10B981";
                        const headerText = isRejected ? "⚠️ Vardiya Ataması Reddedildi" : "✅ Vardiya Kabul Edildi";
                        const actionText = isRejected ? "<strong>reddedildi</strong>" : "<strong>kabul edildi</strong>";
                        const instructionText = isRejected 
                            ? "Lütfen bu görevi idame ettirebilmek için MIRA / LOKMA platformu üzerinden <strong>yeni bir personel</strong> görevlendiriniz."
                            : "Personel başarıyla atanmıştır, ek bir işleme gerek yoktur.";
                            
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; border-radius: 8px; overflow: hidden;">
                                <div style="background: ${headerColor}; padding: 20px; text-align: center;">
                                    <h2 style="margin: 0; color: #ffffff;">${headerText}</h2>
                                </div>
                                <div style="padding: 20px;">
                                    <p style="font-size: 16px; color: #e0e0e0;">Merhaba,</p>
                                    <p style="font-size: 16px; color: #e0e0e0;"><strong>${kData.kermesName || "Kermes"}</strong> etkinliği için oluşturduğunuz bir vardiya ataması personel tarafından ${actionText}.</p>
                                    
                                    <div style="background: #2a2a2a; border-left: 4px solid ${headerColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                        <p style="margin: 5px 0; color: #ffffff;"><strong>Personel:</strong> ${userName}</p>
                                        <p style="margin: 5px 0; color: #ffffff;"><strong>Görev:</strong> ${role}</p>
                                        <p style="margin: 5px 0; color: #ffffff;"><strong>Tarih:</strong> ${after.date}</p>
                                        <p style="margin: 5px 0; color: #ffffff;"><strong>Saat:</strong> ${after.startTime} - ${after.endTime}</p>
                                    </div>
                                    
                                    <p style="margin-top: 30px; font-size: 14px; color: #aaaaaa;">${instructionText}</p>
                                </div>
                            </div>
                        `;

                        try {
                            const emailSubject = isRejected 
                                ? `⚠️ Vardiya İptali: Personel Görevi Reddetti - ${userName}`
                                : `✅ Vardiya Onayı: Personel Görevi Kabul Etti - ${userName}`;
                                
                            await resend.emails.send({
                                from: "LOKMA Marketplace <noreply@lokma.shop>",
                                to: adminData.email,
                                subject: emailSubject,
                                html: emailHtml,
                            });
                            console.log(`[Roster Updated] Status update email sent to admin at ${adminData.email}`);
                        } catch (emailErr) {
                            console.error("[Roster Updated] Email error while notifying admin:", emailErr);
                        }
                    }
                }
            } catch (err) {
                console.error("[Roster Updated] Error processing rejection", err);
            }
        }
    }
);

import { onDocumentDeleted } from "firebase-functions/v2/firestore";

/**
 * Triggered when a Kermes roster entry is DELETED by the admin.
 * Sends Push Notification, Inbox item, and an Email alerting the user of the cancellation.
 */
export const onKermesRosterDeleted = onDocumentDeleted(
    {
        document: "kermes_events/{kermesId}/rosters/{rosterId}",
        secrets: [resendApiKey]
    },
    async (event) => {
        const deletedRoster = event.data?.data();
        if (!deletedRoster) return;
        
        // Skip deletion alerts for subsequent days in a multi-day batch (only alert once)
        if (deletedRoster.skipNotification === true) {
            console.log(`[Roster Deleted] Skipping notification for batch ${deletedRoster.batchId}`);
            return;
        }

        const db = admin.firestore();
        const messaging = admin.messaging();

        const userId = deletedRoster.userId;
        const role = deletedRoster.role || "Görevli";
        const dateStr = deletedRoster.date; 
        const startStr = deletedRoster.startTime;
        const endStr = deletedRoster.endTime;
        const kermesId = event.params.kermesId;

        if (!userId) return;

        try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (!userDoc.exists) return;
            const userData = userDoc.data()!;
            const userName = userData.name || userData.profile?.name || userData.displayName || "Değerli Personelimiz";

            const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
            const kData = kermesDoc.exists ? kermesDoc.data() : {};
            const kermesName = kData?.kermesName || kData?.name || "Kermes";

            const title = `❌ Vardiya İptali: ${kermesName}`;
            const displayedDate = deletedRoster.notificationDateSpan || dateStr;
            const body = `${kermesName} etkinlik yöneticisi ${displayedDate} (${startStr} - ${endStr}) tarihindeki '${role}' vardiyanızı iptal etti.`;

            // 1. Inbox
            await db.collection("users").doc(userId).collection("notifications").add({
                title,
                body,
                type: "roster_deleted",
                kermesId,
                role,
                date: dateStr,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                deepLinkUrl: "roster_dashboard"
            });
            console.log(`[Roster Deleted] Inbox stored for ${userId}`);

            // 2. Push Notification
            const fcmTokens: string[] = [];
            if (userData.fcmToken) fcmTokens.push(userData.fcmToken);
            if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                userData.fcmTokens.forEach((t: string) => {
                    if (t && !fcmTokens.includes(t)) fcmTokens.push(t);
                });
            }

            if (fcmTokens.length > 0) {
                const message = {
                    notification: { title, body },
                    data: { type: "roster_deleted", kermesId },
                    apns: { payload: { aps: { sound: "default", "content-available": 1 } } },
                    tokens: fcmTokens,
                };
                try {
                    await messaging.sendEachForMulticast(message);
                    console.log(`[Roster Deleted] FCM sent to ${fcmTokens.length} devices`);
                } catch (pushErr) {
                    console.error("[Roster Deleted] FCM err:", pushErr);
                }
            }

            // 3. Email Notification via Resend
            if (userData.email) {
                const resend = new Resend(resendApiKey.value());
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; border-radius: 8px; overflow: hidden;">
                        <div style="background: #EF4444; padding: 20px; text-align: center;">
                            <h2 style="margin: 0; color: #ffffff;">❌ Vardiya İptal Edildi</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p style="font-size: 16px; color: #e0e0e0;">Merhaba ${userName},</p>
                            <p style="font-size: 16px; color: #e0e0e0;"><strong>${kermesName}</strong> etkinlik yöneticisi tarafınıza atanan görev kaydını silmiştir.</p>
                            
                            <div style="background: #2a2a2a; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Tarih:</strong> ${displayedDate}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Saat:</strong> ${startStr} - ${endStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Görev Alanı / Rol:</strong> ${role}</p>
                            </div>
                            
                            <p style="margin-top: 20px; font-size: 14px; color: #aaaaaa; line-height: 1.5;">
                                Bu vardiya tablonuzdan kaldırılmıştır ve o saatlerde görev yapmanız beklenmemektedir.<br>
                                Herhangi bir karışıklık olduğunu düşünüyorsanız, lütfen kermes yetkilisinden teyit ediniz.
                            </p>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <p style="font-size: 12px; color: #888888;">
                                    LOKMA Marketplace Staff Management
                                </p>
                            </div>
                        </div>
                    </div>
                `;
                
                try {
                    await resend.emails.send({
                        from: "LOKMA Marketplace <noreply@lokma.shop>",
                        to: userData.email,
                        subject: `❌ Vardiya İptali: ${kermesName}`,
                        html: emailHtml,
                    });
                    console.log(`[Roster Deleted] Email sent to ${userData.email}`);
                } catch (emailErr) {
                    console.error("[Roster Deleted] Email error:", emailErr);
                }
            } else {
                console.log(`[Roster Deleted] User ${userId} has no email address`);
            }

        } catch (error) {
            console.error("[Roster Deleted] Top level error:", error);
        }
    }
);
