'use client';

import Link from 'next/link';
import Image from 'next/image';

const openPositions = [
    {
        title: 'Senior Full-Stack Developer',
        department: 'Engineering',
        location: 'Berlin, DE (Hybrid)',
        type: 'Full-time',
    },
    {
        title: 'Mobile App Developer (Flutter)',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-time',
    },
    {
        title: 'Product Designer',
        department: 'Design',
        location: 'Berlin, DE',
        type: 'Full-time',
    },
    {
        title: 'Business Development Manager',
        department: 'Sales',
        location: 'Köln, DE',
        type: 'Full-time',
    },
    {
        title: 'Customer Success Manager (Turkish Speaker)',
        department: 'Operations',
        location: 'Berlin, DE',
        type: 'Full-time',
    },
    {
        title: 'Marketing Specialist',
        department: 'Marketing',
        location: 'Remote',
        type: 'Part-time',
    },
];

export default function CareersPage() {
    return (
        <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/lokma_logo.png" alt="LOKMA" width={40} height={40} className="rounded-lg" />
                        <h2 className="text-2xl font-extrabold tracking-tighter uppercase">LOKMA</h2>
                    </Link>
                    <Link href="/" className="text-sm text-white/60 hover:text-white">← Ana Sayfa</Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[1000px] mx-auto">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-black mb-6">Kariyer</h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            LOKMA ailesine katılın! Yerel ticareti dijitalleştirmek için birlikte çalışalım.
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="grid md:grid-cols-4 gap-6 mb-16">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">work_history</span>
                            <h4 className="font-bold">Esnek Çalışma</h4>
                            <p className="text-sm text-white/60">Remote & hybrid seçenekler</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">trending_up</span>
                            <h4 className="font-bold">Büyüme</h4>
                            <p className="text-sm text-white/60">Kariyer gelişimi fırsatları</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">diversity_3</span>
                            <h4 className="font-bold">Çeşitlilik</h4>
                            <p className="text-sm text-white/60">Kapsayıcı iş ortamı</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">favorite</span>
                            <h4 className="font-bold">Yan Haklar</h4>
                            <p className="text-sm text-white/60">Rekabetçi maaş & primler</p>
                        </div>
                    </div>

                    {/* Open Positions */}
                    <h2 className="text-2xl font-bold mb-8">Açık Pozisyonlar</h2>
                    <div className="space-y-4">
                        {openPositions.map((job, index) => (
                            <a
                                key={index}
                                href={`mailto:kariyer@lokma.shop?subject=${encodeURIComponent(job.title + ' Başvurusu')}`}
                                className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ec131e]/50 transition-all group"
                            >
                                <div className="mb-4 md:mb-0">
                                    <h3 className="font-bold text-lg group-hover:text-[#ec131e] transition-colors">{job.title}</h3>
                                    <p className="text-sm text-white/60">{job.department}</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-xs">{job.location}</span>
                                    <span className="bg-[#ec131e]/20 text-[#ec131e] px-3 py-1 rounded-full text-xs">{job.type}</span>
                                </div>
                            </a>
                        ))}
                    </div>

                    <div className="mt-12 bg-gradient-to-br from-[#ec131e]/10 to-transparent border border-[#ec131e]/20 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold mb-4">Aradığınız pozisyonu bulamadınız mı?</h3>
                        <p className="text-white/60 mb-6">Açık başvuru yapın, uygun pozisyon açıldığında sizinle iletişime geçelim.</p>
                        <a
                            href="mailto:kariyer@lokma.shop?subject=Açık Başvuru"
                            className="inline-block bg-[#ec131e] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all"
                        >
                            CV Gönder
                        </a>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
