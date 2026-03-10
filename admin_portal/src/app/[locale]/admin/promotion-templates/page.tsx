'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Suspense } from 'react';

function PromotionTemplatesPageContent() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'tr';

    useEffect(() => {
        router.replace(`/${locale}/admin/promotions?tab=sablonlar`);
    }, [locale, router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Promosyon sayfasına yönlendiriliyor...</p>
            </div>
        </div>
    );
}

export default function PromotionTemplatesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
        }>
            <PromotionTemplatesPageContent />
        </Suspense>
    );
}
