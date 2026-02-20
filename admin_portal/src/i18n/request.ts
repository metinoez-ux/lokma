import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    let messages = {};

    try {
        // Fetch dynamic translations from Firestore using initialized Admin SDK
        const { db } = getFirebaseAdmin();
        const docSnap = await db.collection('translations').doc(locale).get();
        if (docSnap.exists) {
            messages = docSnap.data() || {};
        } else {
            // Fallback to local files if Firestore doc doesn't exist
            console.warn(`Translation document for locale '${locale}' not found in Firestore. Falling back to local JSON.`);
            messages = (await import(`../../messages/${locale}.json`)).default;
        }
    } catch (error) {
        console.error(`Failed to fetch translations for locale '${locale}':`, error);
        try {
            messages = (await import(`../../messages/${locale}.json`)).default;
        } catch (e) { /* ignore fallback error */ }
    }

    return {
        locale,
        messages
    };
});
