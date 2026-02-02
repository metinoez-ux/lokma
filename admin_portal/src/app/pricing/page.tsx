'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Admin, MODULE_PRICING } from '@/types';
import Link from 'next/link';

export default function SubscriptionPage() {
    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (!adminDoc.exists()) {
                router.push('/login');
                return;
            }

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
                body: JSON.stringify({
                    moduleType,
                    isYearly,
                    userId: admin?.id,
                    email: admin?.email,
                }),
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
            {/* Header */}
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
                {/* Hero */}
                <div className="text-center text-white mb-12">
                    <h1 className="text-4xl font-bold mb-4">İşletmenizi Dijitalleştirin 🚀</h1>
                    <p className="text-xl text-blue-200">
                        MIRA modülleriyle siparişleri, rezervasyonları ve müşterilerinizi kolayca yönetin.
                    </p>
                    <p className="text-sm text-blue-300 mt-2">
                        Yıllık ödemede 2 ay bedava!
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(MODULE_PRICING).map(([key, module]) => (
                        <div
                            key={key}
                            className={`bg-white rounded-2xl shadow-xl overflow-hidden ${module.monthly === 0 ? 'ring-4 ring-green-400' : ''
                                }`}
                        >
                            {module.monthly === 0 && (
                                <div className="bg-green-500 text-white text-center py-2 font-semibold">
                                    🎁 HAYIR İŞİ - ÜCRETSİZ
                                </div>
                            )}

                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{module.name}</h3>

                                {module.monthly === 0 ? (
                                    <div className="mb-6">
                                        <span className="text-4xl font-bold text-green-600">Bedava</span>
                                    </div>
                                ) : (
                                    <div className="mb-6">
                                        <div className="flex items-baseline">
                                            <span className="text-4xl font-bold text-gray-900">{module.monthly}</span>
                                            <span className="text-gray-500 ml-1">€/ay</span>
                                        </div>
                                        <div className="text-sm text-gray-400 mt-1">
                                            veya {module.yearly}€/yıl
                                        </div>
                                    </div>
                                )}

                                <ul className="space-y-3 mb-6">
                                    {module.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center text-gray-600">
                                            <span className="text-green-500 mr-2">✓</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {module.monthly === 0 ? (
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
                                    >
                                        Hemen Başla
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => handleSubscribe(key, false)}
                                            disabled={subscribing}
                                            className="w-full bg-blue-900 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition disabled:opacity-50"
                                        >
                                            Aylık Abone Ol
                                        </button>
                                        <button
                                            onClick={() => handleSubscribe(key, true)}
                                            disabled={subscribing}
                                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                                        >
                                            Yıllık Abone Ol (2 ay bedava)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="mt-16 text-white">
                    <h2 className="text-2xl font-bold text-center mb-8">Sıkça Sorulan Sorular</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white/10 rounded-xl p-6">
                            <h3 className="font-bold mb-2">Neden web üzerinden ödeme?</h3>
                            <p className="text-blue-200 text-sm">
                                Apple&apos;ın %30 komisyonundan kaçınarak size daha uygun fiyatlar sunabiliyoruz.
                            </p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-6">
                            <h3 className="font-bold mb-2">İptal edebilir miyim?</h3>
                            <p className="text-blue-200 text-sm">
                                Evet, istediğiniz zaman aboneliğinizi iptal edebilirsiniz. Kalan süre kullanılabilir.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
