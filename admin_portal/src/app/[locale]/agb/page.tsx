'use client';

import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function AGBPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />
            <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 md:p-16 shadow-2xl">
                <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#fb335b]">Allgemeine Geschäftsbedingungen (AGB)</h1>

                <div className="space-y-6 text-gray-600 dark:text-white/70 leading-relaxed text-lg">
                    <p className="italic text-gray-900 dark:text-white/50 mb-8">Zuletzt aktualisiert: [Datum einfügen]</p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">1. Geltungsbereich</h2>
                    <p>
                        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle über die Lokma-App und Website (lokma.shop) geschlossenen Verträge zwischen der Lokma GmbH und den Nutzern (Kunden, Restaurants/Partner und Kuriere).
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">2. Vertragsabschluss</h2>
                    <p>
                        Lokma stellt eine Plattform zur Verfügung, die Kunden und Restaurants/Händler miteinander verbindet. Verträge über die Lieferung von Speisen kommen direkt zwischen dem Kunden und dem jeweiligen Restaurant zustande. Lokma tritt lediglich als Vermittler auf.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">3. Preise und Zahlungsbedingungen</h2>
                    <p>
                        Die auf der Plattform angegebenen Preise beinhalten die gesetzliche Mehrwertsteuer. Zahlungen werden über sichere Drittanbieter (z.B. Stripe) abgewickelt.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">4. Haftung</h2>
                    <p>
                        Lokma haftet nicht für die Qualität oder Beschaffenheit der von den Restaurants gelieferten Speisen. Bei Mängeln oder Problemen bezüglich der Bestellung ist primär das jeweilige Restaurant der Ansprechpartner, Lokma bietet jedoch einen vermittelnden Kundenservice an.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">5. Besondere Bedingungen für Partner und Kuriere</h2>
                    <p>
                        Das Rechtsverhältnis zwischen Lokma und den teilnehmenden Restaurants (Partner) sowie den (selbstständigen) Kurieren wird durch separate Verträge geregelt, die bei Registrierung im Vermittlungsportal akzeptiert werden müssen.
                    </p>

                    <div className="mt-12 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200/80 text-sm">
                        Hinweis: Platzhalter-Text. AGBs müssen speziell an das Plattformmodell (Marketplace vs. Eigener Verkauf) angepasst werden. Rechtsberatung dringend empfohlen.
                    </div>
                </div>
            </div>
            <PublicFooter themeAware={true} /></div>
    );
}
