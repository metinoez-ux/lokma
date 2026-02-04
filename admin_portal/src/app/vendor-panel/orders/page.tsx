'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/**
 * Vendor Orders Page - Redirect to Unified Business Orders
 * 
 * This page redirects to /admin/business/[id]/orders for the unified experience.
 * All vendors use the same high-fidelity UI as the admin portal.
 */
export default function VendorOrdersRedirect() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Check if user is a vendor admin
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));
                
                if (vendorAdminDoc.exists()) {
                    const data = vendorAdminDoc.data();
                    const businessId = data.vendorId || data.businessId;
                    
                    if (businessId) {
                        // Redirect to unified orders page
                        router.replace(`/admin/business/${businessId}/orders`);
                        return;
                    }
                }

                // Check if super admin
                const { isSuperAdmin } = await import('@/lib/config');
                if (isSuperAdmin(user.email)) {
                    // Redirect to global orders
                    router.replace('/admin/orders');
                    return;
                }

                // No access
                setError('Bu sayfaya erişim yetkiniz yok.');
            } catch (err) {
                console.error('Error checking vendor access:', err);
                setError('Bir hata oluştu.');
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <div className="text-4xl mb-4">❌</div>
                    <h2 className="text-xl font-bold text-white mb-2">Erişim Hatası</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => router.push('/vendor-panel')}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Dashboard'a Dön
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Siparişler yükleniyor...</p>
            </div>
        </div>
    );
}
