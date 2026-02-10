'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DineInTablePage() {
    const params = useParams();
    const businessId = params.businessId as string;
    const tableNum = params.tableNum as string;
    const [businessName, setBusinessName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Deep link URL the app will open
    const deepLinkUrl = `https://lokma.web.app/dinein/${businessId}/table/${tableNum}`;

    useEffect(() => {
        // Fetch business name from Firestore
        const fetchBusiness = async () => {
            try {
                const docRef = doc(db, 'businesses', businessId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setBusinessName(docSnap.data().name || docSnap.data().businessName || 'İşletme');
                }
            } catch {
                // Silently fail — show generic text
            } finally {
                setLoading(false);
            }
        };
        fetchBusiness();

        // Try to open the app immediately via Universal Link
        // If the app is installed, iOS/Android will intercept this
        // If not, the user stays on this page
        const timeout = setTimeout(() => {
            // The user is still here — app didn't open
        }, 2000);

        return () => clearTimeout(timeout);
    }, [businessId]);

    return (
        <>
            <head>
                {/* Apple Smart App Banner */}
                <meta name="apple-itunes-app" content={`app-argument=${deepLinkUrl}`} />
            </head>
            <div className="min-h-screen bg-[#120a0a] text-white flex flex-col items-center justify-center px-6 font-['Plus_Jakarta_Sans',sans-serif]">
                {/* Animated Background */}
                <div className="fixed inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#ec131e]/10 via-[#120a0a] to-[#120a0a]" />
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#ec131e]/5 rounded-full blur-3xl animate-pulse" />
                </div>

                <div className="relative z-10 max-w-md w-full text-center space-y-8">
                    {/* Logo */}
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
                            <Image
                                src="/lokma_logo.png"
                                alt="LOKMA"
                                width={56}
                                height={56}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-3">
                        <h1 className="text-3xl font-black tracking-tight">
                            Masandan Sipariş Ver
                        </h1>
                        <div className="flex items-center justify-center gap-3">
                            {loading ? (
                                <div className="h-6 w-48 bg-white/10 rounded-lg animate-pulse" />
                            ) : (
                                <>
                                    {businessName && (
                                        <span className="text-lg font-semibold text-[#ec131e]">{businessName}</span>
                                    )}
                                    <span className="text-white/30">•</span>
                                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-sm font-medium">
                                        🍽️ Masa {tableNum}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* QR Icon */}
                    <div className="flex justify-center py-4">
                        <div className="relative">
                            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#ec131e]/20 to-[#ec131e]/5 border border-[#ec131e]/30 flex items-center justify-center">
                                <svg className="w-14 h-14 text-[#ec131e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            {/* Pulse ring */}
                            <div className="absolute inset-0 rounded-3xl border-2 border-[#ec131e]/20 animate-ping" />
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-white/60 text-base leading-relaxed">
                        Sipariş vermek için <span className="text-white font-semibold">LOKMA</span> uygulamasını indir,
                        QR kodu tekrar tara ve doğrudan masandan sipariş vermeye başla.
                    </p>

                    {/* Download Buttons */}
                    <div className="space-y-3 pt-2">
                        {/* App Store */}
                        <a
                            href="https://apps.apple.com/app/lokma/id6740487634"
                            className="flex items-center justify-center gap-3 w-full bg-white text-black py-4 rounded-2xl font-bold text-base hover:bg-white/90 transition-all shadow-xl"
                        >
                            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                            App Store'dan İndir
                        </a>

                        {/* Google Play */}
                        <a
                            href="https://play.google.com/store/apps/details?id=com.lokma.lokma_app"
                            className="flex items-center justify-center gap-3 w-full bg-white/10 border border-white/20 text-white py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-.91L19.59 12 17.72 10.79l-2.54 2.54 2.54 .88zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z" />
                            </svg>
                            Google Play'den İndir
                        </a>
                    </div>

                    {/* Already installed hint */}
                    <div className="pt-4">
                        <p className="text-white/30 text-xs">
                            Uygulama zaten yüklüyse, QR kodu tekrar tarayın — doğrudan uygulamada açılacak.
                        </p>
                    </div>

                    {/* LOKMA branding footer */}
                    <div className="pt-8 pb-4">
                        <p className="text-white/20 text-xs">© 2026 LOKMA Platform</p>
                    </div>
                </div>
            </div>
        </>
    );
}
