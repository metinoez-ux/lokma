"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy /admin/butchers page redirect
 * All butcher management now uses the unified /admin/business?type=kasap page
 */
export default function ButchersRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/business?type=kasap");
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="text-4xl mb-4">🔄</div>
                <p className="text-white text-lg">Yönlendiriliyor...</p>
                <p className="text-gray-400 text-sm mt-2">Kasap Yönetimi → İşletme Yönetimi</p>
            </div>
        </div>
    );
}
