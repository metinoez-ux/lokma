import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { MerchantInvoice, InvoiceType, InvoiceLineItem, InvoiceParty, TaxRate, LOKMA_COMPANY_INFO } from '@/types';

// =============================================================================
// FATURA NUMARASI ÜRETECİ (GoBD Uyumlu)
// =============================================================================

/**
 * Almanya vergi mevzuatına uygun fatura numarası üretir.
 * Her işletme için ayrı seri, kesintisiz numara.
 * 
 * Format: {PREFIX}-{YEAR}-{SEQUENCE}
 * Örnek: KA-2026-00001 (Kasap Ali'nin 2026 yılı 1. faturası)
 * 
 * @param businessId İşletme ID (müşteri faturaları için)
 * @param type Fatura tipi
 */
export async function generateInvoiceNumber(
    businessId: string,
    type: InvoiceType
): Promise<string> {
    const year = new Date().getFullYear();

    // Seri prefix belirleme
    let prefix: string;
    let sequenceDocPath: string;

    if (type === 'customer') {
        // İşletme müşteriye fatura kesiyor - işletme bazlı seri
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        const businessCode = businessDoc.data()?.invoicePrefix || businessId.substring(0, 4).toUpperCase();
        prefix = businessCode;
        sequenceDocPath = `invoice_sequences/${businessId}_customer_${year}`;
    } else if (type === 'commission') {
        // LOKMA işletmeye komisyon faturası
        prefix = 'LP'; // LOKMA Provision
        sequenceDocPath = `invoice_sequences/lokma_commission_${year}`;
    } else {
        // LOKMA işletmeye abonelik faturası
        prefix = 'LA'; // LOKMA Abo
        sequenceDocPath = `invoice_sequences/lokma_subscription_${year}`;
    }

    // Atomik sayaç artırma (race condition önleme)
    const nextNumber = await runTransaction(db, async (transaction) => {
        const seqRef = doc(db, sequenceDocPath);
        const seqDoc = await transaction.get(seqRef);

        let currentSeq = 0;
        if (seqDoc.exists()) {
            currentSeq = seqDoc.data().lastNumber || 0;
        }

        const newSeq = currentSeq + 1;
        transaction.set(seqRef, {
            lastNumber: newSeq,
            lastUpdated: new Date(),
            prefix,
            year,
            type,
            businessId: type === 'customer' ? businessId : 'lokma'
        });

        return newSeq;
    });

    // Format: PREFIX-YYYY-NNNNN (5 haneli, sıfır dolgulu)
    const invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;

    return invoiceNumber;
}

// =============================================================================
// FATURA OLUŞTURMA
// =============================================================================

interface CreateInvoiceParams {
    type: InvoiceType;
    businessId: string;
    buyer: InvoiceParty;
    lineItems: {
        description: string;
        quantity: number;
        unit?: string;
        unitPrice: number;
        taxRate: TaxRate;
    }[];
    orderId?: string;
    customerId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    notes?: string;
    paymentMethod?: MerchantInvoice['paymentMethod'];
}

/**
 * Yeni fatura oluşturur (müşteri, komisyon veya abonelik)
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<MerchantInvoice> {
    const { type, businessId, buyer, lineItems: rawItems, orderId, customerId, periodStart, periodEnd, notes, paymentMethod } = params;

    // Satıcı belirleme
    let seller: InvoiceParty;

    if (type === 'customer') {
        // Müşteri faturası - satıcı işletme
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        const businessData = businessDoc.data();

        seller = {
            name: businessData?.companyName || businessData?.brand || 'İşletme',
            address: businessData?.address?.street || '',
            city: businessData?.address?.city || '',
            postalCode: businessData?.address?.postalCode || '',
            country: 'Deutschland',
            taxId: businessData?.taxInfo?.steuernummer,
            vatId: businessData?.taxInfo?.ustIdNr,
            email: businessData?.email,
            phone: businessData?.phone
        };
    } else {
        // Komisyon/Abonelik - satıcı LOKMA
        seller = LOKMA_COMPANY_INFO;
    }

    // Fatura kalemlerini hesapla
    const lineItems: InvoiceLineItem[] = rawItems.map(item => {
        const netAmount = item.quantity * item.unitPrice;
        const vatAmount = netAmount * (item.taxRate / 100);
        const grossAmount = netAmount + vatAmount;

        return {
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'Stück',
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            netAmount: Math.round(netAmount * 100) / 100,
            vatAmount: Math.round(vatAmount * 100) / 100,
            grossAmount: Math.round(grossAmount * 100) / 100
        };
    });

    // Toplamları hesapla
    const netTotal = lineItems.reduce((sum, item) => sum + item.netAmount, 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + item.vatAmount, 0);
    const grossTotal = lineItems.reduce((sum, item) => sum + item.grossAmount, 0);

    // KDV dağılımı
    const vatBreakdownMap = new Map<TaxRate, { netAmount: number; vatAmount: number }>();
    lineItems.forEach(item => {
        const existing = vatBreakdownMap.get(item.taxRate) || { netAmount: 0, vatAmount: 0 };
        vatBreakdownMap.set(item.taxRate, {
            netAmount: existing.netAmount + item.netAmount,
            vatAmount: existing.vatAmount + item.vatAmount
        });
    });

    const vatBreakdown = Array.from(vatBreakdownMap.entries()).map(([rate, amounts]) => ({
        rate,
        netAmount: Math.round(amounts.netAmount * 100) / 100,
        vatAmount: Math.round(amounts.vatAmount * 100) / 100
    }));

    // Fatura numarası oluştur
    const invoiceNumber = await generateInvoiceNumber(businessId, type);

    // Fatura ID
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Ödeme vadesi (14 gün)
    const paymentDueDate = new Date();
    paymentDueDate.setDate(paymentDueDate.getDate() + 14);

    const invoice: MerchantInvoice = {
        id: invoiceId,
        invoiceNumber,
        type,
        status: 'issued',

        seller,
        buyer,

        lineItems,

        netTotal: Math.round(netTotal * 100) / 100,
        vatBreakdown,
        vatTotal: Math.round(vatTotal * 100) / 100,
        grossTotal: Math.round(grossTotal * 100) / 100,
        currency: 'EUR',

        paymentMethod,
        paymentStatus: 'pending',
        paymentDueDate,

        orderId,
        businessId,
        customerId,

        periodStart,
        periodEnd,

        notes,

        createdAt: new Date(),
        updatedAt: new Date(),
        issuedAt: new Date()
    };

    // Firestore'a kaydet
    await setDoc(doc(db, 'invoices', invoiceId), invoice);

    return invoice;
}

// =============================================================================
// MÜŞTERİ FATURASI OLUŞTURMA (Sipariş için)
// =============================================================================

/**
 * Sipariş tamamlandığında müşteri faturası oluşturur
 */
export async function createCustomerInvoiceFromOrder(
    orderId: string,
    businessId: string,
    customer: InvoiceParty,
    orderItems: {
        name: string;
        quantity: number;
        unit: string;
        price: number; // Brüt fiyat
        taxRate: TaxRate;
    }[]
): Promise<MerchantInvoice> {
    // Brüt fiyattan net fiyat hesapla
    const lineItems = orderItems.map(item => {
        const grossPrice = item.price;
        const netPrice = grossPrice / (1 + item.taxRate / 100);

        return {
            description: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: Math.round(netPrice * 100) / 100,
            taxRate: item.taxRate
        };
    });

    return createInvoice({
        type: 'customer',
        businessId,
        buyer: customer,
        lineItems,
        orderId,
        paymentMethod: 'stripe'
    });
}

// =============================================================================
// KOMİSYON FATURASI OLUŞTURMA
// =============================================================================

/**
 * Aylık komisyon faturası oluşturur (LOKMA → İşletme)
 */
export async function createCommissionInvoice(
    businessId: string,
    periodStart: Date,
    periodEnd: Date,
    commissionAmount: number // Net komisyon tutarı
): Promise<MerchantInvoice> {
    // İşletme bilgilerini al
    const businessDoc = await getDoc(doc(db, 'businesses', businessId));
    const businessData = businessDoc.data();

    const buyer: InvoiceParty = {
        name: businessData?.companyName || businessData?.brand || 'İşletme',
        address: businessData?.address?.street || '',
        city: businessData?.address?.city || '',
        postalCode: businessData?.address?.postalCode || '',
        country: 'Deutschland',
        taxId: businessData?.taxInfo?.steuernummer,
        vatId: businessData?.taxInfo?.ustIdNr,
        email: businessData?.email
    };

    const startStr = periodStart.toLocaleDateString('de-DE');
    const endStr = periodEnd.toLocaleDateString('de-DE');

    return createInvoice({
        type: 'commission',
        businessId,
        buyer,
        lineItems: [{
            description: `LOKMA Vermittlungsprovision (${startStr} - ${endStr})`,
            quantity: 1,
            unit: 'pauschal',
            unitPrice: commissionAmount,
            taxRate: 19 // Hizmet = %19
        }],
        periodStart,
        periodEnd
    });
}

// =============================================================================
// ABONELİK FATURASI OLUŞTURMA
// =============================================================================

/**
 * Aylık abonelik faturası oluşturur (LOKMA → İşletme)
 */
export async function createSubscriptionInvoice(
    businessId: string,
    planName: string,
    monthlyFee: number, // Net aylık ücret
    periodStart: Date,
    periodEnd: Date
): Promise<MerchantInvoice> {
    // İşletme bilgilerini al
    const businessDoc = await getDoc(doc(db, 'businesses', businessId));
    const businessData = businessDoc.data();

    const buyer: InvoiceParty = {
        name: businessData?.companyName || businessData?.brand || 'İşletme',
        address: businessData?.address?.street || '',
        city: businessData?.address?.city || '',
        postalCode: businessData?.address?.postalCode || '',
        country: 'Deutschland',
        taxId: businessData?.taxInfo?.steuernummer,
        vatId: businessData?.taxInfo?.ustIdNr,
        email: businessData?.email
    };

    const monthName = periodStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    return createInvoice({
        type: 'subscription',
        businessId,
        buyer,
        lineItems: [{
            description: `LOKMA ${planName} Abo - ${monthName}`,
            quantity: 1,
            unit: 'Monat',
            unitPrice: monthlyFee,
            taxRate: 19 // Hizmet = %19
        }],
        periodStart,
        periodEnd
    });
}

// =============================================================================
// FATURA SORGULAMA
// =============================================================================

export async function getInvoice(invoiceId: string): Promise<MerchantInvoice | null> {
    const invoiceDoc = await getDoc(doc(db, 'invoices', invoiceId));
    if (!invoiceDoc.exists()) return null;
    return invoiceDoc.data() as MerchantInvoice;
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<MerchantInvoice | null> {
    // TODO: Query by invoiceNumber
    return null;
}
