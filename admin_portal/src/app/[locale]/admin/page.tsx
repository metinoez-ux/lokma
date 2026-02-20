'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isSuperAdmin } from '@/lib/config';
import { useRouter } from 'next/navigation';

/**
 * /admin - Super Admin'ler için giriş noktası
 * Otomatik olarak uygun sayfaya yönlendirir
 */
export default function AdminIndexPage() {
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // Not logged in - redirect to login with return URL
                router.push('/login?returnUrl=/admin/dashboard');
                return;
            }

            // Check email whitelist first
            if (isSuperAdmin(user.email)) {
                // Super admin - go to dashboard
                router.push('/admin/dashboard');
                return;
            }

            // Check Firestore for admin role
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (adminDoc.exists() && adminDoc.data().role === 'super_admin') {
                router.push('/admin/dashboard');
                return;
            }

            // Not authorized - redirect to login
            router.push('/login');
        });

        return () => unsubscribe();
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Yönlendiriliyor...</p>
            </div>
        </div>
    );
}
