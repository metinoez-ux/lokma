'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * /admin/staff → Redirect to unified Kullanıcı Yönetimi
 * 
 * This page previously had its own staff creation form that bypassed
 * Firebase Auth (using addDoc directly). All user/staff creation is
 * now consolidated into the Dashboard's Kullanıcı Yönetimi section.
 */
export default function StaffRedirectPage() {
    const tAdminStaff = useTranslations('AdminStaff');
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/dashboard?view=staff');
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-400">{tAdminStaff('personel_yonetimine_yonlendiriliyorsunuz')}</p>
            </div>
        </div>
    );
}
