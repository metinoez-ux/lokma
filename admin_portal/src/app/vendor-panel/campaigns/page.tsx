'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface Campaign {
    id: string;
    title: string;
    message: string;
    imageUrl?: string;
    sentCount: number;
    status: 'draft' | 'sent' | 'failed';
    createdAt?: { toDate: () => Date };
}

interface SubscriptionInfo {
    plan: string;
    pushQuotaUsed: number;
    pushQuotaTotal: number;
}

const planQuotas: Record<string, number> = {
    ultra: 999,
    premium: 10,
    standard: 3,
    basic: 0,
    free: 0,
};

export default function VendorCampaignsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [vendorName, setVendorName] = useState<string>('');
    const [subscription, setSubscription] = useState<SubscriptionInfo>({
        plan: 'basic',
        pushQuotaUsed: 0,
        pushQuotaTotal: 0,
    });
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [showNewModal, setShowNewModal] = useState(false);
    const [sending, setSending] = useState(false);

    // New campaign form
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));
                let vId = '';

                if (vendorAdminDoc.exists()) {
                    vId = vendorAdminDoc.data().vendorId;
                } else {
                    const { isSuperAdmin } = await import('@/lib/config');
                    if (isSuperAdmin(user.email)) {
                        const butchersQuery = query(collection(db, 'businesses'), limit(1));
                        const snapshot = await getDocs(butchersQuery);
                        if (!snapshot.empty) {
                            vId = snapshot.docs[0].id;
                        }
                    } else {
                        router.push('/dashboard');
                        return;
                    }
                }

                setVendorId(vId);

                // Get vendor info
                const vendorDoc = await getDoc(doc(db, 'businesses', vId));
                if (vendorDoc.exists()) {
                    const data = vendorDoc.data();
                    setVendorName(data.companyName);
                    const plan = data.subscriptionPlan || 'basic';
                    setSubscription({
                        plan,
                        pushQuotaUsed: data.pushQuotaUsed || 0,
                        pushQuotaTotal: planQuotas[plan] || 0,
                    });
                }

                // Load campaigns
                const campaignsQuery = query(
                    collection(db, 'push_campaigns'),
                    where('vendorId', '==', vId),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                const campaignsSnapshot = await getDocs(campaignsQuery);
                const campaignData = campaignsSnapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as Campaign));
                setCampaigns(campaignData);

                setLoading(false);
            } catch (error) {
                console.error('Auth error:', error);
                router.push('/login');
            }
        });

        return () => unsubscribeAuth();
    }, [router]);

    const remainingQuota = subscription.pushQuotaTotal - subscription.pushQuotaUsed;

    // Send campaign
    const sendCampaign = async () => {
        if (!vendorId || !title || !message) return;
        if (remainingQuota <= 0 && subscription.pushQuotaTotal !== 999) {
            alert('Push kotanız doldu! Planınızı yükseltin.');
            return;
        }

        setSending(true);
        try {
            // Get favorited customers
            const favoritesQuery = query(
                collection(db, 'user_favorites'),
                where('vendorId', '==', vendorId),
                where('vendorType', '==', 'butcher')
            );
            const favoritesSnapshot = await getDocs(favoritesQuery);
            const customerIds = favoritesSnapshot.docs.map(d => d.data().userId);

            // Create campaign record
            const campaignRef = await addDoc(collection(db, 'push_campaigns'), {
                vendorId,
                vendorType: 'butcher',
                title,
                message,
                targetType: 'favorites',
                sentCount: customerIds.length,
                status: 'sent',
                createdAt: new Date(),
            });

            // Send push notifications via API
            if (customerIds.length > 0) {
                await fetch('/api/notifications/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userIds: customerIds,
                        title: `${vendorName}: ${title}`,
                        body: message,
                        data: { type: 'campaign', vendorId, campaignId: campaignRef.id },
                    }),
                });
            }

            // Update vendor push quota
            await updateDoc(doc(db, 'businesses', vendorId), {
                pushQuotaUsed: (subscription.pushQuotaUsed || 0) + 1,
            });

            // Update local state
            setSubscription(prev => ({
                ...prev,
                pushQuotaUsed: prev.pushQuotaUsed + 1,
            }));

            setCampaigns(prev => [{
                id: campaignRef.id,
                title,
                message,
                sentCount: customerIds.length,
                status: 'sent',
                createdAt: { toDate: () => new Date() },
            }, ...prev]);

            setShowNewModal(false);
            setTitle('');
            setMessage('');
            alert(`Kampanya ${customerIds.length} müşteriye gönderildi!`);
        } catch (error) {
            console.error('Send campaign error:', error);
            alert('Kampanya gönderilemedi. Tekrar deneyin.');
        }
        setSending(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-red-800 to-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <Link href="/vendor-panel" className="flex items-center gap-2 text-red-100 hover:text-white">
                        <span className="text-xl">←</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-3xl">📢</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Push Kampanyaları</h1>
                                <p className="text-gray-400 text-sm mt-1">
                                    Favori müşterilerinize indirim ve aksiyon bildirimi gönderin
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => remainingQuota > 0 || subscription.pushQuotaTotal === 999 ? setShowNewModal(true) : alert('Push kotanız doldu!')}
                            disabled={remainingQuota <= 0 && subscription.pushQuotaTotal !== 999}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📤 Yeni Kampanya
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Quota Display */}
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-400 text-sm mb-1">Push Kampanya Hakkı</h3>
                            <p className="text-white text-3xl font-bold">
                                {remainingQuota}
                                <span className="text-gray-500 text-lg font-normal">
                                    /{subscription.pushQuotaTotal === 999 ? '∞' : subscription.pushQuotaTotal}
                                </span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-400 text-sm">Plan</p>
                            <p className="text-white font-medium">{subscription.plan.toUpperCase()}</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {subscription.pushQuotaTotal !== 999 && subscription.pushQuotaTotal > 0 && (
                        <div className="mt-4">
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all"
                                    style={{ width: `${(remainingQuota / subscription.pushQuotaTotal) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {remainingQuota <= 0 && subscription.pushQuotaTotal !== 999 && subscription.pushQuotaTotal > 0 && (
                        <div className="mt-4 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
                            <p className="text-red-400 text-sm">
                                ⚠️ Bu ay için push kotanız doldu. Daha fazla kampanya göndermek için planınızı yükseltin.
                            </p>
                        </div>
                    )}

                    {subscription.pushQuotaTotal === 0 && (
                        <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded-lg">
                            <p className="text-yellow-400 text-sm">
                                ℹ️ Mevcut planınız push kampanya içermiyor. Standard veya üzeri plana geçin.
                            </p>
                        </div>
                    )}
                </div>

                {/* Campaign Templates */}
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                    <h3 className="text-white font-bold mb-4">📋 Hazır Şablonlar</h3>
                    <div className="grid md:grid-cols-3 gap-3">
                        {[
                            { title: '🎉 Hafta Sonu İndirimi', message: 'Bu hafta sonu %20 indirim! Kaçırmayın.' },
                            { title: '🥩 Taze Et Geldi', message: 'Bugün taze kuzu ve dana eti stoklarımız yenilendi.' },
                            { title: '🔥 Sınırlı Stok', message: 'Özel ürünlerimiz tükenmeden sipariş verin!' },
                        ].map((template, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setTitle(template.title);
                                    setMessage(template.message);
                                    setShowNewModal(true);
                                }}
                                disabled={remainingQuota <= 0 && subscription.pushQuotaTotal !== 999}
                                className="bg-gray-700 hover:bg-gray-650 rounded-lg p-4 text-left disabled:opacity-50"
                            >
                                <p className="text-white font-medium">{template.title}</p>
                                <p className="text-gray-400 text-sm mt-1">{template.message}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Campaign History */}
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                        <h3 className="text-white font-bold">📜 Kampanya Geçmişi</h3>
                    </div>
                    {campaigns.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-4xl mb-3">📭</div>
                            <p className="text-gray-400">Henüz kampanya gönderilmemiş</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-700">
                            {campaigns.map(campaign => (
                                <div key={campaign.id} className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{campaign.title}</p>
                                            <p className="text-gray-400 text-sm">{campaign.message}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-green-400 text-sm">
                                                {campaign.sentCount} kişiye gönderildi
                                            </p>
                                            <p className="text-gray-500 text-xs">
                                                {campaign.createdAt?.toDate?.()?.toLocaleDateString('de-DE')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* New Campaign Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-lg w-full">
                        <div className="p-6 border-b border-gray-700">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">📤 Yeni Kampanya</h2>
                                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-white text-2xl">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Başlık</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="örn: Hafta Sonu İndirimi"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                                    maxLength={50}
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Mesaj</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="örn: Bu hafta sonu tüm ürünlerde %20 indirim!"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white h-24 resize-none"
                                    maxLength={200}
                                />
                            </div>

                            <div className="bg-gray-700 rounded-lg p-4">
                                <p className="text-gray-400 text-sm">
                                    📱 Bu kampanya, dükkanınızı favorilerine ekleyen tüm müşterilere push bildirim olarak gönderilecek.
                                </p>
                            </div>

                            <button
                                onClick={sendCampaign}
                                disabled={sending || !title || !message}
                                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                            >
                                {sending ? 'Gönderiliyor...' : '📤 Kampanyayı Gönder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
