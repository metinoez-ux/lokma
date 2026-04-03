'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const titles: Record<string, string> = {
  de: 'Allgemeine Geschäftsbedingungen (AGB)',
  tr: 'Genel İşlem Koşulları (AGB)',
  en: 'General Terms and Conditions (GTC)',
  fr: 'Conditions Générales de Vente (CGV)',
  it: 'Condizioni Generali di Contratto (CGC)',
  es: 'Términos y Condiciones Generales (TCG)',
};

export default function AGBPage() {
  const locale = useLocale();
  const title = titles[locale] || titles['en'];

  return (
    <div className="min-h-screen bg-background dark:bg-[#0f172a] text-foreground pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
      <PublicHeader themeAware={true} />
      <div className="max-w-4xl mx-auto bg-muted dark:bg-background/5 border border-border/50 rounded-[2rem] p-8 md:p-16 shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#ea184a]">{title}</h1>

        <div className="space-y-6 text-muted-foreground /70 leading-relaxed text-lg">
          <p className="italic text-foreground /50 mb-8">Zuletzt aktualisiert: 03. April 2026</p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">1. Geltungsbereich und Vertragsgegenstand</h2>
          <p>
            Diese Allgemeinen Nutzungsbedingungen (im Folgenden „AGB“) gelten für die Nutzung der Lokma-App und der Website (lokma.shop), 
            betrieben von Guelnihan Oez, Schulte-Braucks-Str. 1, 41836 Hückelhoven, Deutschland (im Folgenden „Lokma“ oder „wir“).
            Lokma stellt einen digitalen Marktplatz zur Verfügung, der Kunden mit lokalen Partnerunternehmen (z.B. Restaurants, Supermärkte, Metzger, Blumenläden) verbindet.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">2. Vermittlungsrolle von Lokma</h2>
          <p>
            Lokma agiert ausschließlich als Vermittler von Bestellungen zwischen dem Kunden und dem jeweiligen lokalen Partner. 
            Ein Kauf- bzw. Liefervertrag über die ausgewählten Waren oder Speisen kommt ausschließlich direkt zwischen dem Kunden und dem anbietenden Partnerunternehmen zustande. 
            Lokma übernimmt keine Gewährleistung für die Beschaffenheit, Menge, Qualität oder pünktliche Lieferung der Waren.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">3. Registrierung und Nutzerkonto</h2>
          <p>
            Nutzer müssen für bestimmte Funktionen der Plattform ein Konto anlegen. Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und die Zugangsdaten geheim zu halten. 
            Lokma behält sich das Recht vor, Konten bei einem Verstoß gegen diese AGB oder bei missbräuchlicher Nutzung vorübergehend oder dauerhaft zu sperren.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">4. Preise und Zahlungsbedingungen</h2>
          <p>
            Die auf der Plattform angegebenen Preise der Partner verstehen sich inklusive der gesetzlichen Mehrwertsteuer. 
            Die Bezahlung erfolgt bargeldlos über integrierte Drittanbieter (z.B. Stripe) oder, sofern angeboten, in bar bei der Lieferung. Im Falle von Online-Zahlungen treuhändet Lokma den Rechnungsbetrag für den Partner ein.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">5. Stornierung und Widerrufsrecht</h2>
          <p>
            Da es sich bei den angebotenen Produkten überwiegend um verderbliche Waren (Lebensmittel) oder Speisen handelt, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde, besteht für diese kein gesetzliches Widerrufsrecht (§ 312g Abs. 2 Nr. 2 BGB). 
            Etwaige Stornierungen vor der Zubereitung müssen direkt mit dem jeweiligen Partner abgestimmt werden; Lokma gewährt keinen automatischen Anspruch auf Stornierung.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">6. Haftung</h2>
          <p>
            Lokma haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach den gesetzlichen Bestimmungen. Für leichte Fahrlässigkeit haftet Lokma nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), 
            wobei die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt ist. Jegliche Haftung für die verkauften Waren, Inhaltsstoffe (Allergene) und Lieferverspätungen der Partner ist ausdrücklich ausgeschlossen, da Lokma lediglich Vermittler ist.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">7. Datenschutz</h2>
          <p>
            Die Erhebung und Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung. 
            Zur Durchführung der Bestellung leiten wir die erforderlichen Daten (Name, Adresse, Telefonnummer) an den jeweiligen Lieferpartner weiter.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">8. Schlussbestimmungen</h2>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. 
            Plattform der EU-Kommission zur Online-Streitbeilegung: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">https://ec.europa.eu/consumers/odr</a>. 
            Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit.
          </p>
        </div>
      </div>
      <PublicFooter themeAware={true} />
    </div>
  );
}
