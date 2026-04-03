import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export const metadata = {
  title: 'Datenschutzerklärung | Lokma',
  description: 'Datenschutzerklärung für die Lokma Plattform',
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-[#0f172a] text-foreground pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
      <PublicHeader themeAware={true} />
      <div className="max-w-4xl mx-auto bg-muted dark:bg-background/5 border border-border/50 rounded-[2rem] p-8 md:p-16 shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#ea184a]">Datenschutzerklärung</h1>
        <div className="space-y-6 text-muted-foreground /70 leading-relaxed text-lg">

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">1. Datenschutz auf einen Blick</h2>
          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie unsere Website (lokma.shop) und die dazugehörigen mobilen Apps (nachfolgend „Plattform“) besuchen oder nutzen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.
          </p>

          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Datenerfassung auf unserer Plattform</h3>
          <p>
            <strong>Wer ist verantwortlich für die Datenerfassung?</strong><br />
            Die Datenverarbeitung auf dieser Plattform erfolgt durch die Betreiberin:<br />
            Guelnihan Oez<br />
            Schulte-Braucks-Str. 1<br />
            41836 Hückelhoven, Deutschland<br />
            E-Mail: kontakt@lokma.shop
          </p>
          <p>
            <strong>Welche Rechte haben Sie bezüglich Ihrer Daten?</strong><br />
            Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung, Einschränkung der Verarbeitung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese jederzeit für die Zukunft widerrufen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">2. Hosting und Content Delivery Networks (CDN)</h2>
          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Vercel</h3>
          <p>
            Wir hosten unsere Website bei Vercel Inc. (Vercel). Die personenbezogenen Daten, die auf dieser Webseite erfasst werden, werden auf den Servern von Vercel gespeichert. Das können u. a. IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe und sonstige Daten, die über eine Website generiert werden, sein. Die Verwendung von Vercel erfolgt zum Zwecke einer sicheren, schnellen und effizienten Bereitstellung unseres Online-Angebots durch einen professionellen Anbieter (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Google Cloud & Firebase</h3>
          <p>
            Unsere Backend-Infrastruktur sowie die Datenbanken für Bestellungen und Nutzer-Authentifizierung werden über Google Cloud Platform und Firebase-Dienste (betrieben durch Google Ireland Limited) bereitgestellt. Diese Dienste stellen eine sichere, verschlüsselte Datenspeicherung nach modernsten Standards sicher. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">3. Datenerfassung auf unserer Plattform</h2>
          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Cookies und Skripte</h3>
          <p>
            Unsere Seiten verwenden sogenannte „Cookies“ oder ähnliche Technologien. Das sind kleine Textdateien, die auf Ihrem Endgerät abgelegt werden. Sie dienen dazu, unser Angebot nutzerfreundlicher, effektiver und sicherer zu machen (z. B. Speicherung der Login-Session, Warenkorb). Zwingend erforderliche Cookies sind gemäß Art. 6 Abs. 1 lit. f DSGVO zulässig. Für andere (z. B. Analyse-Cookies) holen wir vorher Ihre Einwilligung ein (Art. 6 Abs. 1 lit. a DSGVO).
          </p>

          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Registrierung und Eröffnung eines Kundenkontos</h3>
          <p>
            Sie können sich auf unserer Plattform registrieren, um Bestellungen aufzugeben, Lieblingsrestaurants zu speichern und frühere Bestellungen einzusehen. Die Verarbeitung der in das Registrierungsformular eingegebenen Daten (Vorname, Nachname, E-Mail-Adresse, Telefonnummer, Lieferanschrift) erfolgt zum Zwecke der Vertragserfüllung bzw. zur Durchführung vorvertraglicher Maßnahmen (Art. 6 Abs. 1 lit. b DSGVO) sowie aufgrund Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) bezüglich der Authentifizierungsdienste.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">4. Weitergabe von Daten an Dritte (Marktplatz-Prinzip)</h2>
          <p>
            Da wir als Marktplatz (Vermittler) fungieren, ist es unerlässlich, dass wir einen Teil Ihrer personenbezogenen Daten an unsere Partner-Unternehmen (z. B. Restaurants, Supermärkte) weitergeben können, damit diese Ihre Bestellung zubereiten und/oder an Sie ausliefern können.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Zweck der Dateneingabe:</strong> Vertragserfüllung (Bestellung und Lieferung von Speisen und Lebensmitteln).</li>
            <li><strong>Welche Daten werden übermittelt?</strong> Vorname, Nachname, Lieferadresse, Telefonnummer (für eventuelle Rückfragen zur Adresse) und Bestellinformationen.</li>
            <li><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.</li>
          </ul>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">5. Zahlungsanbieter</h2>
          <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Stripe</h3>
          <p>
            Wir bieten die Möglichkeit an, den Zahlungsvorgang über den Zahlungsdienstleister Stripe abzuwickeln (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland). Wenn Sie eine Zahlungsart von Stripe auswählen, werden die von Ihnen eingegebenen Zahlungsdaten (z. B. Kreditkartendaten) zusammen mit den Bestelldaten an Stripe übermittelt. 
            Die Übermittlung Ihrer Daten an Stripe erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Verarbeitung zur Erfüllung eines Vertrags) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer nahtlosen und sicheren Zahlungsabwicklung).
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">6. Löschung von Daten und Speicherdauer</h2>
          <p>
            Wir speichern Ihre personenbezogenen Daten nur so lange, wie dies zur Erreichung der hier genannten Zwecke erforderlich ist oder wie es die vom Gesetzgeber vorgesehenen vielfältigen Speicherfristen (z. B. handels- und steuerrechtliche Aufbewahrungspflichten) vorsehen. Nach Fortfall des jeweiligen Zweckes bzw. Ablauf dieser Fristen werden die entsprechenden Daten routinemäßig und entsprechend den gesetzlichen Vorschriften gesperrt oder gelöscht.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">7. Server-Log-Dateien</h2>
          <p>
            Der Provider der Seiten (bzw. unser Cloud-Anbieter) erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
            Dies sind: Browsertyp und Browserversion, verwendetes Betriebssystem, Referrer URL, Hostname des zugreifenden Rechners, Uhrzeit der Serveranfrage, IP-Adresse.
            Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <p className="mt-12 text-sm text-muted-foreground italic border-t border-border/50 pt-6">
            Stand: April 2026<br/>
            Diese Datenschutzerklärung wurde so verfasst, dass sie den strengen Anforderungen der europäischen Datenschutzgrundverordnung (DSGVO) entspricht.
          </p>

        </div>
      </div>
      <PublicFooter themeAware={true} />
    </div>
  );
}
