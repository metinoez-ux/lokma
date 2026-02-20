'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function BusinessCategoriesRedirect() {
    const router = useRouter();
    const params = useParams();
    const businessId = params.id as string;

    useEffect(() => {
        // Redirect to main categories page with business context
        // The main page will detect the business from URL or admin context
        router.replace(`/admin/categories?businessId=${businessId}`);
    }, [router, businessId]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                <p className="text-gray-400 mt-4">Kategori yönetimine yönlendiriliyor...</p>
            </div>
        </div>
    );
}
