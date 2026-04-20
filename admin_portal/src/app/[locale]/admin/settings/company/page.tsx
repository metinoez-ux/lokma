"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';

export default function RedirectToBusinessSettings() {
    const { admin, loading } = useAdmin();
    const router = useRouter();
    const t = useTranslations('AdminSettings');

    const searchParams = useSearchParams();

    useEffect(() => {
        if (!loading) {
            if (admin?.butcherId) {
                // Determine the target tab based on generic parameters like ?target=teslimat
                const target = searchParams.get('target');
                let targetParams = "?tab=settings&subTab=isletme";
                if (target) {
                    targetParams += `&isletmeInternalTab=${target}`;
                }
                router.replace(`/admin/business/${admin.butcherId}${targetParams}`);
            } else {
                router.replace('/admin/dashboard');
            }
        }
    }, [admin, loading, router, searchParams]);

    return (
        <div className="flex h-[50vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <p className="text-muted-foreground text-sm font-medium animate-pulse">
                    {t('yonlendiriliyor') || 'İşletme Profiline Yönlendiriliyor...'}
                </p>
            </div>
        </div>
    );
}
