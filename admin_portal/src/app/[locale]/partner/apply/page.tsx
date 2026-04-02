'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Partnerantrag', subtitle: 'Füllen Sie das Formular aus, unser Team wird sich bei Ihnen melden.',
        businessName: 'Firmenname *', businessNamePh: 'z.B. Özkan Metzgerei',
        businessType: 'Geschäftsart *', selectType: 'Bitte wählen',
        ownerName: 'Name des Inhabers *', ownerNamePh: 'Ihr Vor- und Nachname',
        email: 'E-Mail *', phone: 'Telefon *',
        city: 'Stadt *', cityPh: 'z.B. Berlin, Köln, München',
        address: 'Adresse', addressPh: 'Vollständige Adresse (optional)',
        about: 'Über Ihr Geschäft', aboutPh: 'Kurze Beschreibung (optional)',
        submit: 'Antrag absenden',
        terms: 'Mit der Bewerbung akzeptieren Sie die', termsLink: 'Nutzungsbedingungen',
        successTitle: 'Antrag eingegangen!', successDesc: 'Unser Team wird sich innerhalb von 24 Stunden bei Ihnen melden. Vielen Dank!', backHome: 'Zur Startseite',
        t1: 'Metzgerei', t2: 'Supermarkt', t3: 'Restaurant', t4: 'Fast Food', t5: 'Blumenladen', t6: 'Catering', t7: 'Bäckerei/Konditorei', t8: 'Sonstiges',
    },
    tr: {
        title: 'Partner Başvurusu', subtitle: 'Formu doldurun, ekibimiz sizinle iletişime geçsin.',
        businessName: 'İşletme Adı *', businessNamePh: 'Örn: Özkan Kasap',
        businessType: 'İşletme Türü *', selectType: 'Seçiniz',
        ownerName: 'Yetkili Adı Soyadı *', ownerNamePh: 'Adınız Soyadınız',
        email: 'E-posta *', phone: 'Telefon *',
        city: 'Şehir *', cityPh: 'Örn: Berlin, Köln, München',
        address: 'Adres', addressPh: 'Tam adres (opsiyonel)',
        about: 'İşletmeniz Hakkında', aboutPh: 'Kısa bir açıklama (opsiyonel)',
        submit: 'Başvuruyu Gönder',
        terms: 'Başvurarak', termsLink: 'Kullanım Koşulları\'nı kabul etmiş olursunuz.',
        successTitle: 'Başvurunuz Alındı!', successDesc: 'Ekibimiz 24 saat içinde sizinle iletişime geçecektir. Teşekkür ederiz!', backHome: 'Ana Sayfaya Dön',
        t1: 'Kasap', t2: 'Market', t3: 'Restoran', t4: 'Fast Food', t5: 'Çiçekçi', t6: 'Catering', t7: 'Fırın/Pastane', t8: 'Diğer',
    },
    en: {
        title: 'Partner Application', subtitle: 'Fill out the form and our team will contact you.',
        businessName: 'Business Name *', businessNamePh: 'e.g. Özkan Butcher',
        businessType: 'Business Type *', selectType: 'Select',
        ownerName: 'Owner Name *', ownerNamePh: 'Your full name',
        email: 'Email *', phone: 'Phone *',
        city: 'City *', cityPh: 'e.g. Berlin, Cologne, Munich',
        address: 'Address', addressPh: 'Full address (optional)',
        about: 'About Your Business', aboutPh: 'Short description (optional)',
        submit: 'Submit Application',
        terms: 'By applying you accept the', termsLink: 'Terms of Use',
        successTitle: 'Application Received!', successDesc: 'Our team will contact you within 24 hours. Thank you!', backHome: 'Back to Home',
        t1: 'Butcher', t2: 'Supermarket', t3: 'Restaurant', t4: 'Fast Food', t5: 'Florist', t6: 'Catering', t7: 'Bakery/Pastry', t8: 'Other',
    },
    fr: {
        title: 'Demande de partenariat', subtitle: 'Remplissez le formulaire, notre équipe vous contactera.',
        businessName: 'Nom de l\'entreprise *', businessNamePh: 'ex: Boucherie Özkan',
        businessType: 'Type d\'entreprise *', selectType: 'Sélectionner',
        ownerName: 'Nom du gérant *', ownerNamePh: 'Votre nom complet',
        email: 'E-mail *', phone: 'Téléphone *',
        city: 'Ville *', cityPh: 'ex: Berlin, Cologne, Munich',
        address: 'Adresse', addressPh: 'Adresse complète (optionnel)',
        about: 'À propos de votre entreprise', aboutPh: 'Brève description (optionnel)',
        submit: 'Envoyer la demande',
        terms: 'En postulant vous acceptez les', termsLink: 'Conditions d\'utilisation',
        successTitle: 'Demande reçue !', successDesc: 'Notre équipe vous contactera sous 24 heures. Merci !', backHome: 'Retour à l\'accueil',
        t1: 'Boucherie', t2: 'Supermarché', t3: 'Restaurant', t4: 'Fast Food', t5: 'Fleuriste', t6: 'Traiteur', t7: 'Boulangerie/Pâtisserie', t8: 'Autre',
    },
    it: {
        title: 'Richiesta di partnership', subtitle: 'Compila il modulo, il nostro team ti contatterà.',
        businessName: 'Nome attività *', businessNamePh: 'es: Macelleria Özkan',
        businessType: 'Tipo di attività *', selectType: 'Seleziona',
        ownerName: 'Nome del titolare *', ownerNamePh: 'Il tuo nome completo',
        email: 'E-mail *', phone: 'Telefono *',
        city: 'Città *', cityPh: 'es: Berlino, Colonia, Monaco',
        address: 'Indirizzo', addressPh: 'Indirizzo completo (opzionale)',
        about: 'Informazioni sulla tua attività', aboutPh: 'Breve descrizione (opzionale)',
        submit: 'Invia richiesta',
        terms: 'Candidandoti accetti i', termsLink: 'Termini di utilizzo',
        successTitle: 'Richiesta ricevuta!', successDesc: 'Il nostro team ti contatterà entro 24 ore. Grazie!', backHome: 'Torna alla home',
        t1: 'Macelleria', t2: 'Supermercato', t3: 'Ristorante', t4: 'Fast Food', t5: 'Fioraio', t6: 'Catering', t7: 'Panificio/Pasticceria', t8: 'Altro',
    },
    es: {
        title: 'Solicitud de colaboración', subtitle: 'Complete el formulario y nuestro equipo se pondrá en contacto.',
        businessName: 'Nombre del negocio *', businessNamePh: 'ej: Carnicería Özkan',
        businessType: 'Tipo de negocio *', selectType: 'Seleccionar',
        ownerName: 'Nombre del propietario *', ownerNamePh: 'Su nombre completo',
        email: 'Correo electrónico *', phone: 'Teléfono *',
        city: 'Ciudad *', cityPh: 'ej: Berlín, Colonia, Múnich',
        address: 'Dirección', addressPh: 'Dirección completa (opcional)',
        about: 'Sobre su negocio', aboutPh: 'Breve descripción (opcional)',
        submit: 'Enviar solicitud',
        terms: 'Al solicitar acepta los', termsLink: 'Términos de uso',
        successTitle: '¡Solicitud recibida!', successDesc: 'Nuestro equipo se pondrá en contacto en 24 horas. ¡Gracias!', backHome: 'Volver al inicio',
        t1: 'Carnicería', t2: 'Supermercado', t3: 'Restaurante', t4: 'Comida rápida', t5: 'Floristería', t6: 'Catering', t7: 'Panadería/Pastelería', t8: 'Otro',
    },
    nl: {
        title: 'Partneraanvraag', subtitle: 'Vul het formulier in, ons team neemt contact met u op.',
        businessName: 'Bedrijfsnaam *', businessNamePh: 'bijv. Slagerij Ozkan',
        businessType: 'Bedrijfstype *', selectType: 'Selecteren',
        ownerName: 'Naam eigenaar *', ownerNamePh: 'Uw volledige naam',
        email: 'E-mail *', phone: 'Telefoon *',
        city: 'Stad *', cityPh: 'bijv. Berlijn, Keulen, Munchen',
        address: 'Adres', addressPh: 'Volledig adres (optioneel)',
        about: 'Over uw bedrijf', aboutPh: 'Korte beschrijving (optioneel)',
        submit: 'Aanvraag versturen',
        terms: 'Door uw aanvraag accepteert u de', termsLink: 'Gebruiksvoorwaarden',
        successTitle: 'Aanvraag ontvangen!', successDesc: 'Ons team neemt binnen 24 uur contact met u op. Bedankt!', backHome: 'Terug naar startpagina',
        t1: 'Slagerij', t2: 'Supermarkt', t3: 'Restaurant', t4: 'Fastfood', t5: 'Bloemist', t6: 'Catering', t7: 'Bakkerij/Patisserie', t8: 'Overig',
    },
};

export default function PartnerApplyPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    const [formData, setFormData] = useState({
        businessName: '', ownerName: '', email: '', phone: '', businessType: '', city: '', address: '', description: '',
    });
    const [submitted, setSubmitted] = useState(false);
    const businessTypes = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'].map(k => t(k));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Partner application:', formData);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-4">{t('successTitle')}</h1>
                    <p className="text-gray-500 dark:text-white/60 mb-8">{t('successDesc')}</p>
                    <Link href="/" className="inline-block bg-[#ea184a] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all">
                        {t('backHome')}
                    </Link>
                </div>
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[600px] mx-auto">
                    <h1 className="text-3xl md:text-4xl font-black mb-4">{t('title')}</h1>
                    <p className="text-gray-500 dark:text-white/60 mb-8">{t('subtitle')}</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('businessName')}</label>
                            <input type="text" required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                placeholder={t('businessNamePh')} value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('businessType')}</label>
                            <select required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}>
                                <option value="">{t('selectType')}</option>
                                {businessTypes.map((type) => (<option key={type} value={type}>{type}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('ownerName')}</label>
                            <input type="text" required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                placeholder={t('ownerNamePh')} value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">{t('email')}</label>
                                <input type="email" required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                    placeholder="ornek@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">{t('phone')}</label>
                                <input type="tel" required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                    placeholder="+49 176 123 456 78" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('city')}</label>
                            <input type="text" required className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                placeholder={t('cityPh')} value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('address')}</label>
                            <input type="text" className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all"
                                placeholder={t('addressPh')} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('about')}</label>
                            <textarea rows={3} className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:border-[#ea184a] focus:outline-none transition-all resize-none"
                                placeholder={t('aboutPh')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <button type="submit" className="w-full bg-[#ea184a] hover:bg-red-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-[#ea184a]/20">
                            {t('submit')}
                        </button>
                        <p className="text-center text-gray-400 dark:text-white/40 text-sm">
                            {t('terms')} <Link href="/agb" className="underline">{t('termsLink')}</Link>
                        </p>
                    </form>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}
