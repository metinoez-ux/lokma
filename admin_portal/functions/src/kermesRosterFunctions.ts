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
            const kermesName = kData?.kermesName || kData?.name || kData?.city || "Kermes";
            
            // Format dates (dd.mm.yyyy preferred if available, but raw is fine)
            const kStart = kData?.startDate || kData?.kermesStart || "Belirtilmedi";
            const kEnd = kData?.endDate || kData?.kermesEnd || "Belirtilmedi";

            // Format Title & Body
            const title = `📅 Yeni Vardiya Ataması: ${kermesName}`;
            const body = `${dateStr} tarihinde saat ${startStr} - ${endStr} arasında ${role} olarak görevlendirildiniz.`;

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
                        endTime: endStr
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
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Tarih:</strong> ${dateStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Saat:</strong> ${startStr} - ${endStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Görev Alanı / Bölüm:</strong> ${bolumStr}</p>
                                <p style="margin: 5px 0; color: #ffffff;"><strong>Görev / Rol:</strong> ${role}</p>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${googleCalUrl}" style="background-color: #2E7D32; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
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
