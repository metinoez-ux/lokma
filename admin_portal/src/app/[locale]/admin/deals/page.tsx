'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Suspense } from 'react';

function DealsPageContent() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'tr';

    useEffect(() => {
        router.replace(`/${locale}/admin/promotions?tab=firsatlar`);
    }, [locale, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Promosyon sayfasına yönlendiriliyor...</p>
            </div>
        </div>
    );
}

export default function DealsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            </div>
        }>
            <DealsPageContent />
        </Suspense>
    );
}
