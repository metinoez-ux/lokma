/**
 * Invoice Generation Service
 * 
 * Aylık fatura oluşturma: sabit ücret + provizyon + aşım ücretleri
 */

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { ButcherSubscriptionPlan } from '@/types';
import { subscriptionService } from './subscriptionService';

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'subscription' | 'commission' | 'overage' | 'perOrder' | 'other';
}

export interface Invoice {
    id?: string;
    businessId: string;
    businessName: string;

    // Fatura Dönemi
    periodStart: Date;
    periodEnd: Date;
    invoiceNumber: string;

    // Kalemler
    lineItems: InvoiceLineItem[];

    // Toplamlar
    subtotal: number;
    tax: number;
    taxRate: number;        // %19 Almanya KDV
    total: number;
    currency: string;

    // Durum
    status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
    dueDate: Date;
    paidAt?: Date;

    // Zaman Damgaları
    createdAt: Date;
    issuedAt?: Date;
}

/**
 * Belirli bir işletme için aylık fatura oluştur
 */
export const generateMonthlyInvoice = async (
    businessId: string,
    year: number,
    month: number // 0-indexed (0 = Ocak)
): Promise<Invoice | null> => {
    try {
        // İşletme bilgisini al
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) return null;

        const businessData = businessDoc.data();
        const businessName = businessData.name || businessData.businessName || 'İsimsiz İşletme';

        // Plan bilgisini al
        const planId = businessData.subscriptionPlan || businessData.plan || 'free';
        const plans = await subscriptionService.getAllPlans();
        const plan = plans.find(p => p.id === planId || p.code === planId);

        if (!plan) return null;

        // Dönem bilgisi
        const periodStart = new Date(year, month, 1);
        const periodEnd = new Date(year, month + 1, 0); // Ayın son günü
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Kullanım verilerini al
        const usage = businessData.usage || {};
        const monthlyOrders = usage.orders?.[monthKey] || 0;
        const monthlyCommission = usage.totalCommission?.[monthKey] || 0;
        const monthlyPush = usage.push?.[monthKey] || 0;
        const monthlyTableReservations = usage.tableReservations?.[monthKey] || 0;

        // Fatura kalemlerini oluştur
        const lineItems: InvoiceLineItem[] = [];

        // 1. Sabit Abonelik Ücreti
        if (plan.monthlyFee > 0) {
            lineItems.push({
                description: `${plan.name} Plan - Aylık Abonelik`,
                quantity: 1,
                unitPrice: plan.monthlyFee,
                total: plan.monthlyFee,
                type: 'subscription'
            });
        }

        // 2. Toplam Provizyon
        if (monthlyCommission > 0) {
            lineItems.push({
                description: `Sipariş Provizyonu (${monthlyOrders} sipariş)`,
                quantity: monthlyOrders,
                unitPrice: monthlyCommission / monthlyOrders,
                total: monthlyCommission,
                type: 'commission'
            });
        }

        // 3. Sipariş Aşım Ücreti
        if (plan.orderLimit !== null && monthlyOrders > plan.orderLimit) {
            const overageOrders = monthlyOrders - plan.orderLimit;
            const overageTotal = overageOrders * (plan.orderOverageFee || 0);
            if (overageTotal > 0) {
                lineItems.push({
                    description: `Sipariş Aşım Ücreti (${overageOrders} adet)`,
                    quantity: overageOrders,
                    unitPrice: plan.orderOverageFee || 0,
                    total: overageTotal,
                    type: 'overage'
                });
            }
        }

        // 4. Masa Rezervasyon Aşım Ücreti
        if (plan.tableReservationLimit !== null && monthlyTableReservations > plan.tableReservationLimit) {
            const overageReservations = monthlyTableReservations - plan.tableReservationLimit;
            const overageTotal = overageReservations * (plan.tableReservationOverageFee || 0);
            if (overageTotal > 0) {
                lineItems.push({
                    description: `Masa Rezervasyon Aşım (${overageReservations} adet)`,
                    quantity: overageReservations,
                    unitPrice: plan.tableReservationOverageFee || 0,
                    total: overageTotal,
                    type: 'overage'
                });
            }
        }

        // Toplamları hesapla
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        const taxRate = 19; // Almanya KDV
        const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        // Fatura numarası oluştur
        const invoiceNumber = `INV-${businessId.slice(-4).toUpperCase()}-${monthKey.replace('-', '')}`;

        // Vade tarihi (ayın 15'i)
        const dueDate = new Date(year, month + 1, 15);

        const invoice: Invoice = {
            businessId,
            businessName,
            periodStart,
            periodEnd,
            invoiceNumber,
            lineItems,
            subtotal,
            tax,
            taxRate,
            total,
            currency: 'EUR',
            status: 'draft',
            dueDate,
            createdAt: new Date()
        };

        return invoice;
    } catch (error) {
        console.error('Error generating invoice:', error);
        return null;
    }
};

/**
 * Faturayı Firestore'a kaydet
 */
export const saveInvoice = async (invoice: Invoice): Promise<string | null> => {
    try {
        const docRef = await addDoc(collection(db, 'invoices'), {
            ...invoice,
            createdAt: Timestamp.fromDate(invoice.createdAt),
            periodStart: Timestamp.fromDate(invoice.periodStart),
            periodEnd: Timestamp.fromDate(invoice.periodEnd),
            dueDate: Timestamp.fromDate(invoice.dueDate)
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving invoice:', error);
        return null;
    }
};

/**
 * İşletmenin tahmini aylık faturasını hesapla (canlı önizleme)
 */
export const getEstimatedInvoice = async (businessId: string): Promise<Invoice | null> => {
    const now = new Date();
    return generateMonthlyInvoice(businessId, now.getFullYear(), now.getMonth());
};

export const invoiceService = {
    generateMonthlyInvoice,
    saveInvoice,
    getEstimatedInvoice
};
