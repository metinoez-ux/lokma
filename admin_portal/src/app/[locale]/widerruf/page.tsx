'use client';

import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function WiderrufsbelehrungPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />
            <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 md:p-16 shadow-2xl">
                <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#fb335b]">Widerrufsbelehrung</h1>
                <div className="space-y-6 text-gray-600 dark:text-white/70 leading-relaxed text-lg">

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Widerrufsrecht</h2>
                    <p>
                        Sie haben grundsätzlich das Recht, binnen vierzehn Tagen ohne Angabe von Gründen einen mit Lokma oder über Lokma geschlossenen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses bzw. der Warenübergabe.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Vorzeitiges Erlöschen des Widerrufsrechts</h2>
                    <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl mb-4">
                        <p className="text-gray-900 dark:text-white font-medium">Bedeutende Ausnahme für Speisenlieferungen:</p>
                        <p className="mt-2">
                            Gemäß § 312g Abs. 2 Nr. 2 BGB besteht das Widerrufsrecht nicht bei Verträgen zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde (z. B. gelieferte Speisen und Getränke aus Restaurants).
                        </p>
                    </div>
                    <p>
                        Sobald eine Bestellung vom Restaurant angenommen und zubereitet wird, ist ein Widerruf der Bestellung von zubereitetem Essen in der Regel ausgeschlossen.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Folgen des Widerrufs</h2>
                    <p>
                        Wenn Sie einen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Muster-Widerrufsformular</h2>
                    <p className="bg-gray-100 dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 font-mono text-sm leading-8">
                        (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)<br /><br />
                        An Lokma GmbH, [Musterstraße 1], [12345 Musterstadt], E-Mail: kontakt@lokma.shop:<br /><br />
                        - Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)<br />
                        - Bestellt am (*) / erhalten am (*)<br />
                        - Name des/der Verbraucher(s)<br />
                        - Anschrift des/der Verbraucher(s)<br />
                        - Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)<br />
                        - Datum<br /><br />
                        (*) Unzutreffendes streichen.
                    </p>

                    <div className="mt-12 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200/80 text-sm">
                        Hinweis: Platzhalter-Text für Widerrufsbelehrung. Bitte von einem Rechtsbeistand prüfen lassen.
                    </div>
                </div>
            </div>
            <PublicFooter themeAware={true} /></div>
    );
}
