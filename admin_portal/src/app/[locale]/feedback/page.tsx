'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

function FeedbackContent() {
    const searchParams = useSearchParams();
    const initialType = searchParams.get('type') || 'suggestion';

    const [feedbackType, setFeedbackType] = useState<'suggestion' | 'complaint' | 'question'>(
        initialType === 'complaint' ? 'complaint' : 'suggestion'
    );
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        // Auto-fill email if logged in
        if (auth.currentUser?.email) {
            setEmail(auth.currentUser.email);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setSending(true);
        try {
            await addDoc(collection(db, 'feedback'), {
                type: feedbackType,
                subject,
                message,
                email,
                userId: auth.currentUser?.uid || null,
                status: 'new',
                createdAt: Timestamp.now(),
            });
            setSent(true);
        } catch (error) {
            console.error('Error sending feedback:', error);
            alert('Gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
        }
        setSending(false);
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Teşekkürler!</h1>
                    <p className="text-gray-600 mb-6">
                        Mesajınız başarıyla gönderildi. En kısa sürede inceleyeceğiz.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/"
                            className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                        >
                            Ana Sayfaya Dön
                        </Link>
                        <button
                            onClick={() => {
                                setSent(false);
                                setMessage('');
                                setSubject('');
                            }}
                            className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200"
                        >
                            Yeni Mesaj Gönder
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/support" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                        ← Destek
                    </Link>
                    <span className="font-bold text-gray-900">Geri Bildirim</span>
                    <div className="w-16"></div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Geliştirici ile İletişim</h1>
                    <p className="text-gray-500 mb-6">
                        Fikirleriniz, önerileriniz veya şikayetleriniz için bize ulaşın. Her mesajı okuyoruz!
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Feedback Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mesaj Türü
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFeedbackType('suggestion')}
                                    className={`py-3 px-4 rounded-xl border text-center transition ${feedbackType === 'suggestion'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xl">💡</span>
                                    <p className="text-sm font-medium mt-1">Öneri</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFeedbackType('complaint')}
                                    className={`py-3 px-4 rounded-xl border text-center transition ${feedbackType === 'complaint'
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xl">📝</span>
                                    <p className="text-sm font-medium mt-1">Şikayet</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFeedbackType('question')}
                                    className={`py-3 px-4 rounded-xl border text-center transition ${feedbackType === 'question'
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xl">❓</span>
                                    <p className="text-sm font-medium mt-1">Soru</p>
                                </button>
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                E-posta (opsiyonel)
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Size geri dönmemiz için"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Subject */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Konu
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Kısaca ne hakkında?"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mesajınız *
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                placeholder={
                                    feedbackType === 'suggestion'
                                        ? 'Yeni bir özellik veya iyileştirme öneriniz nedir?'
                                        : feedbackType === 'complaint'
                                            ? 'Karşılaştığınız sorunu detaylı anlatın...'
                                            : 'Sorunuzu buraya yazın...'
                                }
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                required
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={sending || !message.trim()}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? 'Gönderiliyor...' : 'Gönder'}
                        </button>
                    </form>
                </div>

                {/* Note */}
                <p className="text-center text-gray-400 text-sm mt-6">
                    Mesajlar doğrudan geliştirici ekibimize iletilir.
                </p>
            </main>
        </div>
    );
}

export default function FeedbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        }>
            <FeedbackContent />
        </Suspense>
    );
}
