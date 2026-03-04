'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CompanySettings, InvoiceParty, LOKMA_COMPANY_INFO } from '@/types';

const COMPANY_SETTINGS_DOC = 'settings/company';

/**
 * Load company settings from Firestore.
 * Falls back to LOKMA_COMPANY_INFO if not yet configured.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
    try {
        const docRef = doc(db, COMPANY_SETTINGS_DOC);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return snapshot.data() as CompanySettings;
        }
    } catch (error) {
        console.error('Failed to load company settings:', error);
    }

    // Fallback to hardcoded defaults
    return {
        companyName: LOKMA_COMPANY_INFO.name,
        legalForm: 'gmbh',
        address: LOKMA_COMPANY_INFO.address,
        postalCode: LOKMA_COMPANY_INFO.postalCode,
        city: LOKMA_COMPANY_INFO.city,
        country: LOKMA_COMPANY_INFO.country,
        phone: LOKMA_COMPANY_INFO.phone || '',
        email: LOKMA_COMPANY_INFO.email || '',
        taxId: LOKMA_COMPANY_INFO.taxId || '',
        vatId: LOKMA_COMPANY_INFO.vatId || '',
        iban: LOKMA_COMPANY_INFO.iban || '',
        bic: LOKMA_COMPANY_INFO.bic || '',
    };
}

/**
 * Save company settings to Firestore.
 */
export async function saveCompanySettings(
    settings: CompanySettings,
    userId: string
): Promise<void> {
    const docRef = doc(db, COMPANY_SETTINGS_DOC);
    await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
    }, { merge: true });
}

/**
 * Convert CompanySettings to InvoiceParty for invoice generation.
 * This replaces the hardcoded LOKMA_COMPANY_INFO usage.
 */
export function companySettingsToInvoiceParty(settings: CompanySettings): InvoiceParty {
    return {
        name: settings.companyName,
        address: settings.address,
        city: settings.city,
        postalCode: settings.postalCode,
        country: settings.country,
        taxId: settings.taxId,
        vatId: settings.vatId,
        email: settings.email,
        phone: settings.phone,
        iban: settings.iban,
        bic: settings.bic,
    };
}
