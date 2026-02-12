'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function KVKKPage() {
    return (
        <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/lokma_logo_wide.png" alt="LOKMA" width={140} height={36} className="object-contain" />
                    </Link>
                    <Link href="/" className="text-sm text-white/60 hover:text-white">← Ana Sayfa</Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto prose prose-invert">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">KVKK / DSGVO Aydınlatma Metni</h1>

                    <p className="text-white/60 mb-8">Son güncelleme: Ocak 2024</p>

                    <div className="space-y-8 text-white/80">
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Veri Sorumlusu</h2>
                            <p>
                                LOKMA GmbH olarak, kişisel verilerinizin korunmasını önemsiyoruz. Bu aydınlatma metni,
                                Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR/DSGVO) ve Türkiye Kişisel Verilerin Korunması
                                Kanunu (KVKK) kapsamında hazırlanmıştır.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">2. İşlenen Kişisel Veriler</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Kimlik bilgileri (ad, soyad)</li>
                                <li>İletişim bilgileri (telefon, e-posta, adres)</li>
                                <li>Konum verileri</li>
                                <li>Sipariş ve işlem geçmişi</li>
                                <li>Ödeme bilgileri (kart numarası saklanmaz)</li>
                                <li>Cihaz ve tarayıcı bilgileri</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">3. Veri İşleme Amaçları</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Sipariş işleme ve teslimat</li>
                                <li>Müşteri hizmetleri</li>
                                <li>Yasal yükümlülüklerin yerine getirilmesi</li>
                                <li>Hizmet iyileştirme (izniniz dahilinde)</li>
                                <li>Pazarlama iletişimi (izniniz dahilinde)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Haklarınız</h2>
                            <p className="mb-4">GDPR ve KVKK kapsamında aşağıdaki haklara sahipsiniz:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Verilerinize erişim hakkı</li>
                                <li>Verilerin düzeltilmesini isteme hakkı</li>
                                <li>Verilerin silinmesini isteme hakkı (unutulma hakkı)</li>
                                <li>İşlemenin kısıtlanmasını isteme hakkı</li>
                                <li>Veri taşınabilirliği hakkı</li>
                                <li>İtiraz hakkı</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">5. İletişim</h2>
                            <p>
                                Kişisel verileriniz hakkında sorularınız için:<br />
                                <strong>E-posta:</strong> datenschutz@lokma.shop<br />
                                <strong>Adres:</strong> LOKMA GmbH, Musterstraße 123, 10115 Berlin, Deutschland
                            </p>
                        </section>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
