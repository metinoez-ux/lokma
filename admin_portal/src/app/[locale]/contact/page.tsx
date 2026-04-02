'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Kontakt',
        hq: 'Hauptsitz', workHours: 'Öffnungszeiten',
        monFri: 'Montag - Freitag: 09:00 - 18:00', sat: 'Samstag: 10:00 - 14:00', sun: 'Sonntag: Geschlossen',
        general: 'Allgemein', support: 'Kundensupport', partnership: 'Partnerschaft',
        merchantQ: 'Sind Sie Händler?', merchantDesc: 'Bewerben Sie sich jetzt, um der LOKMA-Plattform beizutreten.', merchantCta: 'Partnerantrag',
    },
    tr: {
        title: 'İletişim',
        hq: 'Merkez Ofis', workHours: 'Çalışma Saatleri',
        monFri: 'Pazartesi - Cuma: 09:00 - 18:00', sat: 'Cumartesi: 10:00 - 14:00', sun: 'Pazar: Kapalı',
        general: 'Genel Bilgi', support: 'Müşteri Desteği', partnership: 'İş Ortaklığı',
        merchantQ: 'Esnaf mısınız?', merchantDesc: 'LOKMA platformuna katılmak için hemen başvurun.', merchantCta: 'Partner Başvurusu',
    },
    en: {
        title: 'Contact',
        hq: 'Headquarters', workHours: 'Business Hours',
        monFri: 'Monday - Friday: 09:00 - 18:00', sat: 'Saturday: 10:00 - 14:00', sun: 'Sunday: Closed',
        general: 'General Info', support: 'Customer Support', partnership: 'Partnership',
        merchantQ: 'Are you a merchant?', merchantDesc: 'Apply now to join the LOKMA platform.', merchantCta: 'Partner Application',
    },
    fr: {
        title: 'Contact',
        hq: 'Siège social', workHours: 'Heures d\'ouverture',
        monFri: 'Lundi - Vendredi : 09h00 - 18h00', sat: 'Samedi : 10h00 - 14h00', sun: 'Dimanche : Fermé',
        general: 'Informations générales', support: 'Support client', partnership: 'Partenariat',
        merchantQ: 'Vous êtes commerçant ?', merchantDesc: 'Postulez maintenant pour rejoindre la plateforme LOKMA.', merchantCta: 'Demande de partenariat',
    },
    it: {
        title: 'Contatti',
        hq: 'Sede centrale', workHours: 'Orari di apertura',
        monFri: 'Lunedì - Venerdì: 09:00 - 18:00', sat: 'Sabato: 10:00 - 14:00', sun: 'Domenica: Chiuso',
        general: 'Informazioni generali', support: 'Assistenza clienti', partnership: 'Partnership',
        merchantQ: 'Sei un commerciante?', merchantDesc: 'Candidati ora per entrare nella piattaforma LOKMA.', merchantCta: 'Richiesta di partnership',
    },
    es: {
        title: 'Contacto',
        hq: 'Sede central', workHours: 'Horario de atención',
        monFri: 'Lunes - Viernes: 09:00 - 18:00', sat: 'Sábado: 10:00 - 14:00', sun: 'Domingo: Cerrado',
        general: 'Información general', support: 'Atención al cliente', partnership: 'Colaboración',
        merchantQ: '¿Eres comerciante?', merchantDesc: 'Solicita ahora unirte a la plataforma LOKMA.', merchantCta: 'Solicitud de colaboración',
    },
    nl: {
        title: 'Contact',
        hq: 'Hoofdkantoor', workHours: 'Openingstijden',
        monFri: 'Maandag - Vrijdag: 09:00 - 18:00', sat: 'Zaterdag: 10:00 - 14:00', sun: 'Zondag: Gesloten',
        general: 'Algemene informatie', support: 'Klantenservice', partnership: 'Partnerschap',
        merchantQ: 'Bent u een handelaar?', merchantDesc: 'Solliciteer nu om lid te worden van het LOKMA-platform.', merchantCta: 'Partneraanvraag',
    },
};

export default function ContactPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">{t('title')}</h1>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8">
                            <span className="material-symbols-outlined text-[#ea184a] text-3xl mb-4 block">location_on</span>
                            <h3 className="font-bold text-lg mb-2">{t('hq')}</h3>
                            <p className="text-gray-500 dark:text-white/60">
                                LOKMA GmbH<br />
                                Musterstraße 123<br />
                                10115 Berlin<br />
                                Deutschland
                            </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8">
                            <span className="material-symbols-outlined text-[#ea184a] text-3xl mb-4 block">schedule</span>
                            <h3 className="font-bold text-lg mb-2">{t('workHours')}</h3>
                            <p className="text-gray-500 dark:text-white/60">
                                {t('monFri')}<br />
                                {t('sat')}<br />
                                {t('sun')}
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <a href="mailto:info@lokma.shop" className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-3xl mb-3 block">mail</span>
                            <h4 className="font-bold mb-1">{t('general')}</h4>
                            <p className="text-sm text-gray-500 dark:text-white/60">info@lokma.shop</p>
                        </a>
                        <a href="mailto:destek@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-3xl mb-3 block">support_agent</span>
                            <h4 className="font-bold mb-1">{t('support')}</h4>
                            <p className="text-sm text-white/60">destek@lokma.shop</p>
                        </a>
                        <a href="mailto:partner@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-3xl mb-3 block">handshake</span>
                            <h4 className="font-bold mb-1">{t('partnership')}</h4>
                            <p className="text-sm text-white/60">partner@lokma.shop</p>
                        </a>
                    </div>

                    <div className="bg-gradient-to-br from-[#ea184a]/10 to-transparent border border-[#ea184a]/20 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold mb-4">{t('merchantQ')}</h3>
                        <p className="text-gray-500 dark:text-white/60 mb-6">{t('merchantDesc')}</p>
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-[#ea184a] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all"
                        >
                            {t('merchantCta')}
                        </Link>
                    </div>
                </div>
            </main>

            <PublicFooter themeAware={true} />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </div>
    );
}
