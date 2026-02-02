import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { stripe, createStripeInvoice, finalizeAndSendInvoice } from '@/lib/stripe';
import { createInvoice, createCommissionInvoice, createSubscriptionInvoice } from './invoiceCreationService';
import { generateInvoicePDF } from './invoicePDFService';
import { generateXRechnungXML } from './eRechnungService';
import { MerchantInvoice, InvoiceParty, TaxRate } from '@/types';

// =============================================================================
// STRIPE INVOICE ENTEGRASYONU
// =============================================================================

/**
 * MerchantInvoice'ı Stripe Invoice ile senkronize eder
 */
export async function syncInvoiceToStripe(invoice: MerchantInvoice): Promise<string | null> {
    try {
        // İşletmenin Stripe Customer ID'sini al
        const businessDoc = await getDoc(doc(db, 'businesses', invoice.businessId));
        const businessData = businessDoc.data();

        if (!businessData?.stripeCustomerId) {
            console.warn(`İşletme ${invoice.businessId} için Stripe müşteri ID bulunamadı`);
            return null;
        }

        // Stripe Invoice oluştur
        const stripeInvoice = await createStripeInvoice({
            customerId: businessData.stripeCustomerId,
            items: invoice.lineItems.map(item => ({
                description: item.description,
                amount: Math.round(item.grossAmount * 100), // Cents olarak
                quantity: item.quantity
            })),
            dueDate: invoice.paymentDueDate instanceof Date
                ? invoice.paymentDueDate
                : new Date(invoice.paymentDueDate),
            metadata: {
                merchantInvoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                type: invoice.type
            }
        });

        // Finalize ve gönder
        await finalizeAndSendInvoice(stripeInvoice.id);

        // MerchantInvoice'ı güncelle
        await updateDoc(doc(db, 'merchant_invoices', invoice.id), {
            stripeInvoiceId: stripeInvoice.id,
            stripeInvoiceUrl: stripeInvoice.hosted_invoice_url,
            updatedAt: new Date()
        });

        return stripeInvoice.id;
    } catch (error) {
        console.error('Stripe invoice sync hatası:', error);
        return null;
    }
}

// =============================================================================
// E-POSTA GÖNDERİMİ
// =============================================================================

/**
 * İşletme sahibine yeni fatura e-postası gönderir
 */
export async function sendInvoiceEmailToBusiness(invoice: MerchantInvoice): Promise<boolean> {
    try {
        // PDF oluştur
        const pdfBlob = await generateInvoicePDF(invoice);
        const pdfBase64 = await blobToBase64(pdfBlob);

        // XRechnung XML oluştur
        const xRechnungXml = generateXRechnungXML(invoice);
        const xmlBase64 = btoa(unescape(encodeURIComponent(xRechnungXml)));

        // E-posta gönder
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: invoice.buyer.email,
                subject: `Neue Rechnung: ${invoice.invoiceNumber}`,
                template: 'invoice_notification',
                data: {
                    recipientName: invoice.buyer.name,
                    invoiceNumber: invoice.invoiceNumber,
                    invoiceDate: formatDate(invoice.issuedAt || invoice.createdAt),
                    dueDate: formatDate(invoice.paymentDueDate),
                    totalAmount: formatCurrency(invoice.grossTotal),
                    invoiceType: getInvoiceTypeLabel(invoice.type),
                    sellerName: invoice.seller.name
                },
                attachments: [
                    {
                        filename: `Rechnung_${invoice.invoiceNumber}.pdf`,
                        content: pdfBase64,
                        contentType: 'application/pdf'
                    },
                    {
                        filename: `XRechnung_${invoice.invoiceNumber}.xml`,
                        content: xmlBase64,
                        contentType: 'application/xml'
                    }
                ]
            })
        });

        if (response.ok) {
            // E-posta gönderildi olarak işaretle
            await updateDoc(doc(db, 'merchant_invoices', invoice.id), {
                emailSentAt: new Date(),
                emailSentTo: invoice.buyer.email
            });
            return true;
        }

        return false;
    } catch (error) {
        console.error('Fatura e-postası gönderilemedi:', error);
        return false;
    }
}

/**
 * Müşteriye sipariş faturası gönderir (teslimat sonrası)
 */
export async function sendCustomerInvoiceEmail(
    invoice: MerchantInvoice,
    customerEmail: string
): Promise<boolean> {
    try {
        const pdfBlob = await generateInvoicePDF(invoice);
        const pdfBase64 = await blobToBase64(pdfBlob);

        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: customerEmail,
                subject: `Ihre Rechnung von ${invoice.seller.name} - ${invoice.invoiceNumber}`,
                template: 'customer_invoice',
                data: {
                    customerName: invoice.buyer.name,
                    businessName: invoice.seller.name,
                    invoiceNumber: invoice.invoiceNumber,
                    orderDate: formatDate(invoice.createdAt),
                    totalAmount: formatCurrency(invoice.grossTotal)
                },
                attachments: [
                    {
                        filename: `Rechnung_${invoice.invoiceNumber}.pdf`,
                        content: pdfBase64,
                        contentType: 'application/pdf'
                    }
                ]
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Müşteri fatura e-postası gönderilemedi:', error);
        return false;
    }
}

// =============================================================================
// AYLIK ABONELİK FATURALAMA (Cron Job için)
// =============================================================================

/**
 * Tüm aktif işletmeler için aylık abonelik faturası oluşturur
 * Her ayın 1'inde çalıştırılmalı (Cloud Function cron)
 */
export async function generateMonthlySubscriptionInvoices(): Promise<{
    generated: number;
    failed: number;
    details: string[];
}> {
    const results = {
        generated: 0,
        failed: 0,
        details: [] as string[]
    };

    try {
        // Aktif aboneliği olan tüm işletmeleri al
        const businessesQuery = query(
            collection(db, 'businesses'),
            where('subscription.status', '==', 'active')
        );

        const snapshot = await getDocs(businessesQuery);

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        for (const businessDoc of snapshot.docs) {
            const business = businessDoc.data();
            const businessId = businessDoc.id;

            try {
                // Plan bilgilerini al
                const planId = business.subscription?.planId || 'basic';
                const planDoc = await getDoc(doc(db, 'plans', planId));
                const plan = planDoc.data();

                if (!plan || plan.monthlyPrice === 0) {
                    results.details.push(`${businessId}: Ücretsiz plan, fatura oluşturulmadı`);
                    continue;
                }

                // Abonelik faturası oluştur
                const invoice = await createSubscriptionInvoice(
                    businessId,
                    plan.name || 'Abonnement',
                    plan.monthlyPrice / 1.19, // Net fiyat (KDV hariç)
                    periodStart,
                    periodEnd
                );

                // Stripe'a senkronize et
                await syncInvoiceToStripe(invoice);

                // E-posta gönder
                await sendInvoiceEmailToBusiness(invoice);

                results.generated++;
                results.details.push(`${businessId}: Fatura ${invoice.invoiceNumber} oluşturuldu`);

            } catch (error) {
                results.failed++;
                results.details.push(`${businessId}: HATA - ${error}`);
            }
        }

    } catch (error) {
        console.error('Aylık faturalama hatası:', error);
    }

    return results;
}

/**
 * Aylık komisyon faturası oluşturur (ay sonu)
 */
export async function generateMonthlyCommissionInvoices(): Promise<{
    generated: number;
    totalCommission: number;
}> {
    const results = {
        generated: 0,
        totalCommission: 0
    };

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    try {
        // Tüm işletmeleri al
        const businessesSnapshot = await getDocs(collection(db, 'businesses'));

        for (const businessDoc of businessesSnapshot.docs) {
            const businessId = businessDoc.id;

            // Bu ay toplanan komisyonu hesapla
            const ordersQuery = query(
                collection(db, 'orders'),
                where('businessId', '==', businessId),
                where('status', '==', 'delivered'),
                where('deliveredAt', '>=', Timestamp.fromDate(periodStart)),
                where('deliveredAt', '<=', Timestamp.fromDate(periodEnd))
            );

            const ordersSnapshot = await getDocs(ordersQuery);

            let totalCommission = 0;
            ordersSnapshot.docs.forEach(orderDoc => {
                const order = orderDoc.data();
                totalCommission += order.platformCommission || 0;
            });

            if (totalCommission > 0) {
                // Komisyon faturası oluştur
                const invoice = await createCommissionInvoice(
                    businessId,
                    periodStart,
                    periodEnd,
                    totalCommission / 1.19 // Net tutar
                );

                await syncInvoiceToStripe(invoice);
                await sendInvoiceEmailToBusiness(invoice);

                results.generated++;
                results.totalCommission += totalCommission;
            }
        }
    } catch (error) {
        console.error('Komisyon faturalama hatası:', error);
    }

    return results;
}

// =============================================================================
// SİPARİŞ FATURASI (Teslimat sonrası otomatik)
// =============================================================================

/**
 * Sipariş teslim edildiğinde müşteri faturası oluşturur ve gönderir
 */
export async function createAndSendOrderInvoice(orderId: string): Promise<MerchantInvoice | null> {
    try {
        // Sipariş bilgilerini al
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (!orderDoc.exists()) {
            console.error('Sipariş bulunamadı:', orderId);
            return null;
        }

        const order = orderDoc.data();

        // İşletme bilgilerini al
        const businessDoc = await getDoc(doc(db, 'businesses', order.businessId));
        const business = businessDoc.data();

        // Müşteri bilgilerini hazırla
        const customer: InvoiceParty = {
            name: order.customerName || `${order.firstName} ${order.lastName}`,
            address: order.deliveryAddress?.street || '',
            city: order.deliveryAddress?.city || '',
            postalCode: order.deliveryAddress?.postalCode || '',
            country: 'Deutschland',
            email: order.customerEmail
        };

        // Fatura kalemlerini hazırla
        const lineItems = order.items.map((item: { name: string; quantity: number; unit: string; price: number; taxRate?: number }) => ({
            description: item.name,
            quantity: item.quantity,
            unit: item.unit || 'Stück',
            unitPrice: item.price / (1 + ((item.taxRate || 7) / 100)), // Net fiyat
            taxRate: (item.taxRate || 7) as TaxRate
        }));

        // Teslimat ücreti varsa ekle
        if (order.deliveryFee && order.deliveryFee > 0) {
            lineItems.push({
                description: 'Liefergebühr',
                quantity: 1,
                unit: 'pauschal',
                unitPrice: order.deliveryFee / 1.19,
                taxRate: 19 as TaxRate
            });
        }

        // Fatura oluştur
        const invoice = await createInvoice({
            type: 'customer',
            businessId: order.businessId,
            buyer: customer,
            lineItems,
            orderId,
            customerId: order.customerId,
            paymentMethod: order.paymentMethod === 'card' ? 'stripe' : 'cash'
        });

        // Müşteriye e-posta gönder
        if (order.customerEmail) {
            await sendCustomerInvoiceEmail(invoice, order.customerEmail);
        }

        // Siparişi güncelle
        await updateDoc(doc(db, 'orders', orderId), {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceSentAt: new Date()
        });

        return invoice;

    } catch (error) {
        console.error('Sipariş faturası oluşturulamadı:', error);
        return null;
    }
}

// =============================================================================
// YARDIMCI FONKSİYONLAR
// =============================================================================

async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR'
    });
}

function getInvoiceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        customer: 'Kundenrechnung',
        commission: 'Provisionsrechnung',
        subscription: 'Abonnement-Rechnung'
    };
    return labels[type] || 'Rechnung';
}
