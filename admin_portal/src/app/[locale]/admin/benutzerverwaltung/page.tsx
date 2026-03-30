'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, getDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { getModuleBusinessTypes } from '@/lib/business-types';
import { WorkspaceAssignmentsList, Assignment } from './components/WorkspaceAssignmentsList';

const COUNTRY_CODES = [
    { code: 'DE', dial: '+49', flag: '🇩🇪' },
    { code: 'AT', dial: '+43', flag: '🇦🇹' },
    { code: 'CH', dial: '+41', flag: '🇨🇭' },
    { code: 'TR', dial: '+90', flag: '🇹🇷' },
];

export interface UnifiedUser {
    id: string;
    source: 'users' | 'admins';
    email: string;
    displayName: string;
    phone: string;
    photoURL?: string;
    roles: string[];
    primaryRole: string;
    businessId?: string;
    kermesId?: string;
    createdAt?: Date;
    isActive?: boolean;
    assignments?: Assignment[];
}

export interface Business {
    id: string;
    name: string;
    type: string;
    plz: string;
    city: string;
    street?: string;
    address?: string;
}

export interface KermesEvent {
    id: string;
    name: string;
    plz: string;
    city: string;
    dernekIsmi?: string;
    street?: string;
    address?: string;
}

type RoleFilter = 'all' | 'customer' | 'super' | 'lokma_admin' | 'kermes_admin' | 'driver' | 'staff';

export default function BenutzerverwaltungPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    const [users, setUsers] = useState<UnifiedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Business & Modal State
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [kermesEvents, setKermesEvents] = useState<KermesEvent[]>([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UnifiedUser | null>(null);
    const [isDriver, setIsDriver] = useState(false);
    const [driverType, setDriverType] = useState<string>('platform');
    const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
    const [selectedKermesIds, setSelectedKermesIds] = useState<string[]>([]);
    const [businessSearch, setBusinessSearch] = useState('');
    const [kermesSearch, setKermesSearch] = useState('');
    const [savingModal, setSavingModal] = useState(false);
    
    // Add User / Partner Modal State
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [addingUser, setAddingUser] = useState(false);
    const [newUserData, setNewUserData] = useState({
        firstName: '', lastName: '', email: '', phone: '', dialCode: '+49',
        address: '', houseNumber: '', addressLine2: '', city: '', postalCode: '',
        country: 'Almanya', role: 'staff', sector: '', password: '', businessId: ''
    });
    const [newUserIsDriver, setNewUserIsDriver] = useState(false);
    const [newUserDriverType, setNewUserDriverType] = useState<string>('platform');
    const [newUserSelectedBusinessIds, setNewUserSelectedBusinessIds] = useState<string[]>([]);
    const [newUserSelectedKermesIds, setNewUserSelectedKermesIds] = useState<string[]>([]);
    const [newUserAssignments, setNewUserAssignments] = useState<Assignment[]>([]);

    // Edit Modal State
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRoles, setEditRoles] = useState<string[]>([]);
    
    // Additional Detailed Edit State
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editHouseNumber, setEditHouseNumber] = useState('');
    const [editAddressLine2, setEditAddressLine2] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editPostalCode, setEditPostalCode] = useState('');
    const [editCountry, setEditCountry] = useState('Almanya');
    const [editRole, setEditRole] = useState('staff');
    const [editSector, setEditSector] = useState('');
    const [editBusinessId, setEditBusinessId] = useState('');
    const [addBusinessSearch, setAddBusinessSearch] = useState('');
    const [showAddBusinessDropdown, setShowAddBusinessDropdown] = useState(false);
    const [editAssignments, setEditAssignments] = useState<Assignment[]>([]);

    // Permission check
    const isSuperAdmin = admin?.adminType === 'super';

    useEffect(() => {
        if (!adminLoading && admin) {
            fetchData();
        }
    }, [adminLoading, admin]);

    useEffect(() => {
        const loadBusinessesAndKermes = async () => {
            const allBusinesses: Business[] = [];
            const businessesSnap = await getDocs(collection(db, 'businesses'));
            businessesSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                allBusinesses.push({
                    id: docSnap.id,
                    name: data.companyName || data.name || t('businessLabel'),
                    type: data.businessType || 'business',
                    plz: data.plz || data.postalCode || data.zipCode || data.address?.postalCode || data.address?.plz || data.address?.zipCode || '',
                    city: data.city || data.address?.city || '',
                    street: data.street || data.streetAddress || data.address?.street || data.address?.streetAddress || '',
                    address: data.address ? (typeof data.address === 'string' ? data.address : JSON.stringify(data.address)) : ''
                });
            });
            allBusinesses.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
            setBusinesses(allBusinesses);

            const allKermes: KermesEvent[] = [];
            const kQ = query(collection(db, 'kermes_events'), where('status', 'in', ['draft', 'active', 'published']));
            const kermesSnap = await getDocs(kQ).catch(() => ({ docs: [] }));
            kermesSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                allKermes.push({
                    id: docSnap.id,
                    name: data.name || data.dernekIsmi || data.associationName || data.title || t('kermesLabel') || 'Kermes',
                    plz: data.address?.plz || data.location?.zipCode || data.address?.postalCode || data.plz || data.postalCode || '',
                    city: data.address?.city || data.location?.city || data.city || '',
                    dernekIsmi: data.dernekIsmi || data.associationName || '',
                    street: data.street || data.address?.street || data.location?.street || data.address?.streetName || '',
                    address: data.address ? (typeof data.address === 'string' ? data.address : JSON.stringify(data.address)) : (data.location ? JSON.stringify(data.location) : '')
                });
            });
            allKermes.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
            setKermesEvents(allKermes);
        };
        if (isSuperAdmin) {
            loadBusinessesAndKermes();
        }
    }, [isSuperAdmin]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const uniqueUsersMap = new Map<string, UnifiedUser>();

            // 1. Fetch Admins Collection
            let adminsQuery = query(collection(db, 'admins'));
            if (!isSuperAdmin) {
                if (admin?.businessId) {
                    adminsQuery = query(collection(db, 'admins'), where('businessId', '==', admin.businessId));
                } else if (admin?.kermesId) {
                    adminsQuery = query(collection(db, 'admins'), where('kermesId', '==', admin.kermesId));
                } else {
                    adminsQuery = query(collection(db, 'admins'), where('businessId', '==', 'NONE')); 
                }
            }
            
            const adminsSnap = await getDocs(adminsQuery);
            adminsSnap.docs.forEach(doc => {
                const data = doc.data();
                const email = data.email || '';
                
                let rolesList: string[] = [];
                if (data.adminType === 'super') rolesList.push('super');
                if (data.adminType === 'admin' || data.adminType === 'lokma_admin') rolesList.push('lokma_admin');
                if (data.adminType === 'kermes_admin') rolesList.push('kermes_admin');
                if (data.adminType === 'driver' || (data.roles && data.roles.includes('driver')) || data.isDriver) rolesList.push('driver');
                if (data.roles && data.roles.includes('staff')) rolesList.push('staff');
                // fallback
                if (rolesList.length === 0) rolesList.push('staff');

                // We prioritize deduping by email if available, otherwise by doc ID
                const uniqueKey = email.toLowerCase() || doc.id;
                
                if (uniqueUsersMap.has(uniqueKey)) {
                    const existing = uniqueUsersMap.get(uniqueKey)!;
                    // Merge roles if duplicate exists
                    existing.roles = Array.from(new Set([...existing.roles, ...rolesList]));
                    if (rolesList.includes('super')) existing.primaryRole = 'super';
                } else {
                    uniqueUsersMap.set(uniqueKey, {
                        id: doc.id,
                        source: 'admins',
                        email: email,
                        displayName: data.displayName || data.name || email?.split('@')[0] || 'Bilinmiyor',
                        phone: data.phone || data.phoneNumber || '',
                        photoURL: data.photoURL || '',
                        roles: rolesList,
                        primaryRole: rolesList.includes('super') ? 'super' : rolesList[0],
                        businessId: data.businessId,
                        kermesId: data.kermesId,
                        isActive: data.isActive,
                        assignments: data.assignments || [],
                    });
                }
            });

            // 2. Fetch Users Collection (ONLY for Super Admin)
            if (isSuperAdmin) {
                const usersQ = query(collection(db, 'users'), limit(500));
                const usersSnap = await getDocs(usersQ);
                usersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const email = data.email || '';
                    const uniqueKey = email.toLowerCase() || doc.id;
                    
                    // Do not overwrite an existing admin/staff record with a basic user record
                    if (!uniqueUsersMap.has(uniqueKey)) {
                        uniqueUsersMap.set(uniqueKey, {
                            id: doc.id,
                            source: 'users',
                            email: email,
                            displayName: data.displayName || data.name || data.firstName || 'Müşteri',
                            phone: data.phone || data.phoneNumber || '',
                            photoURL: data.photoURL || '',
                            roles: ['customer'],
                            primaryRole: 'customer',
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                            isActive: true,
                        });
                    }
                });
            }

            // 3. Fetch Invitations 
            if (isSuperAdmin) {
                const invQ = query(collection(db, 'admin_invitations'), where('status', '==', 'pending'));
                const invSnap = await getDocs(invQ);
                invSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const email = data.email || '';
                    const uniqueKey = email.toLowerCase() || doc.id;

                    if (!uniqueUsersMap.has(uniqueKey)) {
                        let invRole = data.adminType === 'super' ? 'super' : (data.role || 'staff');
                        uniqueUsersMap.set(uniqueKey, {
                            id: doc.id,
                            source: 'admins',
                            email: email,
                            displayName: '📧 ' + (email?.split('@')[0] || 'Davet'),
                            phone: '',
                            photoURL: '',
                            roles: [invRole],
                            primaryRole: invRole,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                            isActive: false, // Mark as inactive/pending
                        });
                    }
                });
            }

            const fetchedUsers = Array.from(uniqueUsersMap.values());

            // Sort by recent by default
            fetchedUsers.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            setUsers(fetchedUsers);
        } catch (error) {
            console.error("Error fetching unified users:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Role Filter
            if (roleFilter !== 'all' && !user.roles.includes(roleFilter)) return false;

            // Search Term
            if (searchQuery.trim()) {
                const term = searchQuery.toLowerCase();
                const matchesName = user.displayName?.toLowerCase().includes(term);
                const matchesEmail = user.email?.toLowerCase().includes(term);
                const matchesPhone = user.phone?.includes(term);
                if (!matchesName && !matchesEmail && !matchesPhone) return false;
            }

            return true;
        });
    }, [users, roleFilter, searchQuery]);


    // Handlers
    const handleEditUser = async (user: UnifiedUser) => {
        // Prepare local stats
        const namePart = user.displayName || '';
        const nameChunks = namePart.split(' ');
        
        setEditName(namePart);
        setEditPhone(user.phone || '');
        setEditRoles([...user.roles]);

        let pr = 'staff';
        if (user.roles.includes('super')) pr = 'super';
        else if (user.roles.includes('lokma_admin')) pr = 'lokma_admin';
        else if (user.roles.includes('business_admin')) pr = 'business_admin';
        else if (user.roles.includes('driver_business')) pr = 'staff';
        else if (user.roles.includes('driver_lokma')) pr = 'staff';
        
        setEditRole(pr);
        setSelectedUser(user);
        
        try {
            // First try fetching base user to extract address
            const userDoc = await getDoc(doc(db, 'users', user.id));
            if (userDoc.exists()) {
                const ud = userDoc.data();
                setEditFirstName(ud.firstName || nameChunks[0] || '');
                setEditLastName(ud.lastName || nameChunks.slice(1).join(' ') || '');
                setEditAddress(ud.addressDetails?.address || ud.address || '');
                setEditHouseNumber(ud.addressDetails?.houseNumber || ud.houseNumber || '');
                setEditAddressLine2(ud.addressDetails?.addressLine2 || ud.addressLine2 || '');
                setEditCity(ud.addressDetails?.city || ud.city || '');
                setEditPostalCode(ud.addressDetails?.postalCode || ud.postalCode || '');
                setEditCountry(ud.addressDetails?.country || ud.country || 'Almanya');
            } else {
                setEditFirstName(nameChunks[0] || '');
                setEditLastName(nameChunks.slice(1).join(' ') || '');
                setEditAddress('');
                setEditHouseNumber('');
                setEditAddressLine2('');
                setEditCity('');
                setEditPostalCode('');
                setEditCountry('Almanya');
            }

            const adminDoc = await getDoc(doc(db, 'admins', user.id));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                setIsDriver(data.isDriver === true || (data.roles && data.roles.includes('driver')) || false);
                setDriverType(data.driverType || 'platform');
                setSelectedBusinessIds(data.assignedBusinesses || []);
                setSelectedKermesIds(data.assignedKermesEvents || []);
                setEditSector(data.sector || data.businessType || '');
                setEditBusinessId(data.businessId || data.butcherId || '');
                setEditAssignments(data.assignments || []);
            } else {
                setIsDriver(user.roles.includes('driver'));
                setDriverType('platform');
                setSelectedBusinessIds([]);
                setSelectedKermesIds([]);
                setEditSector('');
                setEditBusinessId('');
                setEditAssignments([]);
            }
        } catch (e) {
            console.error("Error fetching user details", e);
        }
        setShowUserModal(true);
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        if (!confirm(t('eminMisinizKullaniciSil', { defaultValue: '🛑 DİKKAT: Bu kullanıcıyı (Auth, DB Profil vb. dahil) KALICI olarak silmek istediğinize emin misiniz?' }))) return;
        setSavingModal(true);
        try {
            // 1. Firebase Auth ve Firestore üzerinden sil (Backend API - Admin SDK)
            const resp = await fetch('/api/admin/delete-user', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ userId: selectedUser.id })
            });
            
            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error("API Silme Hatası: " + errText);
            }
            
            // 2. Tedbiren Local Firestore Silme İşlemleri (Admin panelinde olduğumuz için client kuralları müsaade etmeyebilir ama API zaten siliyor)
            await deleteDoc(doc(db, 'users', selectedUser.id)).catch(()=>null);
            await deleteDoc(doc(db, 'admins', selectedUser.id)).catch(()=>null);
            await deleteDoc(doc(db, 'user_profiles', selectedUser.id)).catch(()=>null);
            
            setShowUserModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert(t('silmeHatasi', { defaultValue: 'Silme hatası: ' }) + err);
        } finally {
            setSavingModal(false);
        }
    }

    const handleCreateUser = async () => {
        const hasEmail = Boolean(newUserData.email?.trim());
        const hasPhone = Boolean(newUserData.phone?.trim());

        if (!newUserData.firstName || !newUserData.lastName || (!hasEmail && !hasPhone) || !newUserData.password || !newUserData.role) {
            alert(t('zorunlu_alanlari_doldurun') || "Lütfen tüm zorunlu alanları doldurun (Ad, Soyad, E-Posta veya Telefon, Şifre, Rol)");
            return;
        }

        setAddingUser(true);
        try {
            let assignedBusinessName;
            if (newUserData.businessId) {
                const b = businesses.find(bz => bz.id === newUserData.businessId);
                const k = kermesEvents.find(ke => ke.id === newUserData.businessId);
                if (b) assignedBusinessName = b.name;
                else if (k) assignedBusinessName = k.name;
            }

            const payload = {
                email: newUserData.email,
                password: newUserData.password,
                displayName: `${newUserData.firstName} ${newUserData.lastName}`,
                phone: `${newUserData.dialCode}${newUserData.phone}`,
                role: newUserData.role !== 'user' ? 'admin' : 'user',
                adminType: newUserData.role !== 'user' ? newUserData.role : undefined,
                location: `${newUserData.address || ''} ${newUserData.houseNumber || ''}, ${newUserData.city || ''}, ${newUserData.country || ''}`.trim(),
                butcherId: newUserData.businessId || undefined,
                butcherName: assignedBusinessName || undefined,
                createdBy: admin?.email || admin?.id,
                createdBySource: admin?.adminType === 'super' ? 'super_admin' : 'business_admin',
                assignerName: admin?.displayName || admin?.firstName ? `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim() : 'Admin',
                assignerEmail: admin?.email || '',
                assignerPhone: admin?.phone || '',
                assignerRole: admin?.adminType || 'admin',
                firstName: newUserData.firstName,
                lastName: newUserData.lastName,
                addressDetails: {
                    address: newUserData.address,
                    houseNumber: newUserData.houseNumber,
                    addressLine2: newUserData.addressLine2,
                    city: newUserData.city,
                    postalCode: newUserData.postalCode,
                    country: newUserData.country,
                },
                sector: (() => {
                    const b = businesses.find(bz => bz.id === newUserData.businessId);
                    const k = kermesEvents.find(ke => ke.id === newUserData.businessId);
                    if (b) return (b as any).type || '';
                    if (k) return 'kermes';
                    return '';
                })(),
                isDriver: newUserIsDriver,
                driverType: newUserDriverType,
                assignedBusinesses: newUserSelectedBusinessIds,
                assignedKermesEvents: newUserSelectedKermesIds,
                assignments: newUserAssignments,
                businessId: newUserData.businessId || undefined,
                butcherId: newUserData.businessId || undefined,
            };

            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                alert(`${t('hata', { defaultValue: 'Hata' })}: ${data.error || t('bilinmeyenHata', { defaultValue: 'Bilinmeyen hata' })}`);
                setAddingUser(false);
                return;
            }

            let successMsg = "✅ Kullanıcı başarıyla oluşturuldu.";
            if (data.notifications) {
                const { email, whatsapp, sms } = data.notifications;
                if (!email?.sent && email?.address) {
                    successMsg += `\n⚠️ E-posta GÖNDERİLEMEDİ: ${email.error || 'Bilinmeyen hata'}`;
                }
                if (!whatsapp?.sent && whatsapp?.address) {
                    successMsg += `\n⚠️ WhatsApp GÖNDERİLEMEDİ: ${whatsapp.error || 'Bilinmeyen hata'}`;
                }
                if (!sms?.sent && sms?.address) {
                    successMsg += `\n⚠️ SMS GÖNDERİLEMEDİ: ${sms.error || 'Bilinmeyen hata'}`;
                }
            }
            alert(successMsg);
            setShowAddUserModal(false);
            setNewUserData({
                firstName: '', lastName: '', email: '', phone: '', dialCode: '+49',
                address: '', houseNumber: '', addressLine2: '', city: '', postalCode: '',
                country: 'Almanya', role: 'staff', sector: '', password: '', businessId: ''
            });
            setNewUserIsDriver(false);
            setNewUserDriverType('platform');
            setNewUserSelectedBusinessIds([]);
            setNewUserSelectedKermesIds([]);
            setNewUserAssignments([]);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Kullanıcı eklenirken sistemsel bir hata oluştu.");
        } finally {
            setAddingUser(false);
        }
    };

    const handleSaveUser = async () => {
        if (!selectedUser) return;
        setSavingModal(true);
        try {
            let finalRoles = [...editRoles];
            if (isDriver && !finalRoles.includes('driver')) finalRoles.push('driver');
            if (!isDriver) finalRoles = finalRoles.filter(r => r !== 'driver');
            
            const assignedBusinessNames = businesses.filter(b => selectedBusinessIds.includes(b.id)).map(b => b.name);
            const assignedKermesNames = kermesEvents.filter(k => selectedKermesIds.includes(k.id)).map(k => k.name);
            
            let currentAdminType = editRole !== 'customer' && editRole !== 'user' ? editRole : null;
            
            const updatePayload = {
                userId: selectedUser.id,
                email: selectedUser.email,
                firstName: editFirstName,
                lastName: editLastName,
                displayName: `${editFirstName} ${editLastName}`.trim() || editName,
                phoneNumber: editPhone,
                address: editAddress,
                houseNumber: editHouseNumber,
                addressLine2: editAddressLine2,
                postalCode: editPostalCode,
                city: editCity,
                country: editCountry,
                roles: finalRoles,
                isAdmin: currentAdminType !== null,
                adminType: currentAdminType,
                sector: editSector,
                butcherId: editBusinessId || undefined,
                butcherName: undefined as string | undefined, // Fixed by logic below
                isDriver: isDriver,
                driverType: isDriver ? (selectedBusinessIds.length > 0 ? 'business' : 'platform') : null,
                assignedBusinesses: isDriver ? selectedBusinessIds : [],
                assignedBusinessNames: isDriver ? assignedBusinessNames : [],
                assignedKermesEvents: isDriver ? selectedKermesIds : [],
                assignedKermesNames: isDriver ? assignedKermesNames : [],
                adminEmail: admin?.email,
                assignments: editAssignments,
            };

            if (editBusinessId) {
                const b = businesses.find(bz => bz.id === editBusinessId);
                const k = kermesEvents.find(ke => ke.id === editBusinessId);
                if (b) updatePayload.butcherName = b.name;
                else if (k) updatePayload.butcherName = k.name;
            }

            const response = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updateData: updatePayload })
            });

            if (!response.ok) {
                const data = await response.json();
                alert(`Hata: ${data.error || 'Bilinmeyen Hata'}`);
                setSavingModal(false);
                return;
            }

            setShowUserModal(false);
            fetchData(); // reload
        } catch (error) {
            console.error('Error updating user', error);
            alert("Fehler beim Speichern: " + String(error));
        } finally {
            setSavingModal(false);
        }
    };

    const getRoleBadgeInfo = (role: string) => {
        switch (role) {
            case 'super': return { bg: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', label: 'Super Admin' };
            case 'lokma_admin': return { bg: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400', label: 'Lokma Partner' };
            case 'kermes_admin': return { bg: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400', label: 'Kermes Admin' };
            case 'driver': return { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', label: 'Sürücü (Fahrer)' };
            case 'staff': return { bg: 'bg-gray-100 text-gray-700 dark:bg-gray-500/30 dark:text-gray-300', label: 'Personel (Staff)' };
            case 'customer': return { bg: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', label: 'Müşteri (Kunde)' };
            default: return { bg: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', label: 'Bilinmiyor' };
        }
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (!admin) return null;

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            <div className="max-w-7xl mx-auto px-4 py-8">
                
                {/* Header & Quick Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Benutzerverwaltung</h1>
                        <p className="text-muted-foreground mt-1">
                            {isSuperAdmin 
                                ? 'Tüm kullanıcıları, personeli ve iş ortaklarını "C-Level" RBAC görünümü ile yönetin.'
                                : 'Size bağlı personelleri ve sürücüleri bu listeden yönetebilirsiniz.'}
                        </p>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="bg-pink-600 hover:bg-pink-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-pink-600/20 transition-all flex items-center gap-2"
                        >
                            <span>+ Benutzer hinzufügen</span>
                            <span className="text-xs">▼</span>
                        </button>

                        {showAddMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl py-2 z-50">
                                {isSuperAdmin && (
                                    <>
                                        <button onClick={() => { setShowAddUserModal(true); setNewUserData(prev => ({...prev, role: 'super'})); setShowAddMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition">👑 Super Admin Ekle</button>
                                        <button onClick={() => { setShowAddUserModal(true); setNewUserData(prev => ({...prev, role: 'business_admin'})); setShowAddMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition">🏪 İşletme / Kermes Partneri Ekle</button>
                                    </>
                                )}
                                <button onClick={() => { setShowAddUserModal(true); setNewUserData(prev => ({...prev, role: 'staff'})); setShowAddMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition">👥 Personel / Sürücü Ekle</button>

                            </div>
                        )}
                    </div>
                </div>

                {/* Filters & Search Bar */}
                <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-sm flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Name, E-Mail oder Telefon suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background text-foreground border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                        />
                    </div>

                    <div className="flex-shrink-0 flex items-center flex-wrap gap-2">
                        <FilterPill active={roleFilter === 'all'} label="Tümü" count={users.length} onClick={() => setRoleFilter('all')} />
                        
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'customer'} label="Kunden" count={users.filter(u => u.roles.includes('customer')).length} onClick={() => setRoleFilter('customer')} />
                        )}
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'lokma_admin'} label="Partner" count={users.filter(u => u.roles.includes('lokma_admin')).length} onClick={() => setRoleFilter('lokma_admin')} />
                        )}
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'kermes_admin'} label="Kermes" count={users.filter(u => u.roles.includes('kermes_admin')).length} onClick={() => setRoleFilter('kermes_admin')} />
                        )}

                        <FilterPill active={roleFilter === 'driver'} label="Fahrer" count={users.filter(u => u.roles.includes('driver')).length} onClick={() => setRoleFilter('driver')} />
                        <FilterPill active={roleFilter === 'staff'} label="Personal" count={users.filter(u => u.roles.includes('staff')).length} onClick={() => setRoleFilter('staff')} />
                        
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'super'} label="Super Admins" count={users.filter(u => u.roles.includes('super')).length} onClick={() => setRoleFilter('super')} />
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Benutzer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontakt</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rolle (RBAC)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
                                                <p>Kullanıcılar yükleniyor...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="text-4xl mb-3">👻</div>
                                            <p>Suche ergab keine Treffer.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => {
                                        return (
                                            <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                                                {/* User Identity Column */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border">
                                                            {user.photoURL ? (
                                                                <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-muted-foreground font-medium text-sm">
                                                                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-foreground">{user.displayName}</div>
                                                            <div className="text-xs text-muted-foreground font-mono">ID: {user.id.slice(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Contact Details */}
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-foreground/80">{user.email || '—'}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">{user.phone || '—'}</div>
                                                </td>

                                                {/* RBAC Role Tag */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1.5 items-start max-w-[200px]">
                                                        {user.roles.map(r => {
                                                            const roleInfo = getRoleBadgeInfo(r);
                                                            return (
                                                                <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleInfo.bg} border border-current/20`}>
                                                                    {roleInfo.label}
                                                                </span>
                                                            );
                                                        })}
                                                        {user.businessId && user.businessId !== 'NONE' && (
                                                            <span className="text-[10px] w-full text-muted-foreground flex items-center gap-1 mt-1">
                                                                🏪 Lokma #{user.businessId.slice(0,4)}
                                                            </span>
                                                        )}
                                                        {user.kermesId && user.kermesId !== 'NONE' && (
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                🎪 Kermes #{user.kermesId.slice(0,4)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Status Tag */}
                                                <td className="px-6 py-4">
                                                    {user.displayName.startsWith('📧') ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-500 dark:border-orange-500/20">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                                            Davet Bekleniyor
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.isActive ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20'}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                            {user.isActive ? 'Aktiv' : 'Inaktiv'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleEditUser(user)}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 bg-background hover:bg-muted border border-border text-sm font-medium rounded-lg transition-colors text-foreground"
                                                    >
                                                        Details ➔
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {!loading && filteredUsers.length > 0 && (
                        <div className="border-t border-border px-6 py-4 flex items-center justify-between text-sm text-muted-foreground bg-muted/20">
                            <div>Toplam <b>{filteredUsers.length}</b> kullanıcı listelendi (Filtre: {roleFilter.toUpperCase()})</div>
                            {isSuperAdmin && roleFilter === 'customer' && (
                                <div className="text-xs text-yellow-600 dark:text-yellow-500/80">
                                    💡 Performans için son 500 müşteri gösterilmektedir.
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>

            {/* Modal for Edit Actions */}
            {showUserModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 md:p-12" onClick={() => setShowUserModal(false)}>
                    <div className="bg-card w-full max-w-2xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden border border-border shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border border-border">
                                    {selectedUser.photoURL ? (
                                        <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center font-bold text-xl text-muted-foreground">
                                            {selectedUser.displayName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{selectedUser.displayName}</h2>
                                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowUserModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Kişisel Bilgiler</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('adi') || 'Adı'} *</label>
                                        <input
                                            type="text"
                                            value={editFirstName}
                                            onChange={(e) => setEditFirstName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('soyadi') || 'Soyadı'} *</label>
                                        <input
                                            type="text"
                                            value={editLastName}
                                            onChange={(e) => setEditLastName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('e_posta') || 'E-Posta'}</label>
                                    <input
                                        type="email"
                                        readOnly
                                        disabled
                                        value={selectedUser.email}
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground opacity-70"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">E-posta adresi güvenlik nedeniyle değiştirilemez.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('telefon') || 'Telefon'}</label>
                                    <input
                                        type="tel"
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        placeholder="+49 177 1234567"
                                    />
                                </div>
                            </div>

                            <hr className="border-border" />

                            {/* Address Info */}
                            <div className="space-y-3">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('adres_bilgileri') || 'Adres Bilgileri'}</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sokak') || 'Sokak'}</label>
                                        <input
                                            type="text"
                                            value={editAddress}
                                            onChange={(e) => setEditAddress(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('bina_no') || 'Bina No'}</label>
                                        <input
                                            type="text"
                                            value={editHouseNumber}
                                            onChange={(e) => setEditHouseNumber(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">{t('adres_satiri_2_daire_kat_vb') || 'Adres Satırı 2 (Daire, Kat vb.)'}</label>
                                    <input
                                        type="text"
                                        value={editAddressLine2}
                                        onChange={(e) => setEditAddressLine2(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('posta_kodu') || 'Posta Kodu'}</label>
                                        <input
                                            type="text"
                                            value={editPostalCode}
                                            onChange={(e) => setEditPostalCode(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sehir') || 'Şehir'}</label>
                                        <input
                                            type="text"
                                            value={editCity}
                                            onChange={(e) => setEditCity(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('ulke') || 'Ülke'}</label>
                                        <input
                                            type="text"
                                            value={editCountry}
                                            onChange={(e) => setEditCountry(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <hr className="border-border" />

                            {/* Job Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('rol') || 'Yetki ve Bağlantılar'}</h3>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('rol') || 'Rol'} *</label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => { setEditRole(e.target.value); setEditBusinessId(''); }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        disabled={!isSuperAdmin && editRole === 'super'}
                                    >
                                        {isSuperAdmin && <option value="super">{t('super_admin') || 'Super Admin'}</option>}
                                        <option value="staff">{t('personel') || 'Personel'}</option>
                                        <option value="business_admin">{t('i_sletme_admin') || 'İşletme Admin (Lokma/Kermes vb.)'}</option>
                                    </select>
                                </div>

                                {(editRole === 'staff' || editRole === 'business_admin') && isSuperAdmin && (
                                    <WorkspaceAssignmentsList
                                        assignments={editAssignments}
                                        onChange={setEditAssignments}
                                        businesses={businesses}
                                        kermesEvents={kermesEvents}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                )}
                            </div>

                            {selectedUser.roles?.includes('staff') && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-xl p-4 mt-6 mb-6">
                                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 truncate">
                                        💼 Personel Vardiya Bilgileri
                                    </h3>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mb-4 leading-relaxed">
                                        Bu personel için sisteme kayıtlı tüm mesai (vardiya) kayıtlarını ve detaylı çalışma saatlerini "Personel Vardiya Takibi" ekranından görüntüleyebilirsiniz.
                                    </p>
                                    <Link 
                                        href={`/admin/staff-shifts?staffId=${selectedUser.id}`}
                                        className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-4 py-3 transition shadow-sm"
                                        onClick={() => setShowUserModal(false)}
                                    >
                                        Çalışma Saatleri & Vardiyaları Gör ➔
                                    </Link>
                                </div>
                            )}

                            <hr className="border-border" />

                            {/* Driver Privileges Toggle Block */}
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-2">🚗 Sürücü Yönetimi (Fahrerverwaltung)</h3>
                                <p className="text-sm text-muted-foreground mb-4">Bu kullanıcının sistemde "Sürücü" (Driver) olarak görev yapıp yapamayacağını belirleyin.</p>
                                
                                <label className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition">
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={isDriver}
                                            onChange={(e) => setIsDriver(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground">Sürücü Yetkisine Sahip (Aktif Sürücü)</span>
                                </label>
                            </div>

                            {/* Businesses Assignment Block if isDriver is true */}
                            {isDriver && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 mt-2">
                                    {/* Sürücü tipi artık Atanan İşletmelerin varlığına göre kaydedilir. (İşletme varsa İşletme Sürücüsü, yoksa LOKMA Sürücüsü) */}

                                    {/* Atanan İşletmeler */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm text-foreground">Atanan İşletmeler (Zugeordnete Betriebe)</h4>
                                            <span className="text-xs text-muted-foreground">{selectedBusinessIds.length} Seçili</span>
                                        </div>
                                        <input 
                                            type="text"
                                            placeholder="İşletme ara (İsim, Şehir, Posta Kodu)..."
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 transition outline-none"
                                            value={businessSearch}
                                            onChange={(e) => setBusinessSearch(e.target.value)}
                                        />
                                        
                                        <div className="border border-border rounded-xl max-h-48 overflow-y-auto bg-background">
                                            {businesses
                                                .filter(biz => {
                                                    const searchTerms = businessSearch.toLowerCase().split(' ').filter(Boolean);
                                                    if (searchTerms.length === 0) return true;
                                                    const fullText = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''} ${biz.address || ''} ${biz.street || ''}`.toLowerCase();
                                                    return searchTerms.every(term => fullText.includes(term));
                                                })
                                                .map(b => (
                                                <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 border-b border-border last:border-0 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                                                        checked={selectedBusinessIds.includes(b.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedBusinessIds(prev => [...prev, b.id]);
                                                            else setSelectedBusinessIds(prev => prev.filter(id => id !== b.id));
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                                            {b.name}
                                                            {b.type === 'lokma' && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">Lokma</span>}
                                                            {b.type === 'kermes' && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">Kermes</span>}
                                                        </div>
                                                        {(b.plz || b.city) && <div className="text-[11px] text-muted-foreground mt-0.5">{b.plz} {b.city}</div>}
                                                    </div>
                                                </label>
                                            ))}
                                            {businesses.length > 0 && businesses.filter(biz => {
                                                    const searchTerms = businessSearch.toLowerCase().split(' ').filter(Boolean);
                                                    if (searchTerms.length === 0) return true;
                                                    const fullText = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''} ${biz.address || ''} ${biz.street || ''}`.toLowerCase();
                                                    return searchTerms.every(term => fullText.includes(term));
                                            }).length === 0 && (
                                                <div className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</div>
                                            )}
                                        </div>
                                        {selectedBusinessIds.length === 0 && (
                                            <p className="text-xs text-amber-600 dark:text-amber-500">⚠️ İşletme seçilmezse sürücü hiçbir siparişi göremeyecek.</p>
                                        )}
                                    </div>

                                    {/* Atanan Kermesler */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm text-foreground">Atanan Kermesler</h4>
                                            <span className="text-xs text-muted-foreground">{selectedKermesIds.length} Seçili</span>
                                        </div>
                                        <input 
                                            type="text"
                                            placeholder="Kermes ara (İsim, Dernek, Şehir, Posta Kodu)..."
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 transition outline-none"
                                            value={kermesSearch}
                                            onChange={(e) => setKermesSearch(e.target.value)}
                                        />
                                        
                                        <div className="border border-border rounded-xl max-h-48 overflow-y-auto bg-background">
                                            {kermesEvents
                                                .filter(k => {
                                                    const searchTerms = kermesSearch.toLowerCase().split(' ').filter(Boolean);
                                                    if (searchTerms.length === 0) return true;
                                                    const fullText = `${k.name || ''} ${k.dernekIsmi || ''} ${k.plz || ''} ${k.city || ''} ${k.address || ''} ${k.street || ''}`.toLowerCase();
                                                    return searchTerms.every(term => fullText.includes(term));
                                                })
                                                .map(k => (
                                                <label key={k.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 border-b border-border last:border-0 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                                                        checked={selectedKermesIds.includes(k.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedKermesIds(prev => [...prev, k.id]);
                                                            else setSelectedKermesIds(prev => prev.filter(id => id !== k.id));
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-foreground">{k.name}</div>
                                                        {(k.plz || k.city) && <div className="text-[11px] text-muted-foreground mt-0.5">{k.plz} {k.city}</div>}
                                                    </div>
                                                </label>
                                            ))}
                                            {kermesEvents.length > 0 && kermesEvents.filter(k => {
                                                    const searchTerms = kermesSearch.toLowerCase().split(' ').filter(Boolean);
                                                    if (searchTerms.length === 0) return true;
                                                    const fullText = `${k.name || ''} ${k.dernekIsmi || ''} ${k.plz || ''} ${k.city || ''} ${k.address || ''} ${k.street || ''}`.toLowerCase();
                                                    return searchTerms.every(term => fullText.includes(term));
                                            }).length === 0 && (
                                                <div className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-muted/20 flex flex-col gap-3">
                            {isSuperAdmin && (
                                <button 
                                    onClick={handleDeleteUser}
                                    className="w-full py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 font-medium rounded-xl transition text-sm flex justify-center items-center"
                                    disabled={savingModal}
                                >
                                    🗑️ Bu Kullanıcıyı Kalıcı Olarak Sil
                                </button>
                            )}
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowUserModal(false)}
                                    className="flex-1 py-2.5 bg-background border border-border text-foreground hover:bg-muted font-medium rounded-xl transition"
                                    disabled={savingModal}
                                >
                                    İptal
                                </button>
                                <button 
                                    onClick={handleSaveUser}
                                    className="flex-[2] py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-xl transition flex justify-center items-center"
                                    disabled={savingModal}
                                >
                                    {savingModal ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        "Tüm Değişiklikleri Kaydet"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Modal for Add User Actions */}
            {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 md:p-12" onClick={() => setShowAddUserModal(false)}>
                    <div className="bg-card w-full max-w-2xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden border border-border shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20 rounded-t-2xl">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                    {t('yeni_kullanici_ekle') || "Yeni Kullanıcı Ekle"}
                                </h2>
                                <p className="text-sm text-muted-foreground">Platforma anında yetkili hesabı oluşturun</p>
                            </div>
                            <button onClick={() => setShowAddUserModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Kişisel Bilgiler</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('adi') || 'Adı'} *</label>
                                        <input
                                            type="text"
                                            value={newUserData.firstName}
                                            onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                            placeholder="John"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('soyadi') || 'Soyadı'} *</label>
                                        <input
                                            type="text"
                                            value={newUserData.lastName}
                                            onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('e_posta') || 'E-Posta'} *</label>
                                    <input
                                        type="email"
                                        value={newUserData.email}
                                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        placeholder="ornek@email.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('telefon') || 'Telefon'}</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={newUserData.dialCode}
                                            onChange={(e) => setNewUserData({ ...newUserData, dialCode: e.target.value })}
                                            className="w-24 px-2 py-2 bg-background border border-border rounded-lg text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        >
                                            {COUNTRY_CODES.map((cc) => (
                                                <option key={cc.code} value={cc.dial}>{cc.flag} {cc.dial}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="tel"
                                            value={newUserData.phone}
                                            onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                                            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                            placeholder="1771234567"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-border" />

                            {/* Address Info */}
                            <div className="space-y-3">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('adres_bilgileri') || 'Adres Bilgileri'}</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sokak') || 'Sokak'}</label>
                                        <input
                                            type="text"
                                            value={newUserData.address}
                                            onChange={(e) => setNewUserData({ ...newUserData, address: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                            placeholder="Ana Sokak"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('bina_no') || 'Bina No'}</label>
                                        <input
                                            type="text"
                                            value={newUserData.houseNumber}
                                            onChange={(e) => setNewUserData({ ...newUserData, houseNumber: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                            placeholder="12a"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">{t('adres_satiri_2_daire_kat_vb') || 'Adres Satırı 2 (Daire, Kat vb.)'}</label>
                                    <input
                                        type="text"
                                        value={newUserData.addressLine2}
                                        onChange={(e) => setNewUserData({ ...newUserData, addressLine2: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        placeholder="2. Kat, Daire 5"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('posta_kodu') || 'Posta Kodu'}</label>
                                        <input
                                            type="text"
                                            value={newUserData.postalCode}
                                            onChange={(e) => setNewUserData({ ...newUserData, postalCode: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                            placeholder="12345"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sehir') || 'Şehir'}</label>
                                        <input
                                            type="text"
                                            value={newUserData.city}
                                            onChange={(e) => setNewUserData({ ...newUserData, city: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                            placeholder="Berlin"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('ulke') || 'Ülke'}</label>
                                        <input
                                            type="text"
                                            value={newUserData.country}
                                            onChange={(e) => setNewUserData({ ...newUserData, country: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                            placeholder="Almanya"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-border" />

                            {/* Job Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('rol') || 'Yetki ve Bağlantılar'}</h3>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('rol') || 'Rol'} *</label>
                                    <select
                                        value={newUserData.role}
                                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value, businessId: '' })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        disabled={!isSuperAdmin && newUserData.role === 'super'}
                                    >
                                        {isSuperAdmin && <option value="super">{t('super_admin') || 'Super Admin'}</option>}
                                        <option value="staff">{t('personel') || 'Personel'}</option>
                                        <option value="business_admin">{t('i_sletme_admin') || 'İşletme Admin (Lokma/Kermes vb.)'}</option>
                                    </select>
                                </div>

                                {(newUserData.role === 'staff' || newUserData.role === 'business_admin') && isSuperAdmin && (
                                    <WorkspaceAssignmentsList
                                        assignments={newUserAssignments}
                                        onChange={setNewUserAssignments}
                                        businesses={businesses}
                                        kermesEvents={kermesEvents}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                )}

                                {/* Driver Assignment Block for Add User */}
                                <div className="pt-2">
                                    <label className="flex items-center gap-3 cursor-pointer mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="relative">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={newUserIsDriver}
                                                onChange={(e) => setNewUserIsDriver(e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
                                        </div>
                                        <span className="text-sm font-semibold text-foreground">Sürücü Yetkisine Sahip (Aktif Sürücü)</span>
                                    </label>
                                </div>

                                {/* Businesses Assignment Block if newUserIsDriver is true */}
                                {newUserIsDriver && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 mt-2">
                                        {/* Atanan İşletmeler */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-sm text-foreground">Atanan İşletmeler (Zugeordnete Betriebe)</h4>
                                                <span className="text-xs text-muted-foreground">{newUserSelectedBusinessIds.length} Seçili</span>
                                            </div>
                                            <input 
                                                type="text"
                                                placeholder="İşletme ara (İsim, Şehir, Posta Kodu)..."
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 transition outline-none"
                                                value={businessSearch}
                                                onChange={(e) => setBusinessSearch(e.target.value)}
                                            />
                                            
                                            <div className="border border-border rounded-xl max-h-48 overflow-y-auto bg-background">
                                                {businesses
                                                    .filter(biz => {
                                                        const searchTerms = businessSearch.toLowerCase().split(' ').filter(Boolean);
                                                        if (searchTerms.length === 0) return true;
                                                        const fullText = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''} ${biz.address || ''} ${biz.street || ''}`.toLowerCase();
                                                        return searchTerms.every(term => fullText.includes(term));
                                                    })
                                                    .map(b => (
                                                    <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 border-b border-border last:border-0 cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                                                            checked={newUserSelectedBusinessIds.includes(b.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setNewUserSelectedBusinessIds(prev => [...prev, b.id]);
                                                                else setNewUserSelectedBusinessIds(prev => prev.filter(id => id !== b.id));
                                                            }}
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                                                {b.name}
                                                                {b.type === 'lokma' && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">Lokma</span>}
                                                                {b.type === 'kermes' && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">Kermes</span>}
                                                            </div>
                                                            {(b.plz || b.city) && <div className="text-[11px] text-muted-foreground mt-0.5">{b.plz} {b.city}</div>}
                                                        </div>
                                                    </label>
                                                ))}
                                                {businesses.length > 0 && businesses.filter(biz => {
                                                        const searchTerms = businessSearch.toLowerCase().split(' ').filter(Boolean);
                                                        if (searchTerms.length === 0) return true;
                                                        const fullText = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''} ${biz.address || ''} ${biz.street || ''}`.toLowerCase();
                                                        return searchTerms.every(term => fullText.includes(term));
                                                }).length === 0 && (
                                                    <div className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</div>
                                                )}
                                            </div>
                                            {newUserSelectedBusinessIds.length === 0 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-500">⚠️ İşletme seçilmezse sürücü hiçbir siparişi göremeyecek.</p>
                                            )}
                                        </div>

                                        {/* Atanan Kermesler */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-sm text-foreground">Atanan Kermesler</h4>
                                                <span className="text-xs text-muted-foreground">{newUserSelectedKermesIds.length} Seçili</span>
                                            </div>
                                            <input 
                                                type="text"
                                                placeholder="Kermes ara (İsim, Dernek, Şehir, Posta Kodu)..."
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 transition outline-none"
                                                value={kermesSearch}
                                                onChange={(e) => setKermesSearch(e.target.value)}
                                            />
                                            
                                            <div className="border border-border rounded-xl max-h-48 overflow-y-auto bg-background">
                                                {kermesEvents
                                                    .filter(k => {
                                                        const searchTerms = kermesSearch.toLowerCase().split(' ').filter(Boolean);
                                                        if (searchTerms.length === 0) return true;
                                                        const fullText = `${k.name || ''} ${(k as any).dernekIsmi || ''} ${k.plz || ''} ${k.city || ''} ${k.address || ''} ${k.street || ''}`.toLowerCase();
                                                        return searchTerms.every(term => fullText.includes(term));
                                                    })
                                                    .map(k => (
                                                    <label key={k.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 border-b border-border last:border-0 cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                                                            checked={newUserSelectedKermesIds.includes(k.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setNewUserSelectedKermesIds(prev => [...prev, k.id]);
                                                                else setNewUserSelectedKermesIds(prev => prev.filter(id => id !== k.id));
                                                            }}
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                                                {k.name}
                                                            </div>
                                                            {(k.plz || k.city || (k as any).dernekIsmi) && (
                                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                                    {[k.name !== (k as any).dernekIsmi ? (k as any).dernekIsmi : null, k.plz, k.city].filter(Boolean).join(' • ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))}
                                                {kermesEvents.length > 0 && kermesEvents.filter(k => {
                                                        const searchTerms = kermesSearch.toLowerCase().split(' ').filter(Boolean);
                                                        if (searchTerms.length === 0) return true;
                                                        const fullText = `${k.name || ''} ${(k as any).dernekIsmi || ''} ${k.plz || ''} ${k.city || ''} ${k.address || ''} ${k.street || ''}`.toLowerCase();
                                                        return searchTerms.every(term => fullText.includes(term));
                                                }).length === 0 && (
                                                    <div className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-border" />

                            {/* Password Setup */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('gecici_sifre') || 'Geçici Şifre'} *</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newUserData.password}
                                            onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                            placeholder="En az 6 karakter"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
                                                let pw = '';
                                                for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
                                                setNewUserData({ ...newUserData, password: pw });
                                            }}
                                            className="px-4 py-2 bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 font-medium rounded-lg whitespace-nowrap hover:bg-pink-200 dark:hover:bg-pink-500/30 transition shadow-sm"
                                        >
                                            ✨ {t('guclu_sifre_olustur') || 'Güçlü Şifre Oluştur'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">{t('kullanici_ilk_giriste_sifresini_degistir') || 'Kullanıcı ilk girişte şifresini değiştirmelidir.'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-muted/20 flex gap-3">
                            <button 
                                onClick={() => setShowAddUserModal(false)}
                                className="flex-1 py-2.5 bg-background border border-border text-foreground hover:bg-muted font-medium rounded-xl transition"
                                disabled={addingUser}
                            >
                                {t('iptal') || 'İptal'}
                            </button>
                            <button 
                                onClick={handleCreateUser}
                                className="flex-[2] py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-xl transition flex justify-center items-center shadow-lg shadow-pink-600/20"
                                disabled={addingUser}
                            >
                                {addingUser ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    "Kullanıcı Oluştur"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Filter Component
function FilterPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border flex items-center gap-1.5
                ${active 
                    ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/20' 
                    : 'bg-background border-border text-foreground hover:bg-muted'}
            `}
        >
            <span>{label}</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                {count}
            </span>
        </button>
    );
}
