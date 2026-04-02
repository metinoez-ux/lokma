'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: { title: 'KVKK / DSGVO Informationstext', updated: 'Letzte Aktualisierung: Januar 2024' },
    tr: { title: 'KVKK / DSGVO Aydınlatma Metni', updated: 'Son güncelleme: Ocak 2024' },
    en: { title: 'KVKK / GDPR Information Notice', updated: 'Last updated: January 2024' },
    fr: { title: 'KVKK / RGPD Avis d\'information', updated: 'Dernière mise à jour : janvier 2024' },
    it: { title: 'KVKK / GDPR Informativa', updated: 'Ultimo aggiornamento: gennaio 2024' },
    es: { title: 'KVKK / RGPD Aviso informativo', updated: 'Ultima actualizacion: enero 2024' },
    nl: { title: 'KVKK / AVG Privacyverklaring', updated: 'Laatst bijgewerkt: januari 2024' },
};

const sections: Record<string, { title: Record<string, string>; content?: Record<string, string>; items?: Record<string, string[]> }[]> = {
    main: [
        {
            title: { de: '1. Verantwortliche Stelle', tr: '1. Veri Sorumlusu', en: '1. Data Controller', fr: '1. Responsable du traitement', it: '1. Titolare del trattamento', es: '1. Responsable del tratamiento' },
            content: {
                de: 'Als LOKMA GmbH nehmen wir den Schutz Ihrer personenbezogenen Daten sehr ernst. Diese Datenschutzerklärung wurde gemäß der EU-Datenschutz-Grundverordnung (DSGVO) und dem türkischen Gesetz zum Schutz personenbezogener Daten (KVKK) erstellt.',
                tr: 'LOKMA GmbH olarak, kişisel verilerinizin korunmasını önemsiyoruz. Bu aydınlatma metni, Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR/DSGVO) ve Türkiye Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında hazırlanmıştır.',
                en: 'As LOKMA GmbH, we take the protection of your personal data very seriously. This notice was prepared in accordance with the EU General Data Protection Regulation (GDPR) and the Turkish Personal Data Protection Law (KVKK).',
                fr: 'En tant que LOKMA GmbH, nous prenons la protection de vos données personnelles très au sérieux.',
                it: 'Come LOKMA GmbH, prendiamo molto seriamente la protezione dei vostri dati personali.',
                es: 'Como LOKMA GmbH, nos tomamos muy en serio la protección de sus datos personales.',
            },
        },
        {
            title: { de: '2. Verarbeitete Daten', tr: '2. İşlenen Kişisel Veriler', en: '2. Processed Personal Data', fr: '2. Données traitées', it: '2. Dati trattati', es: '2. Datos procesados' },
            items: {
                de: ['Identifikationsdaten (Name, Vorname)', 'Kontaktdaten (Telefon, E-Mail, Adresse)', 'Standortdaten', 'Bestell- und Transaktionsverlauf', 'Zahlungsinformationen (keine Kartennummern gespeichert)', 'Geräte- und Browserinformationen'],
                tr: ['Kimlik bilgileri (ad, soyad)', 'İletişim bilgileri (telefon, e-posta, adres)', 'Konum verileri', 'Sipariş ve işlem geçmişi', 'Ödeme bilgileri (kart numarası saklanmaz)', 'Cihaz ve tarayıcı bilgileri'],
                en: ['Identity data (name, surname)', 'Contact data (phone, email, address)', 'Location data', 'Order and transaction history', 'Payment data (card numbers are not stored)', 'Device and browser information'],
                fr: ['Données d\'identité', 'Coordonnées', 'Données de localisation', 'Historique des commandes', 'Données de paiement', 'Informations sur l\'appareil'],
                it: ['Dati identificativi', 'Dati di contatto', 'Dati di localizzazione', 'Cronologia ordini', 'Dati di pagamento', 'Informazioni sul dispositivo'],
                es: ['Datos de identidad', 'Datos de contacto', 'Datos de ubicación', 'Historial de pedidos', 'Datos de pago', 'Información del dispositivo'],
            },
        },
        {
            title: { de: '3. Zwecke der Datenverarbeitung', tr: '3. Veri İşleme Amaçları', en: '3. Data Processing Purposes', fr: '3. Finalités du traitement', it: '3. Finalità del trattamento', es: '3. Fines del tratamiento' },
            items: {
                de: ['Bestellabwicklung und Lieferung', 'Kundenservice', 'Erfüllung gesetzlicher Pflichten', 'Serviceverbesserung (mit Ihrer Zustimmung)', 'Marketingkommunikation (mit Ihrer Zustimmung)'],
                tr: ['Sipariş işleme ve teslimat', 'Müşteri hizmetleri', 'Yasal yükümlülüklerin yerine getirilmesi', 'Hizmet iyileştirme (izniniz dahilinde)', 'Pazarlama iletişimi (izniniz dahilinde)'],
                en: ['Order processing and delivery', 'Customer service', 'Fulfillment of legal obligations', 'Service improvement (with your consent)', 'Marketing communications (with your consent)'],
                fr: ['Traitement des commandes', 'Service client', 'Obligations légales', 'Amélioration du service', 'Communications marketing'],
                it: ['Elaborazione ordini', 'Servizio clienti', 'Obblighi legali', 'Miglioramento del servizio', 'Comunicazioni marketing'],
                es: ['Procesamiento de pedidos', 'Servicio al cliente', 'Obligaciones legales', 'Mejora del servicio', 'Comunicaciones de marketing'],
            },
        },
        {
            title: { de: '4. Ihre Rechte', tr: '4. Haklarınız', en: '4. Your Rights', fr: '4. Vos droits', it: '4. I vostri diritti', es: '4. Sus derechos' },
            items: {
                de: ['Auskunftsrecht', 'Recht auf Berichtigung', 'Recht auf Löschung (Recht auf Vergessenwerden)', 'Recht auf Einschränkung der Verarbeitung', 'Recht auf Datenübertragbarkeit', 'Widerspruchsrecht'],
                tr: ['Verilerinize erişim hakkı', 'Verilerin düzeltilmesini isteme hakkı', 'Verilerin silinmesini isteme hakkı (unutulma hakkı)', 'İşlemenin kısıtlanmasını isteme hakkı', 'Veri taşınabilirliği hakkı', 'İtiraz hakkı'],
                en: ['Right of access', 'Right to rectification', 'Right to erasure (right to be forgotten)', 'Right to restriction of processing', 'Right to data portability', 'Right to object'],
                fr: ['Droit d\'accès', 'Droit de rectification', 'Droit à l\'effacement', 'Droit à la limitation', 'Droit à la portabilité', 'Droit d\'opposition'],
                it: ['Diritto di accesso', 'Diritto di rettifica', 'Diritto alla cancellazione', 'Diritto alla limitazione', 'Diritto alla portabilità', 'Diritto di opposizione'],
                es: ['Derecho de acceso', 'Derecho de rectificación', 'Derecho de supresión', 'Derecho de limitación', 'Derecho de portabilidad', 'Derecho de oposición'],
            },
        },
        {
            title: { de: '5. Kontakt', tr: '5. İletişim', en: '5. Contact', fr: '5. Contact', it: '5. Contatto', es: '5. Contacto' },
            content: {
                de: 'Für Fragen zu Ihren personenbezogenen Daten:\nE-Mail: datenschutz@lokma.shop\nAdresse: LOKMA GmbH, Musterstraße 123, 10115 Berlin, Deutschland',
                tr: 'Kişisel verileriniz hakkında sorularınız için:\nE-posta: datenschutz@lokma.shop\nAdres: LOKMA GmbH, Musterstraße 123, 10115 Berlin, Deutschland',
                en: 'For questions about your personal data:\nEmail: datenschutz@lokma.shop\nAddress: LOKMA GmbH, Musterstraße 123, 10115 Berlin, Germany',
                fr: 'Pour toute question sur vos données personnelles :\nE-mail : datenschutz@lokma.shop\nAdresse : LOKMA GmbH, Musterstraße 123, 10115 Berlin, Allemagne',
                it: 'Per domande sui vostri dati personali:\nEmail: datenschutz@lokma.shop\nIndirizzo: LOKMA GmbH, Musterstraße 123, 10115 Berlin, Germania',
                es: 'Para preguntas sobre sus datos personales:\nEmail: datenschutz@lokma.shop\nDirección: LOKMA GmbH, Musterstraße 123, 10115 Berlin, Alemania',
            },
        },
    ],
};

export default function KVKKPage() {
    const locale = useLocale();
    const titleTx = texts[locale] || texts['en'];

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40 flex-1">
                <div className="max-w-[800px] mx-auto prose prose-gray dark:prose-invert">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">{titleTx.title}</h1>
                    <p className="text-gray-500 dark:text-white/60 mb-8">{titleTx.updated}</p>

                    <div className="space-y-8 text-gray-600 dark:text-white/80">
                        {sections.main.map((section, i) => (
                            <section key={i}>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{section.title[locale] || section.title.en}</h2>
                                {section.content && (
                                    <p className="whitespace-pre-line">{section.content[locale] || section.content.en}</p>
                                )}
                                {section.items && (
                                    <ul className="list-disc pl-6 space-y-2">
                                        {(section.items[locale] || section.items.en).map((item, j) => (
                                            <li key={j}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>
                </div>
            </main>

            <PublicFooter themeAware={true} />
        </div>
    );
}
