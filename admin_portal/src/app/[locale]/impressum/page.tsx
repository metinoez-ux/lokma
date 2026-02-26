'use client';

import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function ImpressumPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />
            <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 md:p-16 shadow-2xl">
                <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#fb335b]">Impressum</h1>
                <div className="space-y-6 text-gray-600 dark:text-white/70 leading-relaxed text-lg">
                    <p className="font-bold text-gray-900 dark:text-white">Angaben gemäß § 5 TMG</p>
                    <p>
                        <strong>Lokma GmbH</strong><br />
                        [Musterstraße 1]<br />
                        [12345 Musterstadt]<br />
                        Deutschland
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Vertreten durch:</h2>
                    <p>[Geschäftsführer Name]</p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Kontakt:</h2>
                    <p>
                        Telefon: [0123 456789]<br />
                        E-Mail: <a href="mailto:kontakt@lokma.shop" className="text-emerald-400 hover:text-emerald-300 transition-colors">kontakt@lokma.shop</a>
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Registereintrag:</h2>
                    <p>
                        Eintragung im Handelsregister.<br />
                        Registergericht: [Amtsgericht Musterstadt]<br />
                        Registernummer: [HRB 123456]
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Umsatzsteuer-ID:</h2>
                    <p>
                        Umsatzsteuer-Identifikationsnummer gemäß §27 a Umsatzsteuergesetz:<br />
                        [DE 123456789]
                    </p>

                    <div className="mt-12 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200/80 text-sm">
                        Haftungsausschluss (Disclaimer): Dies ist eine Platzhalterseite. Bitte lassen Sie diese Inhalte von einem Rechtsbeistand prüfen, um volle Abmahnsicherheit zu gewährleisten.
                    </div>
                </div>
            </div>
            <PublicFooter themeAware={true} /></div>
    );
}
