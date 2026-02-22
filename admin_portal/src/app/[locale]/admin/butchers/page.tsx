"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';

/**
 * Legacy /admin/butchers page redirect
 * All butcher management now uses the unified /admin/business?type=kasap page
 */
export default function ButchersRedirectPage() {
    
  const t = useTranslations('AdminButchers');
const router = useRouter();

    useEffect(() => {
        router.replace("/admin/business?type=kasap");
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="text-4xl mb-4">🔄</div>
                <p className="text-white text-lg">{t('yonlendiriliyor')}</p>
                <p className="text-gray-400 text-sm mt-2">{t('kasap_yonetimi_i_sletme_yonetimi')}</p>
            </div>
        </div>
    );
}
