'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface UserData {
    id: string;
    displayName?: string;
    email?: string;
    phone?: string;
    photoURL?: string;
    createdAt?: any;
    lastLoginAt?: any;
    city?: string;
    country?: string;
}

export default function CustomersPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading: adminLoading } = useAdmin();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!admin || admin.adminType !== 'super') return;

        const loadUsers = async () => {
            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, limit(500));
                const snapshot = await getDocs(q);
                const usersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                } as UserData));
                // Sort by createdAt desc
                usersData.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
                    const bTime = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
                    return bTime - aTime;
                });
                setUsers(usersData);
            } catch (err) {
                console.error('Error loading users:', err);
            }
            setLoading(false);
        };
        loadUsers();
    }, [admin]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const term = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.displayName || '').toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term) ||
            (u.phone || '').includes(term) ||
            (u.city || '').toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!admin || admin.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-red-400 text-lg">{t('accessDenied') || 'Zugriff verweigert'}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">👤</span>
                        <div>
                            <h1 className="text-2xl font-bold">{t('customers')}</h1>
                            <p className="text-gray-400 text-sm">
                                {filteredUsers.length} / {users.length} {t('customers')}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/admin/dashboard"
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                        ← {t('allUsers')}
                    </Link>
                </div>

                {/* Search */}
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="🔍 Kunde suchen (Name, E-Mail, Telefon, Stadt)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>

                {/* Users Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                        <span className="text-5xl mb-4 block">🔍</span>
                        <p className="text-gray-400">Keine Kunden gefunden</p>
                    </div>
                ) : (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-750 border-b border-gray-700">
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">E-Mail</th>
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Telefon</th>
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Stadt</th>
                                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Registriert</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user, idx) => {
                                        const createdDate = user.createdAt?.toDate?.()
                                            ? user.createdAt.toDate().toLocaleDateString('de-DE')
                                            : user.createdAt?.seconds
                                                ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('de-DE')
                                                : '—';
                                        return (
                                            <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {user.photoURL ? (
                                                            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300">
                                                                {(user.displayName || '?')[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="text-white font-medium">
                                                            {user.displayName || 'Unbekannt'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{user.email || '—'}</td>
                                                <td className="px-4 py-3 text-gray-300">{user.phone || '—'}</td>
                                                <td className="px-4 py-3 text-gray-300">{user.city || '—'}</td>
                                                <td className="px-4 py-3 text-gray-400">{createdDate}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
