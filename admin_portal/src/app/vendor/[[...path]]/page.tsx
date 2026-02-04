'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function VendorRedirect() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Map old vendor paths to new vendor-panel paths
        const pathMap: Record<string, string> = {
            '/vendor': '/vendor-panel',
            '/vendor/orders': '/vendor-panel/orders',
            '/vendor/products': '/vendor-panel/products',
            '/vendor/inventory': '/vendor-panel/products',
            '/vendor/account': '/vendor-panel',
            '/vendor/settings': '/vendor-panel',
            '/vendor/suppliers': '/vendor-panel',
        };

        const newPath = pathMap[pathname] || '/vendor-panel';
        router.replace(newPath);
    }, [router, pathname]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-gray-400 mt-4">Yönlendiriliyor...</p>
            </div>
        </div>
    );
}
