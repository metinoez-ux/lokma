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
        <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
            <div className="text-center max-w-sm w-full bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl p-8 shadow-xl">
                {/* Modern Theme-Aware Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <span className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">LOKM</span>
                    <span className="text-4xl font-black text-red-600">A</span>
                    <span className="w-3 h-3 bg-red-600 rounded-full mt-4"></span>
                </div>
                
                {/* Custom Spinner */}
                <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-gray-200 dark:border-border rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 dark:text-foreground mb-2">
                    Yönlendiriliyorsunuz
                </h2>
                <p className="text-sm text-gray-500 dark:text-muted-foreground">
                    {tAdminStaff('personel_yonetimine_yonlendiriliyorsunuz')}
                </p>
            </div>
        </div>
    );
}
