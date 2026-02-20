'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Legacy /admin/butchers/[id]/orders redirect
 * All order management now uses unified /admin/business/[id]/orders
 */
export default function ButcherOrdersRedirect() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    useEffect(() => {
        router.replace(`/admin/business/${id}/orders`);
    }, [router, id]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Siparişler yükleniyor...</p>
            </div>
        </div>
    );
}
