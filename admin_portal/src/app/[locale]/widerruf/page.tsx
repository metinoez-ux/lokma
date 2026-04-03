'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const titles: Record<string, string> = {
  de: 'Widerrufsbelehrung',
  tr: 'Cayma Hakkı Bilgilendirmesi',
  en: 'Cancellation Policy',
  fr: 'Politique d\'annulation',
  it: 'Politica di cancellazione',
  es: 'Política de cancelación',
};

export default function WiderrufsbelehrungPage() {
  const locale = useLocale();
  const title = titles[locale] || titles['en'];

  return (
    <div className="min-h-screen bg-background dark:bg-[#0f172a] text-foreground pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
      <PublicHeader themeAware={true} />
      <div className="max-w-4xl mx-auto bg-muted dark:bg-background/5 border border-border/50 rounded-[2rem] p-8 md:p-16 shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#ea184a]">{title}</h1>
        <div className="space-y-6 text-muted-foreground /70 leading-relaxed text-lg">

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">Widerrufsrecht</h2>
          <p>
            Verbraucher haben grundsätzlich das Recht, binnen vierzehn Tagen ohne Angabe von Gründen einen Vertrag zu widerrufen, sofern gesetzlich nicht etwas anderes geregelt ist. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses bzw. ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter die Waren in Besitz genommen haben.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">Vorzeitiges Erlöschen des Widerrufsrechts (Speisenlieferungen)</h2>
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl mb-4 text-red-900 dark:text-red-300">
            <p className="font-bold">Bedeutende Ausnahme für Speisen- und Lebensmittellieferungen:</p>
            <p className="mt-2 text-base">
              Gemäß § 312g Abs. 2 Nr. 2 BGB besteht das Widerrufsrecht nicht bei Verträgen zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde (z. B. frisch zubereitete Speisen, Getränke aus Restaurants oder frische Lebensmittel vom Supermarkt/Metzger).
            </p>
          </div>
          <p>
            Sobald eine Bestellung von verderblichen Waren oder Speisen aufgeben wurde und diese vom Partner angenommen oder bereits zubereitet wird, ist ein Widerruf dieser Bestellung gesetzlich ausgeschlossen. Bei Beschwerden kontaktieren Sie bitte den Betreiber zur Lösungsfindung.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">Folgen des Widerrufs (Für widerrufbare Waren)</h2>
          <p>
            Wenn Sie einen Vertrag über widerrufbare Artikel widerrufen, haben wir oder das jeweilige Partnerunternehmen Ihnen alle diesbezüglichen Zahlungen, die wir oder der Partner von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns oder dem Partner eingegangen ist.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">Muster-Widerrufsformular</h2>
          <p className="bg-muted dark:bg-background/5 p-6 rounded-xl border border-border/50 font-mono text-sm leading-8">
            (Wenn Sie den Vertrag für widerrufbare Waren widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)<br /><br />
            An:<br />
            Guelnihan Oez<br />
            Schulte-Braucks-Str. 1<br />
            41836 Hückelhoven<br />
            Deutschland<br />
            E-Mail: kontakt@lokma.shop<br /><br />
            - Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)<br />
            - Bestellt am (*) / erhalten am (*)<br />
            - Name des/der Verbraucher(s)<br />
            - Anschrift des/der Verbraucher(s)<br />
            - Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)<br />
            - Datum<br /><br />
            (*) Unzutreffendes streichen.
          </p>
        </div>
      </div>
      <PublicFooter themeAware={true} />
    </div>
  );
}
