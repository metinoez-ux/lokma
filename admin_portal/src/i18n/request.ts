import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    let messages: any = {};
    let localMessages: any = {};

    try {
        // Always load local fallback messages first. We use a switch statement 
        // because dynamic imports like `await import('../../messages/${locale}.json')` 
        // might fail to bundle correctly in Next.js edge/turbopack environments.
        switch (locale) {
            case 'en': localMessages = (await import('../../messages/en.json')).default; break;
            case 'de': localMessages = (await import('../../messages/de.json')).default; break;
            case 'fr': localMessages = (await import('../../messages/fr.json')).default; break;
            case 'it': localMessages = (await import('../../messages/it.json')).default; break;
            case 'es': localMessages = (await import('../../messages/es.json')).default; break;
            case 'tr':
            default: localMessages = (await import('../../messages/tr.json')).default; break;
        }
    } catch (e) {
        console.warn(`Local fallback messages for '${locale}' could not be loaded.`, e);
    }

    try {
        // Fetch dynamic translations from Firestore using the Client SDK
        // This is necessary because Turbopack bundles request.ts into the edge middleware,
        // and firebase-admin (Node.js) causes 'node:process' missing errors in Firebase Edge.
        const docRef = doc(db, 'translations', locale as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const firestoreMessages = docSnap.data() || {};

            // Deep merge function
            const isObject = (item: any) => (item && typeof item === 'object' && !Array.isArray(item));
            const deepMerge = (target: any, source: any) => {
                let output = Object.assign({}, target);
                if (isObject(target) && isObject(source)) {
                    Object.keys(source).forEach(key => {
                        if (isObject(source[key])) {
                            if (!(key in target))
                                Object.assign(output, { [key]: source[key] });
                            else
                                output[key] = deepMerge(target[key], source[key]);
                        } else {
                            Object.assign(output, { [key]: source[key] });
                        }
                    });
                }
                return output;
            };

            // Merge Firestore messages OVER the local messages
            messages = deepMerge(localMessages, firestoreMessages);
        } else {
            // Fallback completely to local files if Firestore doc doesn't exist
            console.warn(`Translation document for locale '${locale}' not found in Firestore. Using only local JSON.`);
            messages = localMessages;
        }
    } catch (error) {
        console.error(`Failed to fetch translations for locale '${locale}':`, error);
        messages = localMessages;
    }

    return {
        locale,
        messages
    };
});

