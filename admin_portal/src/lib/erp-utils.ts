/**
 * ERP Utilities - GoBD compliant invoice numbering and audit trail
 * Almanya mali mevzuatına uygun fatura numaralandırma ve değişiklik takibi
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, increment, runTransaction } from 'firebase/firestore';

// ============= INVOICE NUMBERING (GoBD COMPLIANT) =============

interface InvoiceCounterDoc {
    currentNumber: number;
    prefix: string;
    year: number;
    lastUpdated: Date;
}

/**
 * Get next sequential invoice number (GoBD compliant - no gaps allowed)
 * Format: MIRA-2026-0001
 */
export async function getNextInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const counterRef = doc(db, 'erp_counters', 'invoices');

    return await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let currentNumber = 1;
        let prefix = 'MIRA';

        if (counterDoc.exists()) {
            const data = counterDoc.data() as InvoiceCounterDoc;

            // Reset counter if new year
            if (data.year !== currentYear) {
                currentNumber = 1;
            } else {
                currentNumber = data.currentNumber + 1;
            }
            prefix = data.prefix || 'MIRA';
        }

        // Update counter
        transaction.set(counterRef, {
            currentNumber,
            prefix,
            year: currentYear,
            lastUpdated: serverTimestamp(),
        });

        // Format: MIRA-2026-0001
        const paddedNumber = String(currentNumber).padStart(4, '0');
        return `${prefix}-${currentYear}-${paddedNumber}`;
    });
}

// ============= AUDIT TRAIL (GoBD COMPLIANT) =============

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'storno' // GoBD: Fatura iptali (silme yerine)
    | 'status_change'
    | 'payment_received'
    | 'manual_correction';

interface AuditLogEntry {
    entityType: 'invoice' | 'product' | 'order' | 'business' | 'staff';
    entityId: string;
    action: AuditAction;
    previousData?: Record<string, any>;
    newData?: Record<string, any>;
    changedFields?: string[];
    performedBy: {
        uid: string;
        email: string;
        displayName?: string;
    };
    reason?: string; // Required for storno/manual corrections
    ipAddress?: string;
    userAgent?: string;
    timestamp?: any;
}

/**
 * Log an audit entry for GoBD compliance
 * All changes to financial documents must be logged
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<string> {
    const auditRef = collection(db, 'erp_audit_log');

    const logEntry = {
        ...entry,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(), // Backup timestamp for immediate display
    };

    const docRef = await addDoc(auditRef, logEntry);
    return docRef.id;
}

/**
 * Helper to detect changed fields between two objects
 */
export function getChangedFields(
    previous: Record<string, any>,
    current: Record<string, any>
): string[] {
    const changedFields: string[] = [];

    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of allKeys) {
        if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
            changedFields.push(key);
        }
    }

    return changedFields;
}

// ============= STORNO (Fatura İptali - GoBD Compliant) =============

/**
 * GoBD requires invoices never be deleted - they must be "storniert" (cancelled)
 * This creates a reversal entry and marks original as cancelled
 */
export async function stornoInvoice(
    invoiceId: string,
    reason: string,
    performedBy: { uid: string; email: string; displayName?: string }
): Promise<{ success: boolean; stornoInvoiceNumber?: string; error?: string }> {
    if (!reason || reason.trim().length < 10) {
        return { success: false, error: 'Storno sebebi en az 10 karakter olmalıdır (GoBD zorunluluğu)' };
    }

    try {
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const invoiceDoc = await getDoc(invoiceRef);

        if (!invoiceDoc.exists()) {
            return { success: false, error: 'Fatura bulunamadı' };
        }

        const invoiceData = invoiceDoc.data();

        // Get storno invoice number
        const stornoNumber = await getNextInvoiceNumber();

        // Create storno record
        const stornoRef = collection(db, 'invoices');
        await addDoc(stornoRef, {
            ...invoiceData,
            invoiceNumber: stornoNumber,
            originalInvoiceNumber: invoiceData.invoiceNumber,
            originalInvoiceId: invoiceId,
            isStorno: true,
            stornoReason: reason,
            grandTotal: -invoiceData.grandTotal, // Negative amount
            subtotal: -invoiceData.subtotal,
            taxAmount: -invoiceData.taxAmount,
            status: 'cancelled',
            createdAt: serverTimestamp(),
        });

        // Mark original as storniert
        await setDoc(invoiceRef, {
            ...invoiceData,
            status: 'cancelled',
            isCancelled: true,
            cancelledAt: serverTimestamp(),
            cancelledBy: performedBy.uid,
            cancelReason: reason,
            stornoInvoiceNumber: stornoNumber,
        }, { merge: true });

        // Log audit entry
        await logAuditEntry({
            entityType: 'invoice',
            entityId: invoiceId,
            action: 'storno',
            previousData: { status: invoiceData.status },
            newData: { status: 'cancelled', stornoInvoiceNumber: stornoNumber },
            performedBy,
            reason,
        });

        return { success: true, stornoInvoiceNumber: stornoNumber };
    } catch (error) {
        console.error('Storno error:', error);
        return { success: false, error: 'Storno işlemi başarısız' };
    }
}

// ============= KDV RATES (German VAT) =============

export const VAT_RATES = {
    STANDARD: 0.19,      // 19% - Standard rate
    REDUCED: 0.07,       // 7% - Reduced rate (food, books, etc.)
    ZERO: 0,             // 0% - Exempt
} as const;

export type VatRateType = keyof typeof VAT_RATES;

/**
 * Calculate VAT amount based on net price and rate type
 */
export function calculateVat(netAmount: number, rateType: VatRateType): number {
    return netAmount * VAT_RATES[rateType];
}

/**
 * Calculate net from gross based on VAT rate
 */
export function calculateNetFromGross(grossAmount: number, rateType: VatRateType): number {
    return grossAmount / (1 + VAT_RATES[rateType]);
}

// ============= USt-IdNr VALIDATION (German VAT ID) =============

/**
 * Basic validation for German VAT ID format: DE123456789
 */
export function validateGermanVatId(vatId: string): boolean {
    if (!vatId) return false;

    // German VAT ID: DE + 9 digits
    const germanPattern = /^DE[0-9]{9}$/;
    return germanPattern.test(vatId.replace(/\s/g, '').toUpperCase());
}
