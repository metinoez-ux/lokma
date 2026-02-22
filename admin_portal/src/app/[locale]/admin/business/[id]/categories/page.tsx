'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function BusinessCategoriesRedirect() {
    
  const t = useTranslations('AdminBusiness[idCategories');
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
                <p className="text-gray-400 mt-4">{t('kategori_yonetimine_yonlendiriliyor')}</p>
            </div>
        </div>
    );
}
