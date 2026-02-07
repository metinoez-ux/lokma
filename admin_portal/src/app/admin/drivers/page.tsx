'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AdminStaff {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: 'admin' | 'staff' | 'driver';
    isDriver?: boolean;
    assignedBusinesses?: string[];
    assignedBusinessNames?: string[];
    businessId?: string;
    businessName?: string;
    isActive?: boolean;
}

interface Business {
    id: string;
    name: string;
    type: string;
    plz?: string;
    city?: string;
    street?: string;
}

export default function DriverManagementPage() {
    const [allAdmins, setAllAdmins] = useState<AdminStaff[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<AdminStaff | null>(null);

    // Form state for business assignment
    const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
    const [businessSearchQuery, setBusinessSearchQuery] = useState('');

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'drivers' | 'all'>('drivers');

    // Load all admins (to show current drivers and allow assigning new ones)
    useEffect(() => {
        const adminsQuery = collection(db, 'admins');
        const unsubscribe = onSnapshot(adminsQuery, (snapshot) => {
            const adminsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                assignedBusinesses: doc.data().assignedBusinesses || [],
                assignedBusinessNames: doc.data().assignedBusinessNames || [],
            })) as AdminStaff[];
            setAllAdmins(adminsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load all businesses
    useEffect(() => {
        const loadBusinesses = async () => {
            const allBusinesses: Business[] = [];
            const businessesSnap = await getDocs(collection(db, 'businesses'));
            businessesSnap.docs.forEach(doc => {
                const data = doc.data();
                const address = data.address || {};
                allBusinesses.push({
                    id: doc.id,
                    name: data.companyName || data.name || 'İşletme',
                    type: data.businessType || 'business',
                    plz: address.postalCode || address.plz || data.postalCode || '',
                    city: address.city || data.city || '',
                    street: address.street || data.street || '',
                });
            });
            allBusinesses.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
            setBusinesses(allBusinesses);
        };
        loadBusinesses();
    }, []);

    // Filter: Current drivers (role=driver OR isDriver=true)
    const currentDrivers = useMemo(() => {
        return allAdmins.filter(a => a.role === 'driver' || a.isDriver === true);
    }, [allAdmins]);

    // Filter: Available staff to assign as driver (role=admin OR role=staff, not yet a driver)
    const availableStaff = useMemo(() => {
        return allAdmins.filter(a =>
            (a.role === 'admin' || a.role === 'staff') &&
            a.isDriver !== true
        );
    }, [allAdmins]);

    // Filtered drivers for display
    const filteredDrivers = useMemo(() => {
        const list = filterMode === 'drivers' ? currentDrivers : allAdmins;
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(d =>
            d.name?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.assignedBusinessNames?.some(n => n.toLowerCase().includes(q))
        );
    }, [currentDrivers, allAdmins, searchQuery, filterMode]);

    // Filtered businesses for search
    const filteredBusinesses = useMemo(() => {
        if (!businessSearchQuery) return businesses.slice(0, 20); // Show first 20 by default
        const q = businessSearchQuery.toLowerCase();
        return businesses.filter(b => b.name.toLowerCase().includes(q)).slice(0, 50);
    }, [businesses, businessSearchQuery]);

    // Open modal to assign driver role
    const openAssignModal = (staff?: AdminStaff) => {
        if (staff) {
            setSelectedStaff(staff);
            setSelectedBusinessIds(staff.assignedBusinesses || []);
        } else {
            setSelectedStaff(null);
            setSelectedBusinessIds([]);
        }
        setBusinessSearchQuery('');
        setShowModal(true);
    };

    // Toggle business selection
    const toggleBusiness = (businessId: string) => {
        if (selectedBusinessIds.includes(businessId)) {
            setSelectedBusinessIds(selectedBusinessIds.filter(id => id !== businessId));
        } else {
            setSelectedBusinessIds([...selectedBusinessIds, businessId]);
        }
    };

    // Save driver assignment
    const handleSaveDriver = async () => {
        if (!selectedStaff) return;

        try {
            const businessNames = selectedBusinessIds.map(
                id => businesses.find(b => b.id === id)?.name || 'Bilinmiyor'
            );

            await updateDoc(doc(db, 'admins', selectedStaff.id), {
                isDriver: true,
                assignedBusinesses: selectedBusinessIds,
                assignedBusinessNames: businessNames,
                updatedAt: new Date(),
            });

            setShowModal(false);
            setSelectedStaff(null);
            setSelectedBusinessIds([]);
        } catch (error) {
            console.error('Error saving driver:', error);
            alert('Sürücü kaydedilirken hata oluştu');
        }
    };

    // Remove driver role
    const removeDriverRole = async (staff: AdminStaff) => {
        if (!confirm(`${staff.name} için sürücü yetkisini kaldırmak istiyor musunuz?`)) return;

        try {
            await updateDoc(doc(db, 'admins', staff.id), {
                isDriver: false,
                assignedBusinesses: [],
                assignedBusinessNames: [],
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Error removing driver role:', error);
        }
    };

    // Stats
    const stats = {
        totalDrivers: currentDrivers.length,
        activeDrivers: currentDrivers.filter(d => d.isActive !== false).length,
        totalAssignments: currentDrivers.reduce((acc, d) => acc + (d.assignedBusinesses?.length || 0), 0),
        availableStaff: availableStaff.length,
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">🚗 Sürücü Yönetimi</h1>
                        <p className="text-gray-400 text-sm">Personeli sürücü olarak ata ve işletmelere görevlendir</p>
                    </div>
                    <a
                        href="/admin/drivers/performance"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        📊 Performans Raporu
                    </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                        <div className="text-sm text-gray-400">Sürücü</div>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-4 border-l-4 border-green-500">
                        <div className="text-2xl font-bold text-green-400">{stats.activeDrivers}</div>
                        <div className="text-sm text-green-300">✓ Aktif</div>
                    </div>
                    <div className="bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="text-2xl font-bold text-blue-400">{stats.availableStaff}</div>
                        <div className="text-sm text-blue-300">👤 Atanabilir Personel</div>
                    </div>
                    <div className="bg-orange-900/30 rounded-lg p-4 border-l-4 border-orange-500">
                        <div className="text-2xl font-bold text-orange-400">{stats.totalAssignments}</div>
                        <div className="text-sm text-orange-300">🏪 Toplam Atama</div>
                    </div>
                </div>

                {/* Search & Add */}
                <div className="flex justify-between items-center mb-4 gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="🔍 Ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-64 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500"
                        />
                        <select
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value as 'drivers' | 'all')}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        >
                            <option value="drivers">Sadece Sürücüler</option>
                            <option value="all">Tüm Personel</option>
                        </select>
                    </div>
                    <button
                        onClick={() => openAssignModal()}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                        ➕ Personeli Sürücü Yap
                    </button>
                </div>

                {/* Drivers/Staff Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDrivers.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-400">
                            {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz sürücü atanmamış'}
                        </div>
                    ) : (
                        filteredDrivers.map(person => (
                            <div
                                key={person.id}
                                className={`bg-gray-800 rounded-lg p-4 border-l-4 ${person.isDriver || person.role === 'driver'
                                    ? 'border-green-500'
                                    : 'border-gray-600'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="font-bold text-lg">{person.name}</div>
                                        <div className="text-sm text-gray-400">{person.email}</div>
                                        <div className="flex gap-1 mt-1">
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${person.role === 'admin' ? 'bg-purple-900/50 text-purple-300' :
                                                person.role === 'staff' ? 'bg-blue-900/50 text-blue-300' :
                                                    'bg-green-900/50 text-green-300'
                                                }`}>
                                                {person.role}
                                            </span>
                                            {(person.isDriver || person.role === 'driver') && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/50 text-green-300">
                                                    🚗 Sürücü
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Assigned Businesses */}
                                {(person.isDriver || person.role === 'driver') && (
                                    <div className="mb-3">
                                        <div className="text-xs text-gray-500 mb-1">Atanmış İşletmeler:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {(person.assignedBusinessNames?.length ?? 0) > 0 ? (
                                                person.assignedBusinessNames?.map((name, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 bg-orange-900/40 text-orange-300 text-xs rounded-full"
                                                    >
                                                        🏪 {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-500 text-sm">Henüz atanmamış</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-2 border-t border-gray-700">
                                    {(person.isDriver || person.role === 'driver') ? (
                                        <>
                                            <button
                                                onClick={() => openAssignModal(person)}
                                                className="flex-1 text-sm text-blue-400 hover:text-blue-300 py-1"
                                            >
                                                ✏️ İşletmeleri Düzenle
                                            </button>
                                            <button
                                                onClick={() => removeDriverRole(person)}
                                                className="flex-1 text-sm text-red-400 hover:text-red-300 py-1"
                                            >
                                                🗑️ Sürücü Yetkisini Kaldır
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => openAssignModal(person)}
                                            className="flex-1 text-sm text-green-400 hover:text-green-300 py-1"
                                        >
                                            🚗 Sürücü Yap
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div> {/* Close max-w-6xl */}

            {/* Assign Driver Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-4">
                                {selectedStaff ? `🚗 ${selectedStaff.name} - Sürücü Ataması` : '🚗 Personel Seç'}
                            </h2>

                            {/* If no staff selected, show staff list */}
                            {!selectedStaff ? (
                                <div>
                                    <div className="text-sm text-gray-400 mb-3">
                                        Sürücü olarak atamak istediğiniz personeli seçin:
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="🔍 Personel ara..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white mb-3"
                                    />
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {availableStaff
                                            .filter(s => !searchQuery ||
                                                s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .slice(0, 30)
                                            .map(staff => {
                                                // Determine Turkish role label
                                                const getRoleLabel = () => {
                                                    if (staff.role === 'admin') {
                                                        return 'İşletme Sahibi';
                                                    } else if (staff.role === 'staff') {
                                                        return 'Personel';
                                                    }
                                                    return staff.role;
                                                };

                                                return (
                                                    <button
                                                        key={staff.id}
                                                        onClick={() => {
                                                            setSelectedStaff(staff);
                                                            setSelectedBusinessIds([]);
                                                        }}
                                                        className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="font-medium">{staff.name || 'İsimsiz'}</div>
                                                                <div className="text-sm text-gray-400">{staff.email}</div>
                                                            </div>
                                                        </div>
                                                        {/* Business Name */}
                                                        {staff.businessName && (
                                                            <div className="text-sm text-orange-400 mt-1">
                                                                🏪 {staff.businessName}
                                                            </div>
                                                        )}
                                                        {/* Role Badge */}
                                                        <div className="mt-2 flex gap-2">
                                                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${staff.role === 'admin'
                                                                ? 'bg-purple-900/50 text-purple-300'
                                                                : 'bg-blue-900/50 text-blue-300'
                                                                }`}>
                                                                {getRoleLabel()}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        }
                                        {availableStaff.length === 0 && (
                                            <div className="text-center text-gray-500 py-4">
                                                Atanabilir personel bulunamadı
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Staff selected - show business assignment */
                                <div>
                                    <div className="bg-gray-700 rounded-lg p-3 mb-4">
                                        <div className="font-medium">{selectedStaff.name}</div>
                                        <div className="text-sm text-gray-400">{selectedStaff.email}</div>
                                    </div>

                                    {/* Selected Businesses */}
                                    {selectedBusinessIds.length > 0 && (
                                        <div className="mb-4">
                                            <div className="text-sm text-gray-400 mb-2">
                                                Seçili İşletmeler ({selectedBusinessIds.length}):
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedBusinessIds.map(id => {
                                                    const biz = businesses.find(b => b.id === id);
                                                    return (
                                                        <span
                                                            key={id}
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-orange-900/50 text-orange-300 text-sm rounded-full"
                                                        >
                                                            🏪 {biz?.name || id}
                                                            <button
                                                                onClick={() => toggleBusiness(id)}
                                                                className="ml-1 hover:text-orange-100"
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Business Search */}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">
                                            İşletme Ara ve Ekle:
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="🔍 İşletme adı yazın..."
                                            value={businessSearchQuery}
                                            onChange={(e) => setBusinessSearchQuery(e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 mb-2"
                                        />
                                        <div className="max-h-48 overflow-y-auto bg-gray-700 rounded-lg">
                                            {filteredBusinesses.length === 0 ? (
                                                <div className="text-gray-500 text-sm text-center py-4">
                                                    {businessSearchQuery ? 'İşletme bulunamadı' : 'Arama yapmak için yazın'}
                                                </div>
                                            ) : (
                                                filteredBusinesses.map(business => (
                                                    <button
                                                        key={business.id}
                                                        onClick={() => toggleBusiness(business.id)}
                                                        className={`w-full text-left px-4 py-2 hover:bg-gray-600 flex items-center justify-between ${selectedBusinessIds.includes(business.id) ? 'bg-orange-900/30' : ''
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium">{business.name}</div>
                                                            {(business.plz || business.city) && (
                                                                <div className="text-xs text-gray-400">
                                                                    {business.plz && <span className="text-orange-400">{business.plz}</span>}
                                                                    {business.plz && business.city && ' • '}
                                                                    {business.city}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {selectedBusinessIds.includes(business.id) && (
                                                            <span className="text-green-400">✓</span>
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        if (selectedStaff && !selectedStaff.isDriver) {
                                            // Go back to staff selection
                                            setSelectedStaff(null);
                                        } else {
                                            setShowModal(false);
                                            setSelectedStaff(null);
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                >
                                    {selectedStaff && !selectedStaff.isDriver ? '← Geri' : 'İptal'}
                                </button>
                                {selectedStaff && (
                                    <button
                                        onClick={handleSaveDriver}
                                        disabled={selectedBusinessIds.length === 0}
                                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        ✓ Kaydet
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
