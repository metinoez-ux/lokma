'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Admin } from '@/types';
import Link from 'next/link';

interface NotificationTopic {
    id: string;
    name: string;
}

export default function NotificationsPage() {
    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [topics, setTopics] = useState<NotificationTopic[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('all_users');
    const [sendToAll, setSendToAll] = useState(true);

    // Result state
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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

            const adminData = { id: adminDoc.id, ...adminDoc.data() } as Admin;

            // Only Super Admin can access this page
            if (adminData.adminType !== 'super') {
                router.push('/dashboard');
                return;
            }

            setAdmin(adminData);
            setLoading(false);
        });

        // Fetch available topics
        fetch('/api/notifications/send')
            .then(res => res.json())
            .then(data => setTopics(data.topics || []))
            .catch(console.error);

        return () => unsubscribe();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !body.trim()) {
            setResult({ success: false, message: 'Başlık ve içerik zorunludur.' });
            return;
        }

        setSending(true);
        setResult(null);

        try {
            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    body: body.trim(),
                    topic: sendToAll ? 'all_users' : selectedTopic,
                    sendToAll,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setResult({ success: true, message: `Bildirim başarıyla gönderildi! (${data.topic})` });
                setTitle('');
                setBody('');
            } else {
                setResult({ success: false, message: data.error || 'Bildirim gönderilemedi.' });
            }
        } catch (error) {
            setResult({ success: false, message: 'Bağlantı hatası: ' + String(error) });
        } finally {
            setSending(false);
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
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-blue-900 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Link href="/dashboard" className="text-blue-200 hover:text-white">
                            ← Dashboard
                        </Link>
                        <div className="w-px h-6 bg-blue-700"></div>
                        <div>
                            <h1 className="font-bold">Push Bildirimler</h1>
                            <p className="text-xs text-blue-200">Super Admin</p>
                        </div>
                    </div>
                    <span className="text-sm">{admin?.displayName}</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">
                        📢 Yeni Bildirim Gönder
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Başlık *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Bildirim başlığı..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                maxLength={50}
                            />
                            <p className="text-xs text-gray-500 mt-1">{title.length}/50</p>
                        </div>

                        {/* Body */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                İçerik *
                            </label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Bildirim içeriği..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                                maxLength={200}
                            />
                            <p className="text-xs text-gray-500 mt-1">{body.length}/200</p>
                        </div>

                        {/* Target Audience */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hedef Kitle
                            </label>

                            <div className="space-y-3">
                                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="audience"
                                        checked={sendToAll}
                                        onChange={() => setSendToAll(true)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div>
                                        <span className="font-medium text-gray-900">Tüm Kullanıcılar</span>
                                        <p className="text-xs text-gray-500">Uygulamayı kullanan herkese gönder</p>
                                    </div>
                                </label>

                                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="audience"
                                        checked={!sendToAll}
                                        onChange={() => setSendToAll(false)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-gray-900">Belirli Konu</span>
                                        <p className="text-xs text-gray-500">Sadece konuya abone olanlara gönder</p>
                                    </div>
                                </label>
                            </div>

                            {/* Topic Selector */}
                            {!sendToAll && (
                                <select
                                    value={selectedTopic}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    aria-label="Hedef konu seçin"
                                    className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                                >
                                    {topics.filter(t => t.id !== 'all_users').map((topic) => (
                                        <option key={topic.id} value={topic.id}>
                                            {topic.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Result Message */}
                        {result && (
                            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {result.success ? '✅' : '❌'} {result.message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={sending || !title.trim() || !body.trim()}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {sending ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Gönderiliyor...
                                </span>
                            ) : (
                                '📤 Bildirimi Gönder'
                            )}
                        </button>
                    </form>
                </div>

                {/* Info Card */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Bilgi</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Bildirimler anında tüm iOS cihazlara gönderilir</li>
                        <li>• Kullanıcılar bildirimlere uygulama içinden abone olurlar</li>
                        <li>• Gönderilen bildirimler geri alınamaz</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
