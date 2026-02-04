'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VendorPanelCategoriesRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/categories');
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-gray-400 mt-4">Kategori yönetimine yönlendiriliyor...</p>
            </div>
        </div>
    );
}
