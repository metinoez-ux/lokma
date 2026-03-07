'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Admin, MODULE_PRICING } from '@/types';
import Link from 'next/link';

const texts: Record<string, Record<string, string>> = {
    de: {
        heroTitle: 'Digitalisieren Sie Ihr Unternehmen 🚀',
        heroSub: 'Verwalten Sie Bestellungen, Reservierungen und Kunden ganz einfach mit MIRA-Modulen.',
        yearlyDeal: 'Bei jährlicher Zahlung 2 Monate gratis!',
        free: 'Kostenlos', freeTag: '🎁 GEMEINNÜTZIG - KOSTENLOS',
        perMonth: '€/Monat', orYearly: 'oder', perYear: '€/Jahr',
        startNow: 'Jetzt starten', monthlyBtn: 'Monatlich abonnieren', yearlyBtn: 'Jährlich abonnieren (2 Monate gratis)',
        faqTitle: 'Häufig gestellte Fragen',
        faq1Q: 'Warum Bezahlung über das Web?', faq1A: 'Wir können Ihnen günstigere Preise anbieten, indem wir Apples 30% Provision umgehen.',
        faq2Q: 'Kann ich kündigen?', faq2A: 'Ja, Sie können Ihr Abonnement jederzeit kündigen. Die verbleibende Zeit bleibt nutzbar.',
    },
    tr: {
        heroTitle: 'İşletmenizi Dijitalleştirin 🚀',
        heroSub: 'MIRA modülleriyle siparişleri, rezervasyonları ve müşterilerinizi kolayca yönetin.',
        yearlyDeal: 'Yıllık ödemede 2 ay bedava!',
        free: 'Bedava', freeTag: '🎁 HAYIR İŞİ - ÜCRETSİZ',
        perMonth: '€/ay', orYearly: 'veya', perYear: '€/yıl',
        startNow: 'Hemen Başla', monthlyBtn: 'Aylık Abone Ol', yearlyBtn: 'Yıllık Abone Ol (2 ay bedava)',
        faqTitle: 'Sıkça Sorulan Sorular',
        faq1Q: 'Neden web üzerinden ödeme?', faq1A: 'Apple\'ın %30 komisyonundan kaçınarak size daha uygun fiyatlar sunabiliyoruz.',
        faq2Q: 'İptal edebilir miyim?', faq2A: 'Evet, istediğiniz zaman aboneliğinizi iptal edebilirsiniz. Kalan süre kullanılabilir.',
    },
    en: {
        heroTitle: 'Digitalize Your Business 🚀',
        heroSub: 'Easily manage orders, reservations and customers with MIRA modules.',
        yearlyDeal: '2 months free with annual payment!',
        free: 'Free', freeTag: '🎁 CHARITY - FREE',
        perMonth: '€/month', orYearly: 'or', perYear: '€/year',
        startNow: 'Start Now', monthlyBtn: 'Subscribe Monthly', yearlyBtn: 'Subscribe Yearly (2 months free)',
        faqTitle: 'Frequently Asked Questions',
        faq1Q: 'Why pay via web?', faq1A: 'We can offer you better prices by avoiding Apple\'s 30% commission.',
        faq2Q: 'Can I cancel?', faq2A: 'Yes, you can cancel your subscription at any time. The remaining time stays usable.',
    },
    fr: {
        heroTitle: 'Digitalisez votre entreprise 🚀',
        heroSub: 'Gérez facilement commandes, réservations et clients avec les modules MIRA.',
        yearlyDeal: '2 mois gratuits avec le paiement annuel !',
        free: 'Gratuit', freeTag: '🎁 CARITATIF - GRATUIT',
        perMonth: '€/mois', orYearly: 'ou', perYear: '€/an',
        startNow: 'Commencer', monthlyBtn: 'Abonnement mensuel', yearlyBtn: 'Abonnement annuel (2 mois gratuits)',
        faqTitle: 'Questions fréquentes',
        faq1Q: 'Pourquoi payer via le web ?', faq1A: 'Nous pouvons offrir de meilleurs prix en évitant la commission de 30 % d\'Apple.',
        faq2Q: 'Puis-je annuler ?', faq2A: 'Oui, vous pouvez annuler votre abonnement à tout moment. Le temps restant reste utilisable.',
    },
    it: {
        heroTitle: 'Digitalizza la tua attività 🚀',
        heroSub: 'Gestisci facilmente ordini, prenotazioni e clienti con i moduli MIRA.',
        yearlyDeal: '2 mesi gratis con il pagamento annuale!',
        free: 'Gratuito', freeTag: '🎁 BENEFICENZA - GRATIS',
        perMonth: '€/mese', orYearly: 'o', perYear: '€/anno',
        startNow: 'Inizia ora', monthlyBtn: 'Abbonamento mensile', yearlyBtn: 'Abbonamento annuale (2 mesi gratis)',
        faqTitle: 'Domande frequenti',
        faq1Q: 'Perché pagare via web?', faq1A: 'Possiamo offrire prezzi migliori evitando la commissione del 30% di Apple.',
        faq2Q: 'Posso cancellare?', faq2A: 'Sì, puoi cancellare il tuo abbonamento in qualsiasi momento. Il tempo rimanente resta utilizzabile.',
    },
    es: {
        heroTitle: 'Digitaliza tu negocio 🚀',
        heroSub: 'Gestiona fácilmente pedidos, reservas y clientes con los módulos MIRA.',
        yearlyDeal: '¡2 meses gratis con pago anual!',
        free: 'Gratis', freeTag: '🎁 BENÉFICO - GRATIS',
        perMonth: '€/mes', orYearly: 'o', perYear: '€/año',
        startNow: 'Empezar ahora', monthlyBtn: 'Suscripción mensual', yearlyBtn: 'Suscripción anual (2 meses gratis)',
        faqTitle: 'Preguntas frecuentes',
        faq1Q: '¿Por qué pagar por la web?', faq1A: 'Podemos ofrecer mejores precios evitando la comisión del 30% de Apple.',
        faq2Q: '¿Puedo cancelar?', faq2A: 'Sí, puedes cancelar tu suscripción en cualquier momento. El tiempo restante sigue siendo utilizable.',
    },
};

export default function SubscriptionPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/login'); return; }
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (!adminDoc.exists()) { router.push('/login'); return; }
            setAdmin({ id: adminDoc.id, ...adminDoc.data() } as Admin);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    const handleSubscribe = async (moduleType: string, isYearly: boolean) => {
        setSubscribing(true);
        try {
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleType, isYearly, userId: admin?.id, email: admin?.email }),
            });
            const { url } = await res.json();
            window.location.href = url;
        } catch (error) {
            console.error('Error creating checkout:', error);
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900">
            <header className="bg-transparent text-white">
                <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <span className="text-blue-900 font-bold">M</span>
                        </div>
                        <span className="font-bold text-xl">MIRA Portal</span>
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12">
                <div className="text-center text-white mb-12">
                    <h1 className="text-4xl font-bold mb-4">{t('heroTitle')}</h1>
                    <p className="text-xl text-blue-200">{t('heroSub')}</p>
                    <p className="text-sm text-blue-300 mt-2">{t('yearlyDeal')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(MODULE_PRICING).map(([key, module]) => (
                        <div key={key} className={`bg-white rounded-2xl shadow-xl overflow-hidden ${module.monthly === 0 ? 'ring-4 ring-green-400' : ''}`}>
                            {module.monthly === 0 && (
                                <div className="bg-green-500 text-white text-center py-2 font-semibold">{t('freeTag')}</div>
                            )}
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{module.name}</h3>
                                {module.monthly === 0 ? (
                                    <div className="mb-6"><span className="text-4xl font-bold text-green-600">{t('free')}</span></div>
                                ) : (
                                    <div className="mb-6">
                                        <div className="flex items-baseline">
                                            <span className="text-4xl font-bold text-gray-900">{module.monthly}</span>
                                            <span className="text-gray-500 ml-1">{t('perMonth')}</span>
                                        </div>
                                        <div className="text-sm text-gray-400 mt-1">{t('orYearly')} {module.yearly}{t('perYear')}</div>
                                    </div>
                                )}
                                <ul className="space-y-3 mb-6">
                                    {module.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center text-gray-600">
                                            <span className="text-green-500 mr-2">✓</span>{feature}
                                        </li>
                                    ))}
                                </ul>
                                {module.monthly === 0 ? (
                                    <button onClick={() => router.push('/dashboard')} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
                                        {t('startNow')}
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <button onClick={() => handleSubscribe(key, false)} disabled={subscribing} className="w-full bg-blue-900 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition disabled:opacity-50">
                                            {t('monthlyBtn')}
                                        </button>
                                        <button onClick={() => handleSubscribe(key, true)} disabled={subscribing} className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50">
                                            {t('yearlyBtn')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-white">
                    <h2 className="text-2xl font-bold text-center mb-8">{t('faqTitle')}</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white/10 rounded-xl p-6">
                            <h3 className="font-bold mb-2">{t('faq1Q')}</h3>
                            <p className="text-blue-200 text-sm">{t('faq1A')}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-6">
                            <h3 className="font-bold mb-2">{t('faq2Q')}</h3>
                            <p className="text-blue-200 text-sm">{t('faq2A')}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
