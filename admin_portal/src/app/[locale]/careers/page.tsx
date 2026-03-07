'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Karriere', subtitle: 'Treten Sie der LOKMA-Familie bei! Lassen Sie uns gemeinsam den lokalen Handel digitalisieren.',
        b1: 'Flexibles Arbeiten', b1d: 'Remote & Hybrid Optionen',
        b2: 'Wachstum', b2d: 'Karriereentwicklungsmöglichkeiten',
        b3: 'Vielfalt', b3d: 'Inklusive Arbeitsumgebung',
        b4: 'Benefits', b4d: 'Wettbewerbsfähiges Gehalt & Boni',
        openPositions: 'Offene Stellen',
        notFound: 'Passende Stelle nicht gefunden?', notFoundDesc: 'Senden Sie eine Initiativbewerbung — wir melden uns, sobald eine passende Stelle frei wird.',
        sendCV: 'CV Senden', application: 'Bewerbung',
    },
    tr: {
        title: 'Kariyer', subtitle: 'LOKMA ailesine katılın! Yerel ticareti dijitalleştirmek için birlikte çalışalım.',
        b1: 'Esnek Çalışma', b1d: 'Remote & hybrid seçenekler',
        b2: 'Büyüme', b2d: 'Kariyer gelişimi fırsatları',
        b3: 'Çeşitlilik', b3d: 'Kapsayıcı iş ortamı',
        b4: 'Yan Haklar', b4d: 'Rekabetçi maaş & primler',
        openPositions: 'Açık Pozisyonlar',
        notFound: 'Aradığınız pozisyonu bulamadınız mı?', notFoundDesc: 'Açık başvuru yapın, uygun pozisyon açıldığında sizinle iletişime geçelim.',
        sendCV: 'CV Gönder', application: 'Başvurusu',
    },
    en: {
        title: 'Careers', subtitle: 'Join the LOKMA family! Let\'s digitalize local commerce together.',
        b1: 'Flexible Work', b1d: 'Remote & hybrid options',
        b2: 'Growth', b2d: 'Career development opportunities',
        b3: 'Diversity', b3d: 'Inclusive work environment',
        b4: 'Benefits', b4d: 'Competitive salary & bonuses',
        openPositions: 'Open Positions',
        notFound: 'Didn\'t find the right position?', notFoundDesc: 'Send an open application — we\'ll contact you when a suitable position opens up.',
        sendCV: 'Send CV', application: 'Application',
    },
    fr: {
        title: 'Carrières', subtitle: 'Rejoignez la famille LOKMA ! Digitalisons ensemble le commerce local.',
        b1: 'Travail flexible', b1d: 'Options remote & hybride',
        b2: 'Croissance', b2d: 'Opportunités de développement',
        b3: 'Diversité', b3d: 'Environnement de travail inclusif',
        b4: 'Avantages', b4d: 'Salaire compétitif & primes',
        openPositions: 'Postes ouverts',
        notFound: 'Poste non trouvé ?', notFoundDesc: 'Envoyez une candidature spontanée — nous vous contacterons dès qu\'un poste adapté sera disponible.',
        sendCV: 'Envoyer CV', application: 'Candidature',
    },
    it: {
        title: 'Carriere', subtitle: 'Unisciti alla famiglia LOKMA! Digitalizziamo insieme il commercio locale.',
        b1: 'Lavoro flessibile', b1d: 'Opzioni remote & ibride',
        b2: 'Crescita', b2d: 'Opportunità di sviluppo',
        b3: 'Diversità', b3d: 'Ambiente di lavoro inclusivo',
        b4: 'Benefit', b4d: 'Stipendio competitivo & bonus',
        openPositions: 'Posizioni aperte',
        notFound: 'Non hai trovato la posizione giusta?', notFoundDesc: 'Invia una candidatura spontanea — ti contatteremo quando si aprirà una posizione adatta.',
        sendCV: 'Invia CV', application: 'Candidatura',
    },
    es: {
        title: 'Carreras', subtitle: '¡Únete a la familia LOKMA! Digitalicemos juntos el comercio local.',
        b1: 'Trabajo flexible', b1d: 'Opciones remoto & híbrido',
        b2: 'Crecimiento', b2d: 'Oportunidades de desarrollo',
        b3: 'Diversidad', b3d: 'Ambiente de trabajo inclusivo',
        b4: 'Beneficios', b4d: 'Salario competitivo & bonos',
        openPositions: 'Posiciones abiertas',
        notFound: '¿No encontraste el puesto adecuado?', notFoundDesc: 'Envía una solicitud abierta — te contactaremos cuando haya una posición adecuada.',
        sendCV: 'Enviar CV', application: 'Solicitud',
    },
};

const openPositions = [
    { title: 'Senior Full-Stack Developer', department: 'Engineering', location: 'Berlin, DE (Hybrid)', type: 'Full-time' },
    { title: 'Mobile App Developer (Flutter)', department: 'Engineering', location: 'Remote', type: 'Full-time' },
    { title: 'Product Designer', department: 'Design', location: 'Berlin, DE', type: 'Full-time' },
    { title: 'Business Development Manager', department: 'Sales', location: 'Köln, DE', type: 'Full-time' },
    { title: 'Customer Success Manager (Turkish Speaker)', department: 'Operations', location: 'Berlin, DE', type: 'Full-time' },
    { title: 'Marketing Specialist', department: 'Marketing', location: 'Remote', type: 'Part-time' },
];

const benefitIcons = ['work_history', 'trending_up', 'diversity_3', 'favorite'];

export default function CareersPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-[#0a0a0f] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[1000px] mx-auto">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-black mb-6">{t('title')}</h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">{t('subtitle')}</p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-6 mb-16">
                        {(['b1', 'b2', 'b3', 'b4'] as const).map((b, i) => (
                            <div key={b} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                                <span className="material-symbols-outlined text-[#fb335b] text-3xl mb-3 block">{benefitIcons[i]}</span>
                                <h4 className="font-bold">{t(b)}</h4>
                                <p className="text-sm text-white/60">{t(`${b}d`)}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-2xl font-bold mb-8">{t('openPositions')}</h2>
                    <div className="space-y-4">
                        {openPositions.map((job, index) => (
                            <a
                                key={index}
                                href={`mailto:kariyer@lokma.shop?subject=${encodeURIComponent(job.title + ' ' + t('application'))}`}
                                className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all group"
                            >
                                <div className="mb-4 md:mb-0">
                                    <h3 className="font-bold text-lg group-hover:text-[#fb335b] transition-colors">{job.title}</h3>
                                    <p className="text-sm text-white/60">{job.department}</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-xs">{job.location}</span>
                                    <span className="bg-[#fb335b]/20 text-[#fb335b] px-3 py-1 rounded-full text-xs">{job.type}</span>
                                </div>
                            </a>
                        ))}
                    </div>

                    <div className="mt-12 bg-gradient-to-br from-[#fb335b]/10 to-transparent border border-[#fb335b]/20 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold mb-4">{t('notFound')}</h3>
                        <p className="text-white/60 mb-6">{t('notFoundDesc')}</p>
                        <a
                            href={`mailto:kariyer@lokma.shop?subject=${encodeURIComponent(t('sendCV'))}`}
                            className="inline-block bg-[#fb335b] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all"
                        >
                            {t('sendCV')}
                        </a>
                    </div>
                </div>
            </main>

            <PublicFooter />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </div>
    );
}
