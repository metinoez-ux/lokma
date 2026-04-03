'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Admin, KermesEvent } from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
 const [admin, setAdmin] = useState<Admin | null>(null);
 const [loading, setLoading] = useState(true);
 const [kermesEvents, setKermesEvents] = useState<KermesEvent[]>([]);
 const router = useRouter();

 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
 if (!user) {
 router.push('/login');
 return;
 }

 const adminDoc = await getDoc(doc(db, 'admins', user.uid));
 if (!adminDoc.exists()) {
 router.push('/login');
 return;
 }

 const adminData = adminDoc.data();

 // ROUTING: Non-Kermes admins should go to /admin/dashboard
 // Use window.location.href for more reliable redirect
 if (adminData.adminType !== 'kermes') {
 console.log('🔀 Redirecting non-kermes admin to /admin/dashboard, adminType:', adminData.adminType);
 window.location.href = '/admin/dashboard';
 return;
 }

 setAdmin({ id: adminDoc.id, ...adminData } as Admin);

 // Load Kermes events for this admin (only for kermes type)
 const eventsQuery = query(
 collection(db, 'kermes_events'),
 where('organizerId', '==', user.uid),
 orderBy('date', 'desc'),
 limit(10)
 );
 const eventsSnapshot = await getDocs(eventsQuery);
 setKermesEvents(eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesEvent)));

 setLoading(false);
 });

 return () => unsubscribe();
 }, [router]);

 const handleLogout = async () => {
 await auth.signOut();
 router.push('/login');
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-muted flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-muted">
 {/* Header */}
 <header className="bg-blue-900 text-white shadow-lg">
 <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
 <div className="flex items-center space-x-3">
 <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center">
 <span className="text-blue-900 font-bold">M</span>
 </div>
 <div>
 <h1 className="font-bold">MIRA Portal</h1>
 <p className="text-xs text-blue-200">{admin?.adminType?.toUpperCase()} Admin</p>
 </div>
 </div>
 <div className="flex items-center space-x-4">
 <span className="text-sm">{admin?.displayName}</span>
 <button
 onClick={handleLogout}
 className="bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition"
 >
 Çıkış
 </button>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <main className="max-w-7xl mx-auto px-4 py-8">
 {/* Welcome Card */}
 <div className="bg-background rounded-xl shadow-md p-6 mb-8">
 <h2 className="text-2xl font-bold text-foreground">
 Hoş geldin, {admin?.displayName}! 👋
 </h2>
 <p className="text-muted-foreground/80 mt-1">
 {admin?.adminType === 'kermes' && 'Kermes etkinliklerini yönet ve siparişleri takip et.'}
 </p>
 </div>

 {/* Quick Actions */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <Link href="/dashboard/kermes/new"
 className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
 <div className="text-3xl mb-2">➕</div>
 <h3 className="font-bold text-lg">Yeni Kermes</h3>
 <p className="text-green-100 text-sm">Yeni etkinlik oluştur</p>
 </Link>

 <Link href="/dashboard/kermes"
 className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
 <div className="text-3xl mb-2">📋</div>
 <h3 className="font-bold text-lg">Etkinliklerim</h3>
 <p className="text-blue-100 text-sm">{kermesEvents.length} aktif etkinlik</p>
 </Link>

 <Link href="/dashboard/orders"
 className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
 <div className="text-3xl mb-2">📦</div>
 <h3 className="font-bold text-lg">Siparişler</h3>
 <p className="text-purple-100 text-sm">Bekleyen siparişleri gör</p>
 </Link>

 {/* Super Admin Only - Push Notifications */}
 {admin?.adminType === 'super' && (
 <Link href="/dashboard/notifications"
 className="bg-gradient-to-br from-amber-500 to-red-500 text-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
 <div className="text-3xl mb-2">📢</div>
 <h3 className="font-bold text-lg">Push Bildirim</h3>
 <p className="text-amber-100 text-sm">Tüm kullanıcılara bildirim gönder</p>
 </Link>
 )}
 </div>

 {/* Recent Events */}
 <div className="bg-background rounded-xl shadow-md p-6">
 <h3 className="text-lg font-bold text-foreground mb-4">Son Etkinlikler</h3>

 {kermesEvents.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground/80">
 <p>Henüz etkinlik yok.</p>
 <Link href="/dashboard/kermes/new" className="text-blue-600 hover:underline">
 İlk etkinliğini oluştur →
 </Link>
 </div>
 ) : (
 <div className="space-y-4">
 {kermesEvents.map((event) => (
 <div key={event.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
 <div>
 <h4 className="font-semibold">{event.title}</h4>
 <p className="text-sm text-muted-foreground/80">{event.location}</p>
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
 }`}>
 {event.isActive ? 'Aktif' : 'Tamamlandı'}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </main>
 </div>
 );
}
