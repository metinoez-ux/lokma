'use client';

import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function DatenschutzPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />
            <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 md:p-16 shadow-2xl">
                <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#fb335b]">Datenschutzerklärung</h1>
                <div className="space-y-6 text-gray-600 dark:text-white/70 leading-relaxed text-lg">

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">1. Datenschutz auf einen Blick</h2>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-2">Allgemeine Hinweise</h3>
                    <p>
                        Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
                    </p>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-2">Datenerfassung auf dieser Website</h3>
                    <p>
                        <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />
                        Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">2. Hosting und Content Delivery Networks (CDN)</h2>
                    <p>
                        Diese Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.
                        (Firebase Hosting, Google Cloud).
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">3. Allgemeine Hinweise und Pflichtinformationen</h2>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-2">Datenschutz</h3>
                    <p>
                        Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
                    </p>

                    <div className="mt-12 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200/80 text-sm">
                        Hinweis: Platzhalter-Text DSGVO/KVKK. Bitte durch den von einem Anwalt freigegebenen vollständigen Text ersetzen, einschließlich Abschnitte für Cookies, Zahlungsanbieter (Stripe), und Firebase Auth/Analytics.
                    </div>
                </div>
            </div>
            <PublicFooter themeAware={true} /></div>
    );
}
