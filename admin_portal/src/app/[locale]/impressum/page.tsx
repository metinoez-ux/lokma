'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

// ─── i18n Labels ───────────────────────────────────────────────────
const t: Record<string, Record<string, string>> = {
    title: {
        de: 'Impressum', tr: 'Yasal Bilgiler', en: 'Legal Notice',
        fr: 'Mentions légales', it: 'Note legali', es: 'Aviso legal', nl: 'Juridische kennisgeving',
    },
    legalBasis: {
        de: 'Angaben gemäß § 5 TMG',
        tr: '§ 5 TMG uyarınca bilgiler',
        en: 'Information pursuant to § 5 TMG (German Telemedia Act)',
        fr: 'Informations conformément au § 5 TMG',
        it: 'Informazioni ai sensi del § 5 TMG',
        es: 'Información según § 5 TMG',
        nl: 'Informatie volgens § 5 TMG',
    },
    owner: {
        de: 'Inhaber / Verantwortlich:',
        tr: 'Sahip / Sorumlu Kişi:',
        en: 'Owner / Responsible Person:',
        fr: 'Propriétaire / Responsable :',
        it: 'Titolare / Responsabile:',
        es: 'Titular / Responsable:',
        nl: 'Eigenaar / Verantwoordelijke:',
    },
    contact: {
        de: 'Kontakt', tr: 'İletişim', en: 'Contact',
        fr: 'Contact', it: 'Contatto', es: 'Contacto', nl: 'Contact',
    },
    phone: {
        de: 'Telefon', tr: 'Telefon', en: 'Phone',
        fr: 'Téléphone', it: 'Telefono', es: 'Teléfono', nl: 'Telefoon',
    },
    email: {
        de: 'E-Mail', tr: 'E-Posta', en: 'Email',
        fr: 'E-mail', it: 'E-mail', es: 'Correo electrónico', nl: 'E-mail',
    },
    taxInfo: {
        de: 'Steuerliche Angaben',
        tr: 'Vergi Bilgileri',
        en: 'Tax Information',
        fr: 'Informations fiscales',
        it: 'Informazioni fiscali',
        es: 'Información fiscal',
        nl: 'Belastinginformatie',
    },
    vatId: {
        de: 'Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG',
        tr: '§ 27a UStG uyarınca KDV Kimlik Numarası',
        en: 'VAT Identification Number pursuant to § 27a UStG',
        fr: 'Numéro d\'identification TVA conformément au § 27a UStG',
        it: 'Numero di identificazione IVA ai sensi del § 27a UStG',
        es: 'Número de identificación del IVA según § 27a UStG',
        nl: 'BTW-nummer conform § 27a UStG',
    },
    taxNumber: {
        de: 'Steuernummer',
        tr: 'Vergi Numarası',
        en: 'Tax Number',
        fr: 'Numéro fiscal',
        it: 'Codice fiscale',
        es: 'Número fiscal',
        nl: 'Belastingnummer',
    },
    disputeResolution: {
        de: 'Streitschlichtung',
        tr: 'Uyuşmazlık Çözümü',
        en: 'Dispute Resolution',
        fr: 'Résolution des litiges',
        it: 'Risoluzione delle controversie',
        es: 'Resolución de disputas',
        nl: 'Geschillenbeslechting',
    },
    disputeText: {
        de: 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
        tr: 'Avrupa Komisyonu çevrimiçi uyuşmazlık çözümü (OS) için bir platform sunmaktadır: https://ec.europa.eu/consumers/odr/. E-posta adresimizi yukarıda bulabilirsiniz. Tüketici uzlaşma kurulu önünde uyuşmazlık çözüm sürecine katılma yükümlülüğümüz bulunmamaktadır.',
        en: 'The European Commission provides a platform for online dispute resolution (OS): https://ec.europa.eu/consumers/odr/. Our email address can be found above. We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.',
        fr: 'La Commission européenne met à disposition une plateforme de règlement en ligne des litiges (ODR) : https://ec.europa.eu/consumers/odr/. Notre adresse e-mail se trouve ci-dessus. Nous ne sommes ni disposés ni obligés de participer à des procédures de règlement des litiges devant un organisme de médiation des consommateurs.',
        it: 'La Commissione europea mette a disposizione una piattaforma per la risoluzione online delle controversie (ODR): https://ec.europa.eu/consumers/odr/. Il nostro indirizzo e-mail è indicato sopra. Non siamo disposti né obbligati a partecipare a procedimenti di risoluzione delle controversie davanti a un organismo di conciliazione dei consumatori.',
        es: 'La Comisión Europea proporciona una plataforma para la resolución de litigios en línea (ODR): https://ec.europa.eu/consumers/odr/. Nuestra dirección de correo electrónico se encuentra arriba. No estamos obligados ni dispuestos a participar en procedimientos de resolución de litigios ante una junta de arbitraje de consumidores.',
        nl: 'De Europese Commissie biedt een platform voor online geschillenbeslechting (OS): https://ec.europa.eu/consumers/odr/. Ons e-mailadres vindt u hierboven. Wij zijn niet bereid of verplicht om deel te nemen aan geschillenbeslechtingsprocedures voor een consumentenarbitragecommissie.',
    },
    liability: {
        de: 'Haftung für Inhalte',
        tr: 'İçerik Sorumluluğu',
        en: 'Liability for Content',
        fr: 'Responsabilité du contenu',
        it: 'Responsabilità per i contenuti',
        es: 'Responsabilidad por contenido',
        nl: 'Aansprakelijkheid voor inhoud',
    },
    liabilityText: {
        de: 'Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
        tr: 'Hizmet sağlayıcı olarak, § 7 md.1 TMG uyarınca kendi içeriklerimizden genel yasalar çerçevesinde sorumluyuz. § 8-10 TMG uyarınca, iletilen veya depolanan üçüncü taraf bilgilerini izleme veya yasa dışı faaliyetlere işaret eden koşulları araştırma yükümlülüğümüz bulunmamaktadır.',
        en: 'As a service provider, we are responsible for our own content on these pages in accordance with § 7 para.1 TMG under general laws. According to §§ 8 to 10 TMG, as a service provider we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.',
        fr: 'En tant que prestataire de services, nous sommes responsables de nos propres contenus sur ces pages conformément au § 7 alinéa 1 TMG. Selon les §§ 8 à 10 TMG, nous ne sommes pas tenus de surveiller les informations transmises ou stockées par des tiers.',
        it: 'In qualità di fornitore di servizi, siamo responsabili dei nostri contenuti su queste pagine ai sensi del § 7 comma 1 TMG. Ai sensi dei §§ 8-10 TMG, non siamo obbligati a monitorare le informazioni di terzi trasmesse o memorizzate.',
        es: 'Como proveedor de servicios, somos responsables de nuestros propios contenidos en estas páginas de acuerdo con el § 7 párrafo 1 TMG. Según los §§ 8 a 10 TMG, no estamos obligados a supervisar la información de terceros transmitida o almacenada.',
        nl: 'Als dienstverlener zijn wij verantwoordelijk voor onze eigen inhoud op deze pagina\'s overeenkomstig § 7 lid 1 TMG. Volgens §§ 8 tot 10 TMG zijn wij niet verplicht om doorgegeven of opgeslagen informatie van derden te controleren.',
    },
};

const g = (key: string, locale: string) => t[key]?.[locale] || t[key]?.['en'] || '';

export default function ImpressumPage() {
    const locale = useLocale();

    return (
        <div className="min-h-screen bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white pt-32 pb-20 px-4 md:px-20 lg:px-40 font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />
            <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 md:p-16 shadow-2xl">
                <h1 className="text-4xl md:text-5xl font-black mb-10 tracking-tight text-[#fb335b]">{g('title', locale)}</h1>
                <div className="space-y-6 text-gray-600 dark:text-white/70 leading-relaxed text-lg">

                    {/* § 5 TMG */}
                    <p className="font-bold text-gray-900 dark:text-white">{g('legalBasis', locale)}</p>
                    <p>
                        <strong>Guelnihan Oez</strong><br />
                        Schulte-Braucks-Str. 1<br />
                        41836 Hückelhoven<br />
                        Deutschland / Germany
                    </p>

                    {/* Inhaber */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">{g('owner', locale)}</h2>
                    <p>Guelnihan Oez</p>

                    {/* Kontakt */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">{g('contact', locale)}</h2>
                    <p>
                        {g('phone', locale)}: <a href="tel:+491784443475" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors">+49 178 4443475</a><br />
                        {g('email', locale)}: <a href="mailto:kontakt@lokma.shop" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors">kontakt@lokma.shop</a>
                    </p>

                    {/* Steuerliche Angaben */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">{g('taxInfo', locale)}</h2>
                    <p>
                        {g('vatId', locale)}:<br />
                        <strong className="text-gray-900 dark:text-white">DE361623128</strong>
                    </p>
                    <p>
                        {g('taxNumber', locale)}:<br />
                        <strong className="text-gray-900 dark:text-white">208/5105/4145</strong>
                    </p>

                    {/* Haftung für Inhalte */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">{g('liability', locale)}</h2>
                    <p className="text-base">{g('liabilityText', locale)}</p>

                    {/* Streitschlichtung */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4 border-b border-gray-200 dark:border-white/10 pb-2">{g('disputeResolution', locale)}</h2>
                    <p className="text-base">{g('disputeText', locale)}</p>
                </div>
            </div>
            <PublicFooter themeAware={true} />
        </div>
    );
}
