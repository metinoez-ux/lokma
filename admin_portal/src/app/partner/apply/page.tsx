'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function PartnerApplyPage() {
    const [formData, setFormData] = useState({
        businessName: '',
        ownerName: '',
        email: '',
        phone: '',
        businessType: '',
        city: '',
        address: '',
        description: '',
    });
    const [submitted, setSubmitted] = useState(false);

    const businessTypes = [
        'Kasap',
        'Market',
        'Restoran',
        'Fast Food',
        'Çiçekçi',
        'Catering',
        'Fırın/Pastane',
        'Diğer',
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In production, send to Firebase
        console.log('Partner application:', formData);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Başvurunuz Alındı!</h1>
                    <p className="text-white/60 mb-8">
                        Ekibimiz 24 saat içinde sizinle iletişime geçecektir. Teşekkür ederiz!
                    </p>
                    <Link href="/" className="inline-block bg-[#ec131e] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all">
                        Ana Sayfaya Dön
                    </Link>
                </div>
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/lokma_logo.png" alt="LOKMA" width={40} height={40} className="rounded-lg" />
                        <h2 className="text-2xl font-extrabold tracking-tighter uppercase">LOKMA</h2>
                    </Link>
                    <Link href="/partner" className="text-sm text-white/60 hover:text-white">← Geri</Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[600px] mx-auto">
                    <h1 className="text-3xl md:text-4xl font-black mb-4">Partner Başvurusu</h1>
                    <p className="text-white/60 mb-8">Formu doldurun, ekibimiz sizinle iletişime geçsin.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">İşletme Adı *</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                placeholder="Örn: Özkan Kasap"
                                value={formData.businessName}
                                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">İşletme Türü *</label>
                            <select
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                value={formData.businessType}
                                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                            >
                                <option value="">Seçiniz</option>
                                {businessTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Yetkili Adı Soyadı *</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                placeholder="Adınız Soyadınız"
                                value={formData.ownerName}
                                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">E-posta *</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                    placeholder="ornek@email.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Telefon *</label>
                                <input
                                    type="tel"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                    placeholder="+49 176 123 456 78"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Şehir *</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                placeholder="Örn: Berlin, Köln, München"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Adres</label>
                            <input
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all"
                                placeholder="Tam adres (opsiyonel)"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">İşletmeniz Hakkında</label>
                            <textarea
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-[#ec131e] focus:outline-none transition-all resize-none"
                                placeholder="Kısa bir açıklama (opsiyonel)"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-[#ec131e] hover:bg-red-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-[#ec131e]/20"
                        >
                            Başvuruyu Gönder
                        </button>

                        <p className="text-center text-white/40 text-sm">
                            Başvurarak <Link href="/terms" className="underline">Kullanım Koşulları</Link>nı kabul etmiş olursunuz.
                        </p>
                    </form>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
