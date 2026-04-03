'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const titles: Record<string, string> = {
 de: 'Datenschutzerklärung',
 tr: 'Gizlilik Politikası',
 en: 'Privacy Policy',
 fr: 'Politique de confidentialité',
 it: 'Informativa sulla privacy',
 es: 'Política de privacidad',
};

export default function DatenschutzPage() {
 const locale = useLocale();
 const title = titles[locale] || titles['en'];

 return (
 <div className="min-h-screen bg-background dark:bg-[#0f172a] text-foreground pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
 <PublicHeader themeAware={true} />
 <div className="max-w-4xl mx-auto bg-muted dark:bg-background/5 border border-border/50 rounded-[2rem] p-8 md:p-16 shadow-2xl">
 <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#ea184a]">{title}</h1>
 <div className="space-y-6 text-muted-foreground /70 leading-relaxed text-lg">

 <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">1. Datenschutz auf einen Blick</h2>
 <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Allgemeine Hinweise</h3>
 <p>
 Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
 </p>

 <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Datenerfassung auf dieser Website</h3>
 <p>
 <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />
 Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
 </p>

 <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">2. Hosting und Content Delivery Networks (CDN)</h2>
 <p>
 Diese Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.
 (Firebase Hosting, Google Cloud).
 </p>

 <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">3. Allgemeine Hinweise und Pflichtinformationen</h2>
 <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Datenschutz</h3>
 <p>
 Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
 </p>

 <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-border/50 pb-2">4. Datenerfassung auf unserer Website</h2>
 <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Cookies</h3>
 <p className="mb-4">
 Unsere Internetseiten verwenden so genannte „Cookies“. Cookies sind kleine Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.
 </p>

 <h3 className="text-xl font-bold text-foreground mt-6 mb-2">Google & Firebase Services</h3>
 <p className="mb-4">
 Wir nutzen auf unserer Website Dienste von Google Cloud und Firebase (z.B. Firebase Authentication). Durch die Nutzung dieser Dienste können Daten (wie IP-Adresse, Zeitraum des Besuchs) an Server von Google in den USA übertragen werden. Die Nutzung von Firebase erfolgt im Interesse einer sicheren, schnellen und effizienten Bereitstellung unserer Dienste.
 </p>
 </div>
 </div>
 <PublicFooter themeAware={true} /></div>
 );
}
