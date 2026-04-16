import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";

const resendApiKey = defineSecret("RESEND_API_KEY");

/**
 * Scheduled function to monitor TV heartbeat statuses every 5 minutes.
 * Queries all active kermes_events and checks their tv_heartbeats subcollection.
 */
export const onScheduledTvMonitor = onSchedule(
    {
        schedule: "every 5 minutes",
        secrets: [resendApiKey]
    },
    async (event) => {
        const db = admin.firestore();
        const messaging = admin.messaging();
        const nowSeconds = Date.now() / 1000;

        try {
            // Sadece aktif kermesi/eventleri listeleyelim.
            // Fakat 'isActive' veya benzeri flag olmayabilir, bu nedenle tumunu cekip ya da yakin tarihli olanlari alabiliriz.
            // Optimizasyon icin tum kermesleri aliyoruz (genelde cok az sayidadir)
            const eventsSnap = await db.collection("kermes_events").get();

            for (const eventDoc of eventsSnap.docs) {
                const kermesId = eventDoc.id;
                const kermesData = eventDoc.data();
                
                // --- 1. Sadece Aktif Günlerde ve Saatlerde İncele ---
                const now = new Date();
                
                if (kermesData.isActive === false) continue;
                if (kermesData.isArchived === true) continue;
                if (kermesData.endDate && kermesData.endDate.toDate() < now) continue;

                if (kermesData.openingTime && kermesData.closingTime) {
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Europe/Berlin', 
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                    const currentBerlnTime = formatter.format(now);
                    
                    const open = kermesData.openingTime;
                    const close = kermesData.closingTime;
                    let isWithinHours = false;

                    if (open < close) {
                        isWithinHours = (currentBerlnTime >= open && currentBerlnTime <= close);
                    } else {
                        // Geceyi bağlayan mesai örn: 18:00 - 03:00
                        isWithinHours = (currentBerlnTime >= open || currentBerlnTime <= close);
                    }

                    if (!isWithinHours) {
                        // Mesai dışı, boşuna alarm gönderme veya kalp atışı arama
                        continue;
                    }
                }
                
                const kermesName = kermesData.name || kermesData.businessName || "Kermes";

                const heartbeatsSnap = await eventDoc.ref.collection("tv_heartbeats").get();

                let offlineTvs: any[] = [];

                for (const hbDoc of heartbeatsSnap.docs) {
                    const data = hbDoc.data();
                    if (!data.lastHeartbeat) continue;

                    const lastHbSeconds = data.lastHeartbeat.seconds || (data.lastHeartbeat.toMillis() / 1000);
                    const diffSeconds = nowSeconds - lastHbSeconds;

                    // 3 Dakika tolerans = 180 saniye (biraz opsiyon tanimak adina 240sn diyebiliriz, 4 dk)
                    if (diffSeconds > 180) {
                        if (!data.alertSent) {
                            offlineTvs.push({
                                channelId: hbDoc.id,
                                tvName: data.tvName || hbDoc.id,
                                diffMinutes: Math.floor(diffSeconds / 60)
                            });
                            // Spam olusturmamak icin isaretle
                            await hbDoc.ref.update({ alertSent: true });
                        }
                    } else {
                        // Eger tekrar online olduysa, uyarilari sifirla
                        if (data.alertSent) {
                            await hbDoc.ref.update({ alertSent: false });
                        }
                    }
                }

                if (offlineTvs.length > 0) {
                    console.log(`[TV Monitor] Found ${offlineTvs.length} offline TVs for Kermes ${kermesId}`);
                    
                    // Bildirim Gonderilecek Yoneticileri (Kermes Admins) Bulalim
                    // 1. users tablosunda bu kermes e bagli olan ve admin yetkisi olanlari (veya tum personeli eger startup isek)
                    let adminFCMTokens: string[] = [];
                    let adminEmails: string[] = [];

                    const usersSnap = await db.collection("users")
                        .where("businessId", "==", kermesId)
                        .get();
                    
                    usersSnap.forEach(userDoc => {
                        const userData = userDoc.data();
                        // Sadece rollerinde admin ozelligi olanlara
                        if (userData.isBusinessAdmin === true || userData.role === 'admin' || userData.adminType) {
                            if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                                adminFCMTokens.push(...userData.fcmTokens);
                            }
                            if (userData.email) {
                                adminEmails.push(userData.email);
                            }
                        }
                    });

                    // 2. admins koleksiyonunu kontrol edelim (Yedek)
                    const adminsSnap = await db.collection("admins").where("kermesId", "==", kermesId).get();
                    adminsSnap.forEach(doc => {
                        const dat = doc.data();
                        if (dat.fcmTokens && Array.isArray(dat.fcmTokens)) {
                            adminFCMTokens.push(...dat.fcmTokens);
                        }
                        if (dat.email) adminEmails.push(dat.email);
                    });

                    // Listeyi unique yapalim
                    adminFCMTokens = [...new Set(adminFCMTokens)];
                    adminEmails = [...new Set(adminEmails)];

                    const tvNamesText = offlineTvs.map(t => t.tvName).join(", ");

                    // FCM Push
                    if (adminFCMTokens.length > 0) {
                        const message = {
                            notification: {
                                title: "⚠️ ODS TV Ekranı Koptu!",
                                body: `${kermesName} - ${tvNamesText} bağlantısı ${offlineTvs[0].diffMinutes} dakikadır kurulamıyor. Yükleniyor sayfasında açık kalmış olabilir. Lütfen kontrol edin!`
                            },
                            data: {
                                type: "tv_alert",
                                kermesId: kermesId
                            },
                            tokens: adminFCMTokens
                        };

                        try {
                            const response = await messaging.sendEachForMulticast(message);
                            console.log(`[TV Monitor] Sent ${response.successCount} pushes for offline TVs.`);
                        } catch(e) {
                            console.error("[TV Monitor] Push notification error:", e);
                        }
                    }

                    // Email with Resend
                    if (adminEmails.length > 0 && resendApiKey.value()) {
                        try {
                            const resend = new Resend(resendApiKey.value());
                            const emailHtml = `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; border-radius: 8px; overflow: hidden;">
                                    <div style="background: #e53935; padding: 20px; text-align: center;">
                                        <h2 style="margin: 0; color: #ffffff;">🚨 ODS TV Ekran Bağlantısı Koptu</h2>
                                    </div>
                                    <div style="padding: 20px;">
                                        <p style="font-size: 16px; color: #e0e0e0;">Merhaba,</p>
                                        <p style="font-size: 16px; color: #e0e0e0;"><strong>${kermesName}</strong> etkinliğindeki bazı TV (ODS - Mutfak/Tezgah Ekranları) cihazlarından sinyal alınamıyor. Ekranda tarayıcı kapanmış veya internet kopmuş olabilir.</p>
                                        <div style="background: #2a2a2a; border-left: 4px solid #e53935; padding: 15px; margin: 20px 0;">
                                            <ul style="margin: 0; color: #ff8a80; padding-left: 20px;">
                                                ${offlineTvs.map(t => `<li style="margin-bottom: 5px;"><strong>${t.tvName}</strong> (${t.diffMinutes} dakikadır çevrimdışı)</li>`).join("")}
                                            </ul>
                                        </div>
                                        <p style="font-size: 14px; color: #aaaaaa;">Lütfen ilgili tezgahtaki ekranı Refresh ediniz veya TV'nin açık olduğundan emin olunuz.</p>
                                    </div>
                                </div>
                            `;

                            await resend.emails.send({
                                from: "LOKMA Alert <no-reply@lokma.shop>",
                                to: adminEmails,
                                subject: "🚨 ODS TV Ekran Bağlantısı Koptu - LOKMA",
                                html: emailHtml
                            });
                            console.log(`[TV Monitor] Alert email sent to ${adminEmails.length} admins`);
                        } catch(e) {
                            console.error("[TV Monitor] Email notification error:", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[TV Monitor] CRITICAL ERROR execution failed:", error);
        }
    }
);
