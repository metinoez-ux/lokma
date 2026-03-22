import { Resend } from 'resend';

// Lazy Resend client — initialized on first use, NOT at module evaluation time.
// Prevents build failures when RESEND_API_KEY is absent during Next.js static analysis.
let _resend: Resend | null = null;
function getResend(): Resend {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}

// Default sender (must be verified in Resend - lokma.shop domain)
export const DEFAULT_SENDER = 'LOKMA Marketplace <noreply@lokma.shop>';

export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    replyTo?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmailWithResend(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
    const { to, subject, html, text, from = DEFAULT_SENDER, replyTo } = params;

    const recipients = Array.isArray(to) ? to : [to];

    try {
        const { data, error } = await getResend().emails.send({
            from,
            to: recipients,
            subject,
            html,
            text,
            replyTo,
        });

        if (error) {
            console.error('Resend Email Error:', error);
            return {
                success: false,
                error: error.message,
            };
        }

        return {
            success: true,
            id: data?.id,
        };
    } catch (error) {
        console.error('Resend Email Error:', error);
        return {
            success: false,
            error: String(error),
        };
    }
}

// ===========================================
// Order Email Templates (Matching existing design)
// ===========================================

export const OrderEmailTemplates = {
    /**
     * Order Confirmation for Customer (Siparişiniz Alındı!)
     */
    orderConfirmationCustomer: (details: {
        orderId: string;
        customerName: string;
        butcherName: string;
        scheduledDate: string;
        deliveryType: 'pickup' | 'delivery';
        paymentMethod: string;
        totalAmount?: number;
    }) => ({
        subject: `✅ Siparişiniz Alındı #${details.orderId.slice(0, 6).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #C62828; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">✅</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Siparişiniz Alındı!</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Sipariş</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #fb335b; margin: 0 0 15px 0; font-size: 22px;">Merhaba ${details.customerName}!</h2>
                    <p style="color: #ccc; line-height: 1.6; margin: 0 0 25px 0;">
                        Siparişiniz başarıyla oluşturuldu. ${details.butcherName} siparişinizi hazırlıyor.
                    </p>
                    
                    <!-- Order Details Box -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid #fb335b;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Sipariş No:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">#${details.orderId.slice(0, 6).toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Kasap:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${details.butcherName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Tarih/Saat:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${details.scheduledDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Teslimat:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${details.deliveryType === 'pickup' ? 'Gel Al' : 'Kurye'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Ödeme:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${details.paymentMethod === 'card' ? 'Kartla' : 'Kapıda Nakit'}</td>
                            </tr>
                            ${details.totalAmount ? `
                            <tr style="border-top: 1px solid #444;">
                                <td style="padding: 15px 0 10px 0; color: #888; font-size: 14px;">Toplam:</td>
                                <td style="padding: 15px 0 10px 0; color: #4CAF50; font-weight: bold; font-size: 18px; text-align: right;">€${details.totalAmount.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    
                    <!-- Warning -->
                    <div style="background: #3d2020; border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #fb335b;">
                        <p style="margin: 0; color: #ffaaaa; font-size: 13px;">
                            <strong>Önemli:</strong> Lütfen "Siparişiniz Hazır" bildirimi gelmeden mağazaya gitmeyiniz.
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">Bizi tercih ettiğiniz için teşekkür ederiz! 🙏</p>
                    <p style="margin: 10px 0 0 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `,
    }),

    /**
     * Order Preparing Notification for Customer (Siparişiniz Hazırlanıyor!)
     */
    orderPreparingCustomer: (details: {
        orderId: string;
        customerName: string;
        butcherName: string;
    }) => ({
        subject: `👨‍🍳 Siparişiniz Hazırlanıyor #${details.orderId.slice(0, 6).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #1565C0; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">👨‍🍳</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Siparişiniz Hazırlanıyor!</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Sipariş</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #42A5F5; margin: 0 0 15px 0; font-size: 22px;">Merhaba ${details.customerName}!</h2>
                    <p style="color: #ccc; line-height: 1.6; margin: 0 0 25px 0;">
                        ${details.butcherName} siparişinizi hazırlamaya başladı. Hazır olduğunda size haber vereceğiz.
                    </p>
                    
                    <!-- Order Details Box -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid #1565C0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Sipariş No:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">#${details.orderId.slice(0, 6).toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Kasap:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${details.butcherName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Durum:</td>
                                <td style="padding: 10px 0; color: #42A5F5; font-weight: bold; text-align: right;">Hazırlanıyor</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Info -->
                    <div style="background: #1a3a5c; border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #1565C0;">
                        <p style="margin: 0; color: #90CAF9; font-size: 13px;">
                            <strong>Bilgi:</strong> Siparişiniz hazır olduğunda ayrıca bildirim alacaksınız. Lütfen o zamana kadar bekleyiniz.
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">Bizi tercih ettiğiniz için teşekkür ederiz!</p>
                    <p style="margin: 10px 0 0 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `,
    }),

    /**
     * Order Ready Notification for Customer (Siparişiniz Hazır!)
     */
    orderReadyCustomer: (details: {
        orderId: string;
        customerName: string;
        butcherName: string;
        butcherAddress?: string;
    }) => ({
        subject: `🎉 Siparişiniz Hazır! #${details.orderId.slice(0, 6).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #2E7D32; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">🎉</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Siparişiniz Hazır!</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Sipariş</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #4CAF50; margin: 0 0 15px 0; font-size: 22px;">Merhaba ${details.customerName}!</h2>
                    <p style="color: #ccc; line-height: 1.6; margin: 0 0 25px 0;">
                        Siparişiniz ${details.butcherName} tarafından hazırlandı. Şimdi teslim alabilirsiniz!
                    </p>
                    
                    <!-- Order Details Box -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid #4CAF50;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Sipariş No:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">#${details.orderId.slice(0, 6).toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Kasap:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${details.butcherName}</td>
                            </tr>
                            ${details.butcherAddress ? `
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Adres:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${details.butcherAddress}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    
                    <!-- Success Message -->
                    <div style="text-align: center; margin-top: 25px;">
                        <p style="color: #4CAF50; font-size: 18px; margin: 0;">Afiyet olsun!</p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">Bizi tercih ettiğiniz için teşekkür ederiz! 🙏</p>
                    <p style="margin: 10px 0 0 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `,
    }),

    /**
     * Order Delivered/Completed (Teslim Edildi!)
     */
    orderCompletedCustomer: (details: {
        orderId: string;
        customerName: string;
        butcherName: string;
        deliveredAt: string;
        totalAmount: number;
    }) => ({
        subject: `🎉 Teslim Edildi! #${details.orderId.slice(0, 6).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #2E7D32; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">🎉</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Teslim Edildi!</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Sipariş</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #4CAF50; margin: 0 0 15px 0; font-size: 22px;">Merhaba ${details.customerName}!</h2>
                    <p style="color: #ccc; line-height: 1.6; margin: 0 0 25px 0;">
                        Siparişiniz ${details.butcherName} tarafından teslim edildi.
                    </p>
                    
                    <!-- Order Details Box -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid #4CAF50;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Sipariş No:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">#${details.orderId.slice(0, 6).toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Kasap:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${details.butcherName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Teslim Zamanı:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${details.deliveredAt}</td>
                            </tr>
                            <tr style="border-top: 1px solid #444;">
                                <td style="padding: 15px 0 10px 0; color: #888; font-size: 14px;">Toplam:</td>
                                <td style="padding: 15px 0 10px 0; color: #4CAF50; font-weight: bold; font-size: 18px; text-align: right;">€${details.totalAmount.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">Bizi tercih ettiğiniz için teşekkür ederiz! 🙏</p>
                    <p style="margin: 10px 0 0 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `,
    }),

    /**
     * New Order Notification for Vendor
     */
    newOrderVendor: (details: {
        orderId: string;
        customerName: string;
        customerPhone?: string;
        items: Array<{ name: string; quantity: number; unitType: string; totalPrice: number }>;
        totalAmount: number;
        deliveryType: 'pickup' | 'delivery';
        scheduledDate: string;
        paymentMethod: string;
    }) => ({
        subject: `🆕 Yeni Sipariş #${details.orderId.slice(0, 6).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #C62828; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">🆕</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Yeni Sipariş!</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Sipariş</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #fb335b; margin: 0 0 15px 0; font-size: 22px;">Sipariş #${details.orderId.slice(0, 6).toUpperCase()}</h2>
                    
                    <!-- Customer Info -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <p style="margin: 0; color: #888; font-size: 12px;">MÜŞTERİ</p>
                        <p style="margin: 5px 0 0 0; color: white; font-weight: bold;">${details.customerName}</p>
                        ${details.customerPhone ? `<p style="margin: 3px 0 0 0; color: #4CAF50;">${details.customerPhone}</p>` : ''}
                    </div>
                    
                    <!-- Order Details -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 15px; border-left: 4px solid #fb335b;">
                        <p style="margin: 0 0 10px 0; color: #888; font-size: 12px;">SİPARİŞ DETAYLARI</p>
                        ${details.items.map(item => `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
                                <span style="color: white;">${item.name} (${item.quantity} ${item.unitType})</span>
                                <span style="color: #4CAF50; font-weight: bold;">€${item.totalPrice.toFixed(2)}</span>
                            </div>
                        `).join('')}
                        <div style="padding-top: 15px; text-align: right;">
                            <span style="color: white; font-size: 18px; font-weight: bold;">TOPLAM: </span>
                            <span style="color: #4CAF50; font-size: 22px; font-weight: bold;">€${details.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <!-- Delivery Info -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 15px; margin-top: 15px;">
                        <table style="width: 100%;">
                            <tr>
                                <td style="color: #888; font-size: 13px;">Teslimat:</td>
                                <td style="color: white; text-align: right;">${details.deliveryType === 'pickup' ? 'Gel Al' : 'Kurye'}</td>
                            </tr>
                            <tr>
                                <td style="color: #888; font-size: 13px;">Tarih/Saat:</td>
                                <td style="color: white; text-align: right;">${details.scheduledDate}</td>
                            </tr>
                            <tr>
                                <td style="color: #888; font-size: 13px;">Ödeme:</td>
                                <td style="color: white; text-align: right;">${details.paymentMethod === 'card' ? 'Kartla' : 'Kapıda Nakit'}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `,
    }),
};
