"use client";

import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { normalizeTurkish } from '@/lib/utils';
import { FuneralMember } from '@/types';
import { collection, query, orderBy, limit, getDocs, startAfter, where, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FuneralMembersPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    const [members, setMembers] = useState<FuneralMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Initial load
    useEffect(() => {
        if (!adminLoading && admin) {
            loadMembers();
        }
    }, [admin, adminLoading]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'funeral_members'), orderBy('memberNumber', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FuneralMember));
            setMembers(data);
        } catch (error) {
            console.error('Error loading members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMember = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            memberNumber: formData.get('memberNo') as string,
            personalInfo: {
                firstName: formData.get('firstName') as string,
                lastName: formData.get('lastName') as string,
                tcNoOrPassport: formData.get('tcNo') as string,
                dateOfBirth: new Date(formData.get('birthDate') as string).toISOString(), // string preservation
                placeOfBirth: 'Bilinmiyor', // default for now
                gender: 'male', // default for now
                nationality: 'TC',
                phone: '',
                address: {
                    street: '',
                    postalCode: '',
                    city: '',
                    country: 'De',
                }
            },
            status: 'active',
            joinDate: new Date(),
            subscription: {
                plan: 'family',
                fee: 60,
                currency: 'EUR',
                startDate: new Date(),
                renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            },
            balance: 0,
            dependents: [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        try {
            await addDoc(collection(db, 'funeral_members'), data);
            setShowAddModal(false);
            loadMembers();
        } catch (error) {
            console.error('Error creating member:', error);
            alert('Hata oluştu: ' + error);
        } finally {
            setLoading(false);
        }
    };

    // Search logic with Turkish character normalization
    const normalizedSearch = normalizeTurkish(searchTerm);
    const filteredMembers = members.filter(m =>
        normalizeTurkish(m.memberNumber).includes(normalizedSearch) ||
        normalizeTurkish(m.personalInfo.firstName).includes(normalizedSearch) ||
        normalizeTurkish(m.personalInfo.lastName).includes(normalizedSearch)
    );

    if (adminLoading) return <div className="p-8 text-center text-white">Yükleniyor...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                        Cenaze Fonu Üyeleri
                    </h1>
                    <p className="text-gray-400 mt-1">Üyelik, aidat ve durum takibi</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition flex items-center gap-2"
                >
                    <span>➕</span> Yeni Üye Ekle
                </button>
            </div>

            {/* Search & Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="md:col-span-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Üye No, İsim veya TC No ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-5 py-4 bg-gray-800 rounded-xl border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition text-lg"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
                    </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-center items-center">
                    <span className="text-gray-400 text-sm">Toplam Üye</span>
                    <span className="text-3xl font-bold text-white">{members.length}</span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-center items-center">
                    <span className="text-gray-400 text-sm">Aktif Aileler</span>
                    <span className="text-3xl font-bold text-green-400">
                        {members.filter(m => m.status === 'active').length}
                    </span>
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Üye No</th>
                                <th className="px-6 py-4">Ad Soyad</th>
                                <th className="px-6 py-4">Eş/Çocuk</th>
                                <th className="px-6 py-4">Durum</th>
                                <th className="px-6 py-4">Bakiye</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-8">Yükleniyor...</td></tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Üye bulunamadı.</td></tr>
                            ) : filteredMembers.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-700/50 transition duration-150">
                                    <td className="px-6 py-4 font-mono text-green-400">{m.memberNumber}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{m.personalInfo.firstName} {m.personalInfo.lastName}</div>
                                        <div className="text-xs text-gray-500">{m.personalInfo.placeOfBirth}, {new Date(m.personalInfo.dateOfBirth).getFullYear()}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">
                                        {m.dependents?.length || 0} Kişi
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={m.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={m.balance < 0 ? 'text-red-400' : 'text-green-400'}>
                                            {m.balance} €
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300 border border-gray-600">
                                            {m.subscription.plan === 'family' ? 'Aile' : 'Tek'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-blue-400 hover:text-white transition text-sm font-medium">
                                            Detay &gt;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-2xl p-8 border border-gray-700 shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4">Yeni Üye Kaydı</h2>
                        <p className="text-gray-400 mb-6">Demo amaçlı hızlı kayıt formu. Gerçek uygulamada çok adımlı wizard olacak.</p>

                        {/* Placeholder Form */}
                        <div className="space-y-4">
                            <input type="text" placeholder="Ad" className="w-full bg-gray-700 p-3 rounded" />
                            <input type="text" placeholder="Soyad" className="w-full bg-gray-700 p-3 rounded" />
                            <button className="w-full bg-green-600 py-3 rounded text-white font-bold hover:bg-green-500">
                                Kaydet
                            </button>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="w-full bg-transparent py-3 rounded text-gray-400 hover:text-white"
                            >
                                Vazgeç
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: 'bg-green-900/50 text-green-400 border-green-700',
        pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
        debtor: 'bg-red-900/50 text-red-400 border-red-700',
        passive: 'bg-gray-700 text-gray-400 border-gray-600',
        deceased: 'bg-purple-900/50 text-purple-400 border-purple-700',
    };

    const labels: Record<string, string> = {
        active: 'Aktif',
        pending: 'Onay Bekliyor',
        debtor: 'Borçlu',
        passive: 'Pasif',
        deceased: 'Vefat',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.passive}`}>
            {labels[status] || status}
        </span>
    );
}
