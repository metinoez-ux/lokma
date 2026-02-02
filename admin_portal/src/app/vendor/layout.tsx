'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface VendorLayoutProps {
    children: ReactNode;
}

interface VendorData {
    businessId: string;
    businessName: string;
    role: string;
    permissions?: string[];
}

const navItems = [
    { href: '/vendor', label: 'Dashboard', icon: '📊' },
    { href: '/vendor/orders', label: 'Siparişler', icon: '📦' },
    { href: '/vendor/products', label: 'Ürünler', icon: '🍖' },
    { href: '/vendor/inventory', label: 'Stok Yönetimi', icon: '📋' },
    { href: '/vendor/suppliers', label: 'Toptancılar', icon: '🏭' },
    { href: '/vendor/staff', label: 'Personel', icon: '👥' },
    { href: '/vendor/account', label: 'Hesabım', icon: '💳' },
    { href: '/vendor/settings', label: 'Ayarlar', icon: '⚙️' },
];

export default function VendorLayout({ children }: VendorLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [vendor, setVendor] = useState<VendorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push('/login?returnUrl=/vendor');
                return;
            }

            setUser(firebaseUser);

            // Check if user is a vendor (has businessId in admins collection)
            try {
                const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    const businessId = data.butcherId || data.businessId;

                    if (businessId) {
                        // Get business name
                        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
                        const businessName = businessDoc.exists()
                            ? businessDoc.data().companyName || 'İşletme'
                            : 'İşletme';

                        setVendor({
                            businessId,
                            businessName,
                            role: data.role || 'vendor',
                            permissions: data.permissions || [],
                        });
                    } else {
                        // User is not associated with any business
                        router.push('/login?error=no_business');
                        return;
                    }
                } else {
                    router.push('/login?error=not_vendor');
                    return;
                }
            } catch (error) {
                console.error('Error checking vendor status:', error);
                router.push('/login?error=auth_failed');
                return;
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}>
                {/* Logo & Business */}
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                            {vendor?.businessName?.charAt(0) || 'V'}
                        </div>
                        {sidebarOpen && (
                            <div className="overflow-hidden">
                                <p className="text-white font-bold text-sm truncate">{vendor?.businessName}</p>
                                <p className="text-gray-400 text-xs">Vendor Panel</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/vendor' && pathname.startsWith(item.href));

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                            }`}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        {sidebarOpen && <span className="text-sm">{item.label}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User & Logout */}
                <div className="p-4 border-t border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        {sidebarOpen && (
                            <div className="overflow-hidden flex-1">
                                <p className="text-white text-sm truncate">{user?.email}</p>
                                <p className="text-gray-500 text-xs capitalize">{vendor?.role}</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition text-sm"
                    >
                        <span>🚪</span>
                        {sidebarOpen && <span>Çıkış Yap</span>}
                    </button>
                </div>

                {/* Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 m-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
                >
                    {sidebarOpen ? '◀' : '▶'}
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
