'use client';

import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, startAt, endAt, DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Admin, AdminType } from '@/types';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { getModuleBusinessTypes, SPECIAL_MODULES, getAllRoles, getBusinessType, getRoleLabel, getRoleIcon } from '@/lib/business-types';
import { COUNTRY_CODES, getDialCode } from '@/lib/country-codes';
import ConfirmModal from '@/components/ui/ConfirmModal';



// Dinamik rol listesi - business-types.ts'den getAllRoles() kullanılıyor
// deprecated: adminTypeLabels - artık hardcoded değil

interface FirebaseUser {
    id: string;
    email: string;
    displayName: string;
    phoneNumber?: string;
    createdAt?: string;
    isAdmin?: boolean;
    adminType?: AdminType;
    location?: string;
    address?: string;
    houseNumber?: string;
    addressLine2?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    photoURL?: string;
    adminProfile?: Admin; // Full admin profile if available
}

export default function SuperAdminDashboard() {
    const { admin, loading: adminLoading } = useAdmin(); // Use admin from context
    // const [loading, setLoading] = useState(true); // Removed local loading
    const [activeTab, setActiveTab] = useState<'admins' | 'users'>('users');
    const [adminFilter, setAdminFilter] = useState<'all' | 'business' | 'staff' | 'super'>('all');
    const [adminStatusFilter, setAdminStatusFilter] = useState<'active' | 'archived'>('active');

    // Admin state
    const [admins, setAdmins] = useState<Admin[]>([]);

    // User search state
    const [users, setUsers] = useState<FirebaseUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [lastDoc, setLastDoc] = useState<DocumentData | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Show all users mode - enabled by default
    const [showAllUsers, setShowAllUsers] = useState(true);
    const [allUsersPage, setAllUsersPage] = useState(1);
    const [allUsersSortBy, setAllUsersSortBy] = useState<'createdAt' | 'firstName' | 'lastName'>('createdAt');
    const [allUsersSortOrder, setAllUsersSortOrder] = useState<'asc' | 'desc'>('desc');
    const [allUsersTotal, setAllUsersTotal] = useState(0);
    const [allUsersLoading, setAllUsersLoading] = useState(false);
    const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'user' | 'admin' | 'staff' | 'super' | 'driver' | 'driver_lokma' | 'driver_business'>('all');
    const [userStatusFilter, setUserStatusFilter] = useState<'active' | 'archived'>('active');
    const USERS_PER_PAGE = 10;

    // Role assignment modal
    const [selectedUser, setSelectedUser] = useState<FirebaseUser | null>(null);
    const [assignRole, setAssignRole] = useState<AdminType>('kermes');
    const [assignLocation, setAssignLocation] = useState('');
    const [assigning, setAssigning] = useState(false);

    // New user creation state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
    const [newUserPhone, setNewUserPhone] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<AdminType | 'user'>('user');
    const [newUserLocation, setNewUserLocation] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // Butcher selection for kasap admin - includes types for sector filtering
    const [butcherList, setButcherList] = useState<{ id: string, name: string, city: string, country: string, postalCode: string, types: string[] }[]>([]);
    const [selectedButcherId, setSelectedButcherId] = useState('');
    const [loadingButchers, setLoadingButchers] = useState(false);
    // Business search filter for large lists
    const [businessSearchFilter, setBusinessSearchFilter] = useState('');

    // 🆕 ORGANIZASYON SEÇİMİ - Kermes Admin/Personel için
    const [organizationList, setOrganizationList] = useState<{ id: string, name: string, shortName: string, city: string, postalCode: string, type: string }[]>([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [organizationSearchFilter, setOrganizationSearchFilter] = useState('');

    // GPS / Geocoding State
    const [isGeocoding, setIsGeocoding] = useState(false);



    // Invitation share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [invitationLink, setInvitationLink] = useState('');
    const [invitationToken, setInvitationToken] = useState('');
    const [invitationPhone, setInvitationPhone] = useState('');
    const [invitationRole, setInvitationRole] = useState('');
    const [invitationBusiness, setInvitationBusiness] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);

    // Pending invitations state - Removed (Moved to AdminHeader)

    // Edit admin state
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [editRole, setEditRole] = useState<AdminType | 'user'>('kermes');
    const [editLocation, setEditLocation] = useState('');
    const [editButcherId, setEditButcherId] = useState('');
    const [editIsPrimaryAdmin, setEditIsPrimaryAdmin] = useState(false); // 🟣 Primary Admin toggle
    const [saving, setSaving] = useState(false);

    // 🆕 ROL EKLEME MODAL STATE
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [newRoleType, setNewRoleType] = useState<string>('');
    const [newRoleBusinessId, setNewRoleBusinessId] = useState('');
    const [newRoleBusinessName, setNewRoleBusinessName] = useState('');
    const [newRoleOrganizationId, setNewRoleOrganizationId] = useState('');
    const [newRoleOrganizationName, setNewRoleOrganizationName] = useState('');
    const [addingRole, setAddingRole] = useState(false);
    const [newRoleBusinessSearch, setNewRoleBusinessSearch] = useState(''); // 🆕 İşletme arama
    const [newRoleOrgSearch, setNewRoleOrgSearch] = useState(''); // 🆕 Organizasyon arama

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Delete confirmation modal state
    const [deleteModal, setDeleteModal] = useState<{ show: boolean; userId: string; userName: string } | null>(null);

    // ConfirmModal state
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        itemName?: string;
        variant?: 'warning' | 'danger';
        confirmText: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', confirmText: '', onConfirm: () => { } });

    // User profile edit modal state
    const [editingUserProfile, setEditingUserProfile] = useState<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        dialCode?: string;
        address: string;
        houseNumber?: string;
        addressLine2?: string;
        city: string;
        country: string;
        postalCode: string;
        latitude?: number;
        longitude?: number;
        photoURL?: string;
        isAdmin: boolean;
        adminType?: string;
        adminDocId?: string; // The actual document ID in admins collection
        originalAdminType?: string; // To track if role was changed
        butcherId?: string; // Required for non-super admin roles
        butcherName?: string; // Display name of assigned business
        organizationId?: string; // 🆕 Required for kermes roles
        organizationName?: string; // 🆕 Display name of assigned organization
        isActive?: boolean; // Soft deactivation - user exists but can't login
        isPrimaryAdmin?: boolean; // 🟣 Primary Admin / İşletme Sahibi flag
        isDriver?: boolean; // 🚗 Driver / Sürücü flag
        driverType?: 'lokma_fleet' | 'business'; // 🚚 Driver fleet type
        assignedTables?: number[]; // 🪑 Assigned tables for waiter
        // 🆕 ÇOKLU ROL DESTEĞİ
        roles?: {
            type: string;
            businessId?: string;
            businessName?: string;
            organizationId?: string;
            organizationName?: string;
            isPrimary: boolean;
            isActive: boolean;
            assignedAt: Date | any;
            assignedBy: string;
        }[];
    } | null>(null);
    const [maxTablesForBusiness, setMaxTablesForBusiness] = useState<number>(0); // 🪑 Total tables for the user's business
    const [savingProfile, setSavingProfile] = useState(false);

    // New user modal states
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [newUserData, setNewUserData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dialCode: '+49', // Default for Germany
        address: '',
        houseNumber: '',
        addressLine2: '',
        city: '',
        country: 'Almanya',
        postalCode: '',
        role: 'user' as 'user' | 'staff' | 'business_admin' | 'super' | 'driver_lokma' | 'driver_business',
        sector: '' as string,
        password: ''
    });
    const [creatingUser, setCreatingUser] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const router = useRouter();

    // Load initial data when admin is authenticated
    useEffect(() => {
        if (admin) {
            // Only load pending invitations initially (lightweight)
            // loadPendingInvitations() removed - Moved to AdminHeader
        }
    }, [admin]);

    // Handle URL search params for navigation from header chips (client-side only)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const filter = params.get('filter');
        const view = params.get('view');

        // Handle new view parameter for super admin panel
        if (view === 'customers') {
            // Show only customers (non-admin users) - for business admins, filtered by orders
            setActiveTab('users');
            setShowAllUsers(true);
            setUserTypeFilter('user'); // Filter to only regular users
            loadAllUsers(1);
        } else if (view === 'staff') {
            // Show this business's admins and staff (Personel chip)
            setActiveTab('admins');
            setAdminFilter('all'); // Show all admin types for this business
        } else if (view === 'admins') {
            // Show all admins and staff
            setActiveTab('admins');
            setAdminFilter('all'); // Show all admin types
        } else if (filter === 'users') {
            // Legacy: Show all users
            setActiveTab('users');
            setShowAllUsers(true);
            loadAllUsers(1);
        } else if (filter === 'admins') {
            // Show business admins only
            setActiveTab('admins');
            setAdminFilter('business');
        } else if (filter === 'subadmins') {
            // Show staff/sub admins only
            setActiveTab('admins');
            setAdminFilter('staff');
        } else if (filter === 'superadmins') {
            // Show super admins only
            setActiveTab('admins');
            setAdminFilter('super');
        }
    }, []);

    // 🔐 SECURITY: Reusable function to reload admins with proper business isolation
    // This MUST be used instead of raw getDocs(collection(db, 'admins')) to prevent data leaks
    const reloadAdmins = useCallback(async () => {
        if (!admin) return;

        try {
            let adminsData: Admin[] = [];

            if (admin.adminType === 'super') {
                // Super admin sees ALL admins
                const adminsQuery = query(collection(db, 'admins'), limit(100));
                const adminsSnapshot = await getDocs(adminsQuery);
                adminsData = adminsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Admin));
            } else if (admin.butcherId) {
                // 🔐 CRITICAL: Business admin ONLY sees admins with same butcherId
                const adminsQuery = query(
                    collection(db, 'admins'),
                    where('butcherId', '==', admin.butcherId),
                    limit(50)
                );
                const adminsSnapshot = await getDocs(adminsQuery);
                // Filter out super admins - they should never appear in business admin's list
                adminsData = adminsSnapshot.docs
                    .map(d => ({ id: d.id, ...d.data() } as Admin))
                    .filter(a => a.adminType !== 'super');
            } else {
                // No business assigned - show only self
                adminsData = [admin];
            }

            setAdmins(adminsData);
        } catch (error) {
            console.error("Error reloading admins:", error);
        }
    }, [admin]);

    // Lazy load admins when tab changes
    useEffect(() => {
        if (activeTab === 'admins' && admins.length === 0 && admin) {
            const loadAdmins = async () => {
                try {
                    let adminsData: Admin[] = [];

                    // SECURITY: Business admins only see staff from their own business
                    if (admin.adminType === 'super') {
                        // Super admin sees ALL admins
                        const adminsQuery = query(collection(db, 'admins'), limit(50));
                        const adminsSnapshot = await getDocs(adminsQuery);
                        adminsData = adminsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Admin));
                    } else if (admin.butcherId) {
                        // Business admin only sees admins with same butcherId
                        // IMPORTANT: Exclude super admins from the results
                        const adminsQuery = query(
                            collection(db, 'admins'),
                            where('butcherId', '==', admin.butcherId),
                            limit(50)
                        );
                        const adminsSnapshot = await getDocs(adminsQuery);
                        // Filter out super admins - they should never appear in business admin's list
                        adminsData = adminsSnapshot.docs
                            .map(d => ({ id: d.id, ...d.data() } as Admin))
                            .filter(a => a.adminType !== 'super');
                    } else {
                        // No business assigned - show only self
                        adminsData = [admin];
                    }

                    setAdmins(adminsData);
                } catch (error) {
                    console.error("Error loading admins:", error);
                    showToast('Admin listesi yüklenirken hata oluştu', 'error');
                }
            };
            loadAdmins();
        }
    }, [activeTab, admin, admins.length]);

    // Load butchers only when needed (for modals) - includes types for sector-based role filtering
    const loadButchersHelper = useCallback(async () => {
        if (butcherList.length > 0) return;
        setLoadingButchers(true);
        try {
            const q = query(collection(db, 'businesses'), orderBy('companyName'));
            const snapshot = await getDocs(q);
            setButcherList(snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    name: data.companyName,
                    city: data.address?.city || '',
                    country: data.address?.country || '',
                    postalCode: data.address?.postalCode || '',
                    types: data.types || [data.type || 'kasap'], // Sector types array (e.g., ['kasap', 'market'])
                };
            }));
        } catch (error) {
            console.error('Error loading butchers:', error);
        }
        setLoadingButchers(false);
    }, [butcherList.length]);

    // 🆕 ORGANIZASYON YÜKLEME - Kermes rolleri için
    const loadOrganizationsHelper = useCallback(async () => {
        if (organizationList.length > 0) return;
        setLoadingOrganizations(true);
        try {
            const q = query(collection(db, 'organizations'), where('isActive', '==', true), orderBy('city'));
            const snapshot = await getDocs(q);
            setOrganizationList(snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    name: data.name || '',
                    shortName: data.shortName || '',
                    city: data.city || '',
                    postalCode: data.postalCode || '',
                    type: data.type || 'vikz',
                };
            }));
        } catch (error) {
            console.error('Error loading organizations:', error);
        }
        setLoadingOrganizations(false);
    }, [organizationList.length]);

    const handleReverseGeocode = useCallback(async () => {
        if (!editingUserProfile) return;

        let lat = (editingUserProfile as any).latitude;
        let lng = (editingUserProfile as any).longitude;

        if (!lat || !lng) {
            // If no stored GPS, try browser geolocation
            if ("geolocation" in navigator) {
                setIsGeocoding(true);
                navigator.geolocation.getCurrentPosition(async (position) => {
                    await performReverseGeocoding(position.coords.latitude, position.coords.longitude);
                }, (error) => {
                    console.error("Error getting location", error);
                    setIsGeocoding(false);
                    alert("Konum alınamadı. Lütfen GPS izni verin.");
                });
                return;
            } else {
                alert("GPS verisi bulunamadı.");
                return;
            }
        }
        await performReverseGeocoding(lat, lng);
    }, [editingUserProfile]);

    const performReverseGeocoding = async (lat: number, lng: number) => {
        setIsGeocoding(true);
        try {
            // Check if Google Maps is loaded
            if (!(window as any).google?.maps?.Geocoder) {
                throw new Error("Google Maps not loaded");
            }

            const geocoder = new (window as any).google.maps.Geocoder();

            // Use callback pattern as geocode() doesn't reliably return a promise in all versions
            geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
                setIsGeocoding(false);

                if (status !== 'OK' || !results || results.length === 0) {
                    console.error("Geocoding failed:", status);
                    alert("Adres çözümlenemedi. Lütfen manuel olarak girin.");
                    return;
                }

                const place = results[0];
                let street = '';
                let houseNumber = '';
                let city = '';
                let postalCode = '';
                let country = '';
                let countryCode = 'DE'; // Default to Germany

                for (const component of place.address_components) {
                    const type = component.types[0];
                    if (type === 'route') street = component.long_name;
                    else if (type === 'street_number') houseNumber = component.long_name;
                    else if (type === 'locality' || type === 'postal_town' || type === 'administrative_area_level_2') city = component.long_name;
                    else if (type === 'postal_code') postalCode = component.long_name;
                    else if (type === 'country') {
                        country = component.long_name;
                        countryCode = component.short_name;
                    }
                }

                setEditingUserProfile(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        address: street || place.formatted_address?.split(',')[0] || '',
                        houseNumber: houseNumber,
                        city: city,
                        postalCode: postalCode,
                        country: country,
                        dialCode: getDialCode(countryCode),
                        latitude: lat,
                        longitude: lng
                    };
                });

                // 🔧 FIX: Also update editingAdmin for admin edit modal GPS support
                setEditingAdmin(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        address: street || place.formatted_address?.split(',')[0] || '',
                        houseNumber: houseNumber,
                        city: city,
                        postalCode: postalCode,
                        country: country,
                        dialCode: getDialCode(countryCode),
                        latitude: lat,
                        longitude: lng
                    } as Admin;
                });
            });
        } catch (error) {
            console.error("Geocoding error:", error);
            setIsGeocoding(false);
            alert("Adres çözümlenemedi. Google Maps yüklenemedi.");
        }
    };

    // Custom Address Autocomplete State (Direct API - No Widget)
    const [addressSuggestions, setAddressSuggestions] = useState<{ description: string, place_id: string }[]>([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const [addressSearchLoading, setAddressSearchLoading] = useState(false);
    const addressSearchTimer = useRef<NodeJS.Timeout | null>(null);

    // Custom Address Autocomplete - Direct API Call (No Widget - Prevents Freeze)
    const fetchAddressSuggestions = useCallback(async (query: string) => {
        if (query.length < 3) {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
            return;
        }

        setAddressSearchLoading(true);
        try {
            const response = await fetch(
                `/api/places?type=autocomplete&input=${encodeURIComponent(query)}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.predictions) {
                setAddressSuggestions(data.predictions.map((p: any) => ({
                    description: p.description,
                    place_id: p.place_id
                })));
                setShowAddressSuggestions(true);
            } else {
                setAddressSuggestions([]);
            }
        } catch (error) {
            console.error('Address search error:', error);
            setAddressSuggestions([]);
        }
        setAddressSearchLoading(false);
    }, []);

    // Debounced address search
    const handleAddressInputChange = useCallback((value: string, isNewUser: boolean) => {
        if (addressSearchTimer.current) {
            clearTimeout(addressSearchTimer.current);
        }

        // Update the input value immediately
        if (isNewUser) {
            setNewUserData(prev => ({ ...prev, address: value }));
        } else if (editingUserProfile) {
            setEditingUserProfile(prev => prev ? ({ ...prev, address: value }) : null);
        }

        // Debounce the API call
        addressSearchTimer.current = setTimeout(() => {
            fetchAddressSuggestions(value);
        }, 400);
    }, [fetchAddressSuggestions, editingUserProfile]);

    // Handle address selection from suggestions
    const handleAddressSelect = useCallback(async (place_id: string, description: string, isNewUser: boolean) => {
        setShowAddressSuggestions(false);
        setAddressSuggestions([]);

        // Fetch place details to get address components
        try {
            const response = await fetch(
                `/api/places?type=details&place_id=${place_id}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.result) {
                const place = data.result;
                let street = '';
                let houseNumber = '';
                let city = '';
                let postalCode = '';
                let country = '';
                let countryCode = 'DE';

                if (place.address_components) {
                    for (const component of place.address_components) {
                        const type = component.types[0];
                        if (type === 'route') street = component.long_name;
                        else if (type === 'street_number') houseNumber = component.long_name;
                        else if (type === 'locality' || type === 'postal_town') city = component.long_name;
                        else if (type === 'administrative_area_level_2' && !city) city = component.long_name; // Fallback: only if no locality/postal_town found
                        else if (type === 'postal_code') postalCode = component.long_name;
                        else if (type === 'country') {
                            country = component.long_name;
                            countryCode = component.short_name;
                        }
                    }
                }

                const addressData = {
                    address: street || place.formatted_address?.split(',')[0] || '',
                    houseNumber,
                    city,
                    postalCode,
                    country,
                    dialCode: getDialCode(countryCode)
                };

                if (isNewUser) {
                    setNewUserData(prev => ({ ...prev, ...addressData }));
                } else {
                    // 🔧 FIX: Update both editingUserProfile AND editingAdmin
                    // This ensures Google Places selection works in both user and admin edit modals
                    setEditingUserProfile(prev => prev ? ({ ...prev, ...addressData }) : null);
                    setEditingAdmin(prev => prev ? ({ ...prev, ...addressData } as Admin) : null);
                }
            }
        } catch (error) {
            console.error('Place details error:', error);
            // Fallback: just set the description as address
            const addressData = { address: description.split(',')[0] };
            if (isNewUser) {
                setNewUserData(prev => ({ ...prev, ...addressData }));
            } else {
                // 🔧 FIX: Update both editingUserProfile AND editingAdmin
                setEditingUserProfile(prev => prev ? ({ ...prev, ...addressData }) : null);
                setEditingAdmin(prev => prev ? ({ ...prev, ...addressData } as Admin) : null);
            }
        }
    }, []);

    // Cleanup address search timer
    useEffect(() => {
        return () => {
            if (addressSearchTimer.current) {
                clearTimeout(addressSearchTimer.current);
            }
        };
    }, []);

    // City Autocomplete State
    const [citySuggestions, setCitySuggestions] = useState<{ description: string, place_id: string }[]>([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [citySearchLoading, setCitySearchLoading] = useState(false);
    const citySearchTimer = useRef<NodeJS.Timeout | null>(null);

    // Fetch city suggestions
    const fetchCitySuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            setCitySuggestions([]);
            setShowCitySuggestions(false);
            return;
        }

        setCitySearchLoading(true);
        try {
            const response = await fetch(`/api/places?type=cities&input=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.status === 'OK' && data.predictions) {
                setCitySuggestions(data.predictions.map((p: any) => ({
                    description: p.description,
                    place_id: p.place_id
                })));
                setShowCitySuggestions(true);
            } else {
                setCitySuggestions([]);
            }
        } catch (error) {
            console.error('City search error:', error);
            setCitySuggestions([]);
        }
        setCitySearchLoading(false);
    }, []);

    // Handle city input change with debounce
    const handleCityInputChange = useCallback((value: string, isNewUser: boolean) => {
        if (citySearchTimer.current) {
            clearTimeout(citySearchTimer.current);
        }

        if (isNewUser) {
            setNewUserData(prev => ({ ...prev, city: value }));
        } else if (editingUserProfile) {
            setEditingUserProfile(prev => prev ? ({ ...prev, city: value }) : null);
        }

        citySearchTimer.current = setTimeout(() => {
            fetchCitySuggestions(value);
        }, 400);
    }, [fetchCitySuggestions, editingUserProfile]);

    // Handle city selection - extract just the city name
    const handleCitySelect = useCallback((description: string, isNewUser: boolean) => {
        setShowCitySuggestions(false);
        setCitySuggestions([]);

        // Extract city name (first part before comma)
        const cityName = description.split(',')[0].trim();

        if (isNewUser) {
            setNewUserData(prev => ({ ...prev, city: cityName }));
        } else {
            setEditingUserProfile(prev => prev ? ({ ...prev, city: cityName }) : null);
        }
    }, []);

    // Cleanup city search timer
    useEffect(() => {
        return () => {
            if (citySearchTimer.current) {
                clearTimeout(citySearchTimer.current);
            }
        };
    }, []);

    // Search users
    const searchUsers = useCallback(async (searchTerm: string, loadMore = false) => {
        if (!searchTerm.trim()) {
            setUsers([]);
            return;
        }

        setSearchLoading(true);
        try {
            const searchLower = searchTerm.toLowerCase();

            // 🔍 MULTI-WORD SEARCH: Split into individual words for separate queries
            const searchWords = searchTerm.trim().split(/\s+/).filter(w => w.length > 1);
            const primaryWord = searchWords[0] || searchTerm; // Use first word for Firestore queries
            const primaryLower = primaryWord.toLowerCase();
            const primaryCapitalized = primaryWord.charAt(0).toUpperCase() + primaryWord.slice(1).toLowerCase();

            const usersRef = collection(db, 'users');
            const queries = [];

            // Name search - query displayName, firstName, and lastName for comprehensive results
            // Use PRIMARY WORD (first word) for Firestore prefix queries
            queries.push(query(usersRef, orderBy('displayName'), startAt(primaryWord), endAt(primaryWord + '\uf8ff'), limit(30)));

            // Also try capitalized search (e.g. 'nedim' -> 'Nedim')
            if (primaryCapitalized !== primaryWord) {
                queries.push(query(usersRef, orderBy('displayName'), startAt(primaryCapitalized), endAt(primaryCapitalized + '\uf8ff'), limit(30)));
            }

            // Also search firstName and lastName fields (mobile app stores name separately)
            queries.push(query(usersRef, orderBy('firstName'), startAt(primaryWord), endAt(primaryWord + '\uf8ff'), limit(30)));
            queries.push(query(usersRef, orderBy('firstName'), startAt(primaryCapitalized), endAt(primaryCapitalized + '\uf8ff'), limit(30)));
            queries.push(query(usersRef, orderBy('lastName'), startAt(primaryWord), endAt(primaryWord + '\uf8ff'), limit(30)));
            queries.push(query(usersRef, orderBy('lastName'), startAt(primaryCapitalized), endAt(primaryCapitalized + '\uf8ff'), limit(30)));

            // 🔍 MULTI-WORD: If there are multiple words, also query the second word
            if (searchWords.length > 1) {
                const secondWord = searchWords[1];
                const secondCapitalized = secondWord.charAt(0).toUpperCase() + secondWord.slice(1).toLowerCase();
                queries.push(query(usersRef, orderBy('displayName'), startAt(secondWord), endAt(secondWord + '\uf8ff'), limit(30)));
                queries.push(query(usersRef, orderBy('displayName'), startAt(secondCapitalized), endAt(secondCapitalized + '\uf8ff'), limit(30)));
                queries.push(query(usersRef, orderBy('firstName'), startAt(secondWord), endAt(secondWord + '\uf8ff'), limit(30)));
                queries.push(query(usersRef, orderBy('firstName'), startAt(secondCapitalized), endAt(secondCapitalized + '\uf8ff'), limit(30)));
                queries.push(query(usersRef, orderBy('lastName'), startAt(secondWord), endAt(secondWord + '\uf8ff'), limit(30)));
                queries.push(query(usersRef, orderBy('lastName'), startAt(secondCapitalized), endAt(secondCapitalized + '\uf8ff'), limit(30)));
            }

            // Email search (often lowercase)
            queries.push(query(usersRef, orderBy('email'), startAt(primaryLower), endAt(primaryLower + '\uf8ff'), limit(20)));

            // Phone search (if digits) - NOW WORKS WITH 3+ DIGITS
            const searchDigits = searchTerm.replace(/\D/g, ''); // Extract digits
            if (searchDigits.length >= 3) { // 3 veya daha fazla rakam ile ara
                // PREFIX SEARCH - numaranın herhangi bir formatına göre ara
                // Format 1: Raw digits (e.g., "178" -> search phoneNumber starting with "178")
                queries.push(query(usersRef, orderBy('phoneNumber'), startAt(searchDigits), endAt(searchDigits + '\uf8ff'), limit(20)));

                // Format 2: With +49 prefix (for German numbers stored as +49...)
                queries.push(query(usersRef, orderBy('phoneNumber'), startAt('+49' + searchDigits), endAt('+49' + searchDigits + '\uf8ff'), limit(20)));

                // Format 3: With 0 prefix (for German numbers stored as 0...)
                if (!searchDigits.startsWith('0')) {
                    queries.push(query(usersRef, orderBy('phoneNumber'), startAt('0' + searchDigits), endAt('0' + searchDigits + '\uf8ff'), limit(20)));
                }

                // Format 4: If searching with country code like +49178, also search without
                if (searchDigits.startsWith('49') && searchDigits.length > 4) {
                    const withoutCountry = searchDigits.slice(2);
                    queries.push(query(usersRef, orderBy('phoneNumber'), startAt(withoutCountry), endAt(withoutCountry + '\uf8ff'), limit(20)));
                    queries.push(query(usersRef, orderBy('phoneNumber'), startAt('0' + withoutCountry), endAt('0' + withoutCountry + '\uf8ff'), limit(20)));
                }
            }

            const snapshots = await Promise.all(queries.map(q => getDocs(q)));

            // Deduplicate results
            const allDocs = new Map();
            snapshots.forEach(snap => {
                snap.docs.forEach(d => {
                    allDocs.set(d.id, d);
                });
            });

            // Load all admins and create a map by firebaseUid
            const adminsSnapshot = await getDocs(collection(db, 'admins'));
            const adminsMap = new Map<string, any>();
            const adminsByButcherName: string[] = []; // 🟣 Track user IDs for business name matching

            adminsSnapshot.docs.forEach((adminDoc) => {
                const data = adminDoc.data();
                const adminData = { id: adminDoc.id, ...data };
                // Map by firebaseUid and doc id
                if (data.firebaseUid) {
                    adminsMap.set(data.firebaseUid, adminData);
                }
                adminsMap.set(adminDoc.id, adminData);
                // Also map by email
                if (data.email) {
                    adminsMap.set(data.email.toLowerCase(), adminData);
                }
                // Also map by phone number (with normalization)
                if (data.phoneNumber) {
                    const normalized = data.phoneNumber.replace(/\s+/g, '').replace(/[()-]/g, '');
                    adminsMap.set(normalized, adminData);
                    // Also try without country code
                    if (normalized.startsWith('+49')) {
                        adminsMap.set('0' + normalized.slice(3), adminData);
                    }
                }
                // 🟣 Check if butcherName matches search term
                if (data.butcherName && data.butcherName.toLowerCase().includes(searchLower)) {
                    // Get the user ID (prefer firebaseUid, then doc id)
                    const userId = data.firebaseUid || adminDoc.id;
                    if (userId && !allDocs.has(userId)) {
                        adminsByButcherName.push(userId);
                    }
                }
            });

            // 🟣 Fetch users who match by business name but weren't found in name/email search
            if (adminsByButcherName.length > 0) {
                for (const userId of adminsByButcherName.slice(0, 20)) { // Limit to 20
                    try {
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        if (userDoc.exists() && !allDocs.has(userId)) {
                            allDocs.set(userId, userDoc);
                        }
                    } catch (e) {
                        console.log('Error fetching user by business:', userId, e);
                    }
                }
            }

            // 🟣 Include all docs including ones added by business name search
            const uniqueDocs = Array.from(allDocs.values());

            // Get all users with admin status - try by uid first, then by email, then by phone
            const usersWithAdminStatus = uniqueDocs.map((d) => {
                const userData = d.data();
                // Try by user ID first
                let adminData = adminsMap.get(d.id);
                // If not found, try by email
                if (!adminData && userData.email) {
                    adminData = adminsMap.get(userData.email.toLowerCase());
                }
                // If not found, try by phone number
                if (!adminData && userData.phoneNumber) {
                    const normalized = userData.phoneNumber.replace(/\s+/g, '').replace(/[()-]/g, '');
                    adminData = adminsMap.get(normalized);
                    if (!adminData && normalized.startsWith('+49')) {
                        adminData = adminsMap.get('0' + normalized.slice(3));
                    }
                }
                return {
                    id: d.id,
                    ...userData,
                    // CRITICAL FIX: Only mark as admin if admin record exists AND is active
                    isAdmin: !!adminData && adminData.isActive !== false,
                    adminType: (adminData && adminData.isActive !== false) ? (adminData.adminType || adminData.type) : undefined,
                    adminProfile: (adminData && adminData.isActive !== false) ? adminData as Admin : undefined,
                } as FirebaseUser;
            });

            // 🔍 MULTI-WORD SEARCH: Filter results to match ALL search words
            const searchWordsLower = searchWords.map(w => w.toLowerCase());
            let filteredUsers = usersWithAdminStatus;
            if (searchWordsLower.length > 1) {
                // Multi-word search: filter to only users matching ALL words
                filteredUsers = usersWithAdminStatus.filter(user => {
                    // Build searchable text from all relevant fields including adminType/role
                    const searchableText = [
                        user.displayName || '',
                        (user as any).firstName || '',
                        (user as any).lastName || '',
                        user.email || '',
                        user.phoneNumber || '',
                        (user.adminProfile as any)?.butcherName || '',
                        // 🆕 Add adminType and role for business type searching (kasap, market, etc.)
                        user.adminType || '',
                        (user.adminProfile as any)?.adminType || '',
                        (user.adminProfile as any)?.role || '',
                        // 🆕 Add location fields for postal code and country search
                        (user as any).postalCode || '',
                        (user as any).city || '',
                        (user as any).country || '',
                        (user.adminProfile as any)?.postalCode || '',
                        (user.adminProfile as any)?.city || '',
                        (user.adminProfile as any)?.country || '',
                    ].join(' ').toLowerCase();

                    // Check if ALL words are found in the searchable text
                    return searchWordsLower.every(word => searchableText.includes(word));
                });
            }

            setUsers(filteredUsers);
            setHasMore(false); // Search doesn't easily support pagination across multiple queries
        } catch (error) {
            console.error('Search error:', error);
            showToast('Arama sırasında hata oluştu', 'error');
        } finally {
            setSearchLoading(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery) {
                searchUsers(searchQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchUsers]);

    // Load all users with pagination
    const loadAllUsers = useCallback(async (page: number = 1) => {
        setAllUsersLoading(true);
        try {
            const usersRef = collection(db, 'users');

            // First, load admins - scoped by business for non-super admins
            let adminsSnapshot;
            if (admin?.adminType === 'super') {
                // Super admin sees all admins
                adminsSnapshot = await getDocs(collection(db, 'admins'));
            } else if (admin?.butcherId) {
                // Business admin only sees admins from their business
                adminsSnapshot = await getDocs(
                    query(collection(db, 'admins'), where('butcherId', '==', admin.butcherId))
                );
            } else {
                // No business - empty list
                adminsSnapshot = { docs: [] } as any;
            }

            const adminsByUid = new Map<string, any>();
            const adminsByEmail = new Map<string, any>();
            const adminsByPhone = new Map<string, any>(); // Phone-based lookup
            const adminsByName = new Map<string, any>(); // Name-based lookup (fallback)
            adminsSnapshot.docs.forEach((adminDoc: any) => {
                const data = adminDoc.data();
                // SECURITY: Skip super admins for non-super admin viewers
                if (admin?.adminType !== 'super' && data.adminType === 'super') {
                    return; // Don't include super admins in business admin's view
                }
                const adminData = { id: adminDoc.id, ...data };
                // Map by firebaseUid if available
                if (data.firebaseUid) {
                    adminsByUid.set(data.firebaseUid, adminData);
                }
                // Also map by doc id (which could be email or uid)
                adminsByUid.set(adminDoc.id, adminData);
                // Map by email if available
                if (data.email) {
                    adminsByEmail.set(data.email.toLowerCase(), adminData);
                }
                // Map by phone number if available (normalize format)
                if (data.phoneNumber) {
                    const normalizedPhone = data.phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                    adminsByPhone.set(normalizedPhone, adminData);
                    // Also try without + prefix
                    if (normalizedPhone.startsWith('+')) {
                        adminsByPhone.set(normalizedPhone.slice(1), adminData);
                    }
                }
                // Map by displayName or name for fallback matching
                if (data.displayName) {
                    adminsByName.set(data.displayName.toLowerCase().trim(), adminData);
                }
                if (data.name) {
                    adminsByName.set(data.name.toLowerCase().trim(), adminData);
                }
                // Also try firstName + lastName combination
                if (data.firstName && data.lastName) {
                    adminsByName.set(`${data.firstName} ${data.lastName}`.toLowerCase().trim(), adminData);
                }
            });

            // SECURITY: For non-super admins, we need to also exclude super admin USERS
            // Load all super admin UIDs to filter them from user list
            let superAdminUids = new Set<string>();
            if (admin?.adminType !== 'super') {
                const allAdminsSnapshot = await getDocs(collection(db, 'admins'));
                allAdminsSnapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    if (data.adminType === 'super') {
                        // Collect all possible UIDs for super admins
                        if (data.firebaseUid) superAdminUids.add(data.firebaseUid);
                        superAdminUids.add(doc.id);
                        if (data.email) superAdminUids.add(data.email.toLowerCase());
                    }
                });
            }

            // 🔒 CRITICAL SECURITY: Business admins only see their own customers + users they created
            let allowedUserIds: Set<string> | null = null; // null means all users (super admin only)

            if (admin?.adminType !== 'super' && admin?.butcherId) {
                // For business admins: Get UIDs of customers who ordered from this business
                // OR users created by this business
                allowedUserIds = new Set<string>();

                console.log('🔒 SECURITY: Loading customers for business:', admin.butcherId);

                // 1️⃣ Query orders collection for this business (try both businessId and butcherId for backward compatibility)
                const ordersQueryByBusinessId = query(
                    collection(db, 'meat_orders'),
                    where('businessId', '==', admin.butcherId)
                );
                const ordersQueryByButcherId = query(
                    collection(db, 'meat_orders'),
                    where('butcherId', '==', admin.butcherId)
                );

                const [ordersSnapshot1, ordersSnapshot2] = await Promise.all([
                    getDocs(ordersQueryByBusinessId),
                    getDocs(ordersQueryByButcherId)
                ]);

                // Collect unique customer UIDs from orders (both queries)
                [...ordersSnapshot1.docs, ...ordersSnapshot2.docs].forEach((orderDoc) => {
                    const orderData = orderDoc.data();
                    if (orderData.userId) {
                        allowedUserIds!.add(orderData.userId);
                    }
                    // Also try customer field if exists
                    if (orderData.customerId) {
                        allowedUserIds!.add(orderData.customerId);
                    }
                });

                console.log('🔒 SECURITY: Found', allowedUserIds.size, 'customers from orders');

                // 2️⃣ Also get users CREATED by this business's admins
                // First get all admin emails for this business
                const businessAdminEmails = new Set<string>();
                const businessAdminsQuery = query(
                    collection(db, 'admins'),
                    where('butcherId', '==', admin.butcherId)
                );
                const businessAdminsSnapshot = await getDocs(businessAdminsQuery);
                businessAdminsSnapshot.docs.forEach((adminDoc) => {
                    const adminData = adminDoc.data();
                    if (adminData.email) {
                        businessAdminEmails.add(adminData.email.toLowerCase());
                    }
                });

                console.log('🔒 SECURITY: Business has', businessAdminEmails.size, 'admins');

                // Now find users created by these admins (createdBySource: 'business_admin')
                // We need to check each user's createdBy field
                // Since we can't do a complex query, we'll check during the filter phase
                // Store the admin emails for later filtering
                (allowedUserIds as any)._businessAdminEmails = businessAdminEmails;

                console.log('🔒 SECURITY: Total allowed users (orders):', allowedUserIds.size);

                // Don't return early if no orders - there might be users created by the business
            } else if (admin?.adminType !== 'super') {
                // Non-super admin without a business - show nothing
                console.log('🔒 SECURITY: Admin has no business, showing empty list');
                setUsers([]);
                setAllUsersTotal(0);
                setAllUsersPage(1);
                setAllUsersLoading(false);
                return;
            }

            // Fetch users - Super admin gets all, business admins get filtered list
            console.log('📊 DEBUG: Fetching users from collection...');
            let snapshot;
            if (allowedUserIds === null) {
                // Super admin: get all users
                snapshot = await getDocs(query(usersRef, limit(500)));
            } else {
                // Business admin: only get allowed user IDs
                // Note: Firestore 'in' query limited to 30 items, so we need to chunk or post-filter
                // For now, fetch all and filter in memory (acceptable for <= 500 users)
                snapshot = await getDocs(query(usersRef, limit(500)));
            }
            console.log('📊 DEBUG: Users collection returned:', snapshot.docs.length, 'documents');

            // Get all users with admin status - try by uid first, then by email
            const usersWithAdminStatus = snapshot.docs
                .filter((d) => {
                    const userData = d.data();

                    // 🔒 SECURITY: Business admins only see their customers OR users they created
                    if (allowedUserIds !== null) {
                        // Check 1: User ordered from this business
                        const orderedFromBusiness = allowedUserIds.has(d.id);

                        // Check 2: User was created by this business's admin
                        const businessAdminEmails = (allowedUserIds as any)._businessAdminEmails as Set<string> | undefined;
                        const createdByBusiness = businessAdminEmails &&
                            userData.createdBySource === 'business_admin' &&
                            userData.createdBy &&
                            businessAdminEmails.has(userData.createdBy.toLowerCase());

                        if (!orderedFromBusiness && !createdByBusiness) {
                            return false; // User didn't order from AND wasn't created by this business
                        }
                    }

                    // SECURITY: Exclude super admin users entirely for non-super admin viewers
                    if (admin?.adminType !== 'super') {
                        if (superAdminUids.has(d.id)) return false;
                        if (userData.email && superAdminUids.has(userData.email.toLowerCase())) return false;
                    }
                    return true;
                })
                .map((d) => {
                    const userData = d.data();
                    // Try to find admin by user ID first
                    let adminData = adminsByUid.get(d.id);
                    // If not found, try by user email
                    if (!adminData && userData.email) {
                        adminData = adminsByEmail.get(userData.email.toLowerCase());
                    }
                    // If still not found, try by phone number
                    if (!adminData && userData.phoneNumber) {
                        const normalizedPhone = userData.phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                        adminData = adminsByPhone.get(normalizedPhone);
                        // Also try without + prefix
                        if (!adminData && normalizedPhone.startsWith('+')) {
                            adminData = adminsByPhone.get(normalizedPhone.slice(1));
                        }
                    }
                    // If still not found, try by name (fallback)
                    if (!adminData) {
                        const userDisplayName = userData.displayName?.toLowerCase().trim();
                        const userFullName = userData.firstName && userData.lastName
                            ? `${userData.firstName} ${userData.lastName}`.toLowerCase().trim()
                            : null;
                        if (userDisplayName) {
                            adminData = adminsByName.get(userDisplayName);
                        }
                        if (!adminData && userFullName) {
                            adminData = adminsByName.get(userFullName);
                        }
                    }
                    // DEBUG: Log matching attempts for troubleshooting
                    if (!adminData && (userData.displayName || userData.firstName)) {
                        console.log('🔍 No admin match for user:', {
                            userId: d.id,
                            email: userData.email,
                            phone: userData.phoneNumber,
                            name: userData.displayName || `${userData.firstName} ${userData.lastName}`,
                            availableAdminUids: Array.from(adminsByUid.keys()).slice(0, 5),
                            availableAdminEmails: Array.from(adminsByEmail.keys()).slice(0, 5),
                        });
                    }
                    return {
                        id: d.id,
                        ...userData,
                        // CRITICAL FIX: Only mark as admin if admin record exists AND is active
                        isAdmin: !!adminData && adminData.isActive !== false,
                        adminType: (adminData && adminData.isActive !== false) ? (adminData.adminType || adminData.type) : undefined,
                        adminProfile: (adminData && adminData.isActive !== false) ? adminData as Admin : undefined,
                    } as FirebaseUser;
                });

            // Sort client-side to handle missing fields
            const sorted = [...usersWithAdminStatus].sort((a, b) => {
                const getFieldValue = (user: any, field: string) => {
                    if (field === 'createdAt') {
                        const val = user.createdAt;
                        if (!val) return 0;
                        return val?.toDate ? val.toDate().getTime() : new Date(val).getTime();
                    }
                    return (user[field] || '').toString().toLowerCase();
                };

                const aVal = getFieldValue(a, allUsersSortBy);
                const bVal = getFieldValue(b, allUsersSortBy);

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return allUsersSortOrder === 'desc' ? bVal - aVal : aVal - bVal;
                }
                return allUsersSortOrder === 'desc'
                    ? String(bVal).localeCompare(String(aVal))
                    : String(aVal).localeCompare(String(bVal));
            });

            // CRITICAL FIX: Filter based on userTypeFilter
            // When viewing "users" (customers), EXCLUDE anyone who is an admin
            // This solves the "admin still appears in users list" problem
            const filtered = sorted.filter(user => {
                if (userTypeFilter === 'user') {
                    // Only show non-admins (pure customers)
                    return !user.isAdmin;
                } else if (userTypeFilter === 'admin') {
                    // Show business admins (not staff, not super)
                    return user.isAdmin && user.adminType && !user.adminType.includes('_staff') && user.adminType !== 'super';
                } else if (userTypeFilter === 'staff') {
                    // Show staff members
                    return user.isAdmin && user.adminType?.includes('_staff');
                } else if (userTypeFilter === 'super') {
                    // Show super admins
                    return user.isAdmin && user.adminType === 'super';
                } else if (userTypeFilter === 'driver') {
                    // Show all drivers (isDriver flag on admin profile)
                    return (user.adminProfile as any)?.isDriver === true;
                } else if (userTypeFilter === 'driver_lokma') {
                    // Show only LOKMA fleet drivers
                    return (user.adminProfile as any)?.isDriver === true && (user.adminProfile as any)?.driverType === 'lokma_fleet';
                } else if (userTypeFilter === 'driver_business') {
                    // Show only business drivers
                    return (user.adminProfile as any)?.isDriver === true && ((user.adminProfile as any)?.driverType === 'business' || !(user.adminProfile as any)?.driverType);
                }
                // 'all' - show everyone
                return true;
            });

            // Paginate
            const start = (page - 1) * USERS_PER_PAGE;
            const end = start + USERS_PER_PAGE;
            const paginatedUsers = filtered.slice(start, end);

            setAllUsersTotal(filtered.length);
            setUsers(paginatedUsers);
            setAllUsersPage(page);
            setHasMore(end < sorted.length);
        } catch (error) {
            console.error('Load all users error:', error);
            showToast('Kullanıcılar yüklenirken hata oluştu', 'error');
        } finally {
            setAllUsersLoading(false);
        }
    }, [allUsersSortBy, allUsersSortOrder, USERS_PER_PAGE, userTypeFilter, admin]);

    // Reload when sort or filter changes - but NOT when there's an active search
    useEffect(() => {
        if (showAllUsers && !searchQuery) {
            loadAllUsers(1);
        }
    }, [showAllUsers, allUsersSortBy, allUsersSortOrder, userTypeFilter, loadAllUsers, searchQuery]);

    // Show delete confirmation modal
    const showDeleteModal = (userId: string, userName: string) => {
        setDeleteModal({ show: true, userId, userName });
    };

    // Confirm delete user (called from modal)
    const confirmDeleteUser = async () => {
        if (!deleteModal) return;

        const { userId, userName } = deleteModal;
        setDeleteModal(null);

        try {
            // Find user data for email/phone
            const userToDelete = users.find(u => u.id === userId);

            // Call API to delete from Firebase Auth + Firestore
            const response = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    email: userToDelete?.email,
                    phoneNumber: userToDelete?.phoneNumber,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                // Remove from local state
                setUsers(prev => prev.filter(u => u.id !== userId));
                showToast(`"${userName}" tüm sistemlerden silindi`, 'success');
            } else {
                throw new Error(result.error || 'Silme hatası');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            showToast('Kullanıcı silinirken hata oluştu', 'error');
        }
    };

    // Assign admin role to user
    const handleAssignRole = async () => {
        if (!selectedUser || !assignRole) return;

        // Validate business selection for kasap/restoran roles
        if ((assignRole === 'kasap' || assignRole === 'kasap_staff' || assignRole === 'restoran' || assignRole === 'restoran_staff') && !selectedButcherId) {
            showToast('Lütfen bir işletme seçin', 'error');
            return;
        }

        setAssigning(true);
        try {
            const selectedBusiness = butcherList.find(b => b.id === selectedButcherId);

            // Create or update admin document using setDoc with merge
            await setDoc(doc(db, 'admins', selectedUser.id), {
                email: selectedUser.email || null,
                displayName: selectedUser.displayName,
                phoneNumber: selectedUser.phoneNumber || null,
                firebaseUid: selectedUser.id,
                role: 'admin',
                adminType: assignRole,
                butcherId: selectedButcherId || null,
                butcherName: selectedBusiness?.name || null,
                permissions: [],
                isActive: true,
                createdBy: admin?.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            }, { merge: true });

            // Close modal and refresh
            setSelectedUser(null);
            setAssignRole('kermes');
            setAssignLocation('');
            setSelectedButcherId('');

            // 🔐 SECURITY: Use filtered reload function
            await reloadAdmins();

            // Update user in list
            setUsers(users.map(u =>
                u.id === selectedUser.id
                    ? { ...u, isAdmin: true, adminType: assignRole }
                    : u
            ));

            showToast('Admin rolü başarıyla atandı!', 'success');
        } catch (error) {
            console.error('Assign role error:', error);
            showToast('Rol atanırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'), 'error');
        }
        setAssigning(false);
    };

    // Remove admin role
    const handleRemoveAdmin = async (adminId: string, adminName?: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Admin Yetkisini Kaldır',
            message: 'Bu kullanıcının admin yetkisini TAMAMEN KALDIRMAK istediğinize emin misiniz? Bu işlem geri alınamaz.',
            itemName: adminName,
            variant: 'danger',
            confirmText: 'Evet, Yetkiyi Kaldır',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                try {
                    // Delete from admins collection
                    await deleteDoc(doc(db, 'admins', adminId));

                    // Also update users collection if exists
                    try {
                        const userDoc = await getDoc(doc(db, 'users', adminId));
                        if (userDoc.exists()) {
                            await updateDoc(doc(db, 'users', adminId), {
                                isAdmin: false,
                                adminType: null,
                            });
                        }
                    } catch (e) {
                        console.log('User doc update skipped:', e);
                    }

                    setAdmins(admins.filter(a => a.id !== adminId));
                    showToast('Admin yetkisi kaldırıldı', 'success');
                } catch (error) {
                    console.error('Remove admin error:', error);
                    showToast('Hata oluştu: ' + (error as Error).message, 'error');
                }
            },
        });
    };

    // Open edit modal for an admin
    const handleEditAdmin = (adminToEdit: Admin) => {
        // 🔍 CRITICAL DEBUG: Log everything about the admin being edited
        console.log('🎯 ============= EDIT ADMIN DEBUG =============');
        console.log('🎯 Admin ID:', adminToEdit.id);
        console.log('🎯 Admin displayName:', adminToEdit.displayName);
        console.log('🎯 Admin email:', adminToEdit.email);
        console.log('🎯 Admin adminType:', adminToEdit.adminType);
        console.log('🎯 Full admin object:', JSON.stringify(adminToEdit, null, 2));
        console.log('🎯 =============================================');

        // Show alert to confirm which admin is being edited
        // alert(`Düzenleniyor: ${adminToEdit.displayName} (ID: ${adminToEdit.id})`);

        // 🔧 FIX: Map phoneNumber → phone for UI compatibility
        // Admin records in Firestore use 'phoneNumber', but UI uses 'phone'
        let phone = '';
        let dialCode = '+49';
        const storedPhone = (adminToEdit as any).phoneNumber || (adminToEdit as any).phone || '';

        if (storedPhone) {
            // Parse dial code from phone number if present
            for (const code of ['+90', '+49', '+43', '+41', '+1']) {
                if (storedPhone.startsWith(code)) {
                    dialCode = code;
                    phone = storedPhone.slice(code.length);
                    break;
                }
            }
            // If no dial code found, use raw number
            if (!phone) phone = storedPhone.replace(/^\+\d+/, '');
        }

        setEditingAdmin({
            ...adminToEdit,
            phone: phone,
            dialCode: dialCode,
        } as any);
        setEditRole(adminToEdit.adminType || 'kermes');
        setEditLocation(adminToEdit.location || '');
        setEditButcherId(adminToEdit.butcherId || '');
        setEditIsPrimaryAdmin((adminToEdit as any).isPrimaryAdmin || false); // 🟣 Load isPrimaryAdmin state

        // Load butchers if kasap role
        if (adminToEdit.adminType === 'kasap' || adminToEdit.adminType === 'kasap_staff') {
            loadButchersHelper();
        }
    };

    // Save edited admin
    const handleSaveAdmin = async () => {
        if (!editingAdmin) return;

        // 🔒 CRITICAL PROTECTION: Never allow editing super admin role
        if (editingAdmin.adminType === 'super') {
            showToast('❌ Super Admin rolü değiştirilemez!', 'error');
            return;
        }

        setSaving(true);
        try {
            // ═══════════════════════════════════════════════════════════════════
            // SPECIAL CASE: Demotion to 'user' - Deactivate admin record
            // ═══════════════════════════════════════════════════════════════════
            if (editRole === 'user') {
                console.log('🔻 DEMOTION TO USER: Deactivating admin record for', editingAdmin.displayName);

                // Deactivate admin record
                await updateDoc(doc(db, 'admins', editingAdmin.id), {
                    isActive: false,
                    adminType: null,
                    butcherId: null,
                    butcherName: null,
                    updatedAt: new Date(),
                    updatedBy: admin?.email || 'system',
                    deactivatedBy: admin?.email || admin?.displayName || 'system',
                    deactivatedAt: new Date(),
                    deactivationReason: 'Admin rolü kaldırıldı - Kullanıcıya indirgendi',
                });

                // Also update user record if exists (check both firebaseUid and admin.id)
                const adminData = editingAdmin as any;
                const userId = adminData.firebaseUid || adminData.uid || editingAdmin.id;
                if (userId) {
                    const userRef = doc(db, 'users', userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        await updateDoc(userRef, {
                            isAdmin: false,
                            adminType: null,
                            butcherId: null,
                            butcherName: null,
                            updatedAt: new Date(),
                        });
                        console.log('✅ User record also updated - demoted to regular user');
                    }
                }

                // 🔐 SECURITY: Use filtered reload function
                await reloadAdmins();

                setEditingAdmin(null);
                showToast('✅ Admin rolü kaldırıldı - Kullanıcıya indirgendi', 'success');
                setSaving(false);
                return;
            }

            // ═══════════════════════════════════════════════════════════════════
            // NORMAL CASE: Update admin with new role
            // ═══════════════════════════════════════════════════════════════════

            // Get selected butcher info
            const selectedButcher = butcherList.find(b => b.id === editButcherId);

            // CRITICAL FIX: Build update object explicitly
            // When role changes to 'super', FORCE clear business assignment
            // When role changes to another type, update business assignment
            const updateData: Record<string, unknown> = {
                displayName: editingAdmin.displayName || null,
                email: editingAdmin.email || null,
                phoneNumber: (editingAdmin as any).phone || null,
                dialCode: (editingAdmin as any).dialCode || '+49',
                address: (editingAdmin as any).address || null,
                houseNumber: (editingAdmin as any).houseNumber || null,
                city: (editingAdmin as any).city || null,
                postalCode: (editingAdmin as any).postalCode || null,
                country: (editingAdmin as any).country || 'Deutschland',
                adminType: editRole,
                location: editLocation || null,
                updatedAt: new Date(),
                // 🟣 Primary Admin (İşletme Sahibi) - only Super Admin can set
                isPrimaryAdmin: admin?.adminType === 'super' ? editIsPrimaryAdmin : (editingAdmin as any).isPrimaryAdmin || false,
            };

            // Handle business assignment based on role
            if (editRole === 'super') {
                // Super Admin: FORCE clear all business assignments
                updateData.butcherId = null;
                updateData.butcherName = null;
                console.log('🔄 Clearing business assignment for Super Admin');
            } else if (admin?.adminType !== 'super' && admin?.butcherId) {
                // 🔒 Business Admin saving: ALWAYS use their own business (RBAC restriction)
                updateData.butcherId = admin.butcherId;
                updateData.butcherName = admin.butcherName || null;
                console.log('🔄 Auto-assigning to business admin\'s business:', admin.butcherName);
            } else if (editButcherId && selectedButcher) {
                // Super Admin with business selected: Update business assignment
                updateData.butcherId = editButcherId;
                updateData.butcherName = `${selectedButcher.name} - ${selectedButcher.city}`;
                console.log('🔄 Setting business:', updateData.butcherName);
            } else if (editButcherId) {
                // Business ID but no matching butcher in list (edge case)
                updateData.butcherId = editButcherId;
                updateData.butcherName = editingAdmin.butcherName || null;
            } else {
                // No business selected: Clear assignment
                updateData.butcherId = null;
                updateData.butcherName = null;
                console.log('🔄 Clearing business assignment (no business selected)');
            }

            // 🔍 CRITICAL DEBUG: Log exact admin being updated
            console.log('📝 ============= ADMIN UPDATE DEBUG =============');
            console.log('📝 Admin ID being updated:', editingAdmin.id);
            console.log('📝 Admin name:', editingAdmin.displayName);
            console.log('📝 Admin email:', editingAdmin.email);
            console.log('📝 Current adminType:', editingAdmin.adminType);
            console.log('📝 New adminType:', editRole);
            console.log('📝 Update data:', JSON.stringify(updateData, null, 2));
            console.log('📝 =============================================');

            await updateDoc(doc(db, 'admins', editingAdmin.id), updateData);

            // 🔄 SYNC: Also update users collection for consistency
            // This ensures Super Admin panel and Business Admin panel show same data
            const adminData = editingAdmin as any;
            const userId = adminData.firebaseUid || adminData.uid || editingAdmin.id;
            if (userId) {
                try {
                    const userRef = doc(db, 'users', userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        // Parse firstName and lastName from displayName
                        const nameParts = (editingAdmin.displayName || '').split(' ');
                        const firstName = nameParts[0] || '';
                        const lastName = nameParts.slice(1).join(' ') || '';

                        await updateDoc(userRef, {
                            firstName: firstName,
                            lastName: lastName,
                            displayName: editingAdmin.displayName,
                            email: editingAdmin.email,
                            phoneNumber: ((adminData.dialCode || '+49') + (adminData.phone || '')).trim() || null,
                            dialCode: adminData.dialCode || '+49',
                            address: adminData.address || null,
                            houseNumber: adminData.houseNumber || null,
                            city: adminData.city || null,
                            postalCode: adminData.postalCode || null,
                            country: adminData.country || 'Deutschland',
                            isAdmin: true,
                            adminType: editRole,
                            butcherId: updateData.butcherId,
                            butcherName: updateData.butcherName,
                            updatedAt: new Date(),
                        });
                        console.log('✅ Users collection SYNCED with admin data');
                    }
                } catch (syncErr) {
                    console.log('ℹ️ Users collection sync skipped:', syncErr);
                }
            }

            // 🔐 SECURITY: Use filtered reload function
            await reloadAdmins();

            setEditingAdmin(null);
            showToast('Admin bilgileri güncellendi!', 'success');
        } catch (error) {
            console.error('Save admin error:', error);
            showToast('Kaydetme hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'), 'error');
        }
        setSaving(false);
    };

    // Create new user via API
    const handleCreateUser = async () => {
        // Email OR Phone is required (at least one contact method)
        if (!newUserEmail && !newUserPhone) {
            setCreateError('E-posta veya telefon numarasından en az biri zorunludur');
            return;
        }

        if (!newUserPassword || !newUserName) {
            setCreateError('Şifre ve isim alanları zorunludur');
            return;
        }

        // Password confirmation check
        if (newUserPassword !== newUserConfirmPassword) {
            setCreateError('Şifreler eşleşmiyor');
            return;
        }

        // For ANY business-related role (not just kasap), require business selection OR admin must have businessId
        // All roles that contain "_" or end with specific sector names need a business assignment
        const needsBusinessAssignment = newUserRole !== 'user' && newUserRole !== 'super';
        const hasBusinessId = selectedButcherId || admin?.butcherId;

        if (needsBusinessAssignment && !hasBusinessId) {
            setCreateError('İşletme rolleri için işletme seçimi veya ataması zorunludur');
            return;
        }

        setCreating(true);
        setCreateError('');

        // Get selected butcher info
        const selectedButcher = butcherList.find(b => b.id === selectedButcherId);

        // Determine businessId: use selectedButcherId, or fall back to admin's own butcherId for non-super admins
        // This works for ALL business types (kasap, market, restoran, kermes, cicekci, etc.)
        const effectiveBusinessId = selectedButcherId || (admin?.adminType !== 'super' ? admin?.butcherId : undefined);
        const effectiveBusinessName = selectedButcher
            ? `${selectedButcher.name} - ${selectedButcher.city}`
            : (admin?.adminType !== 'super' ? admin?.butcherName : undefined);

        try {
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail || undefined,
                    password: newUserPassword,
                    displayName: newUserName,
                    phone: newUserPhone || undefined,
                    role: newUserRole !== 'user' ? 'admin' : 'user',
                    adminType: newUserRole !== 'user' ? newUserRole : undefined,
                    location: newUserLocation || undefined,
                    // Send businessId for ALL business-related roles (kasap, market, restoran, kermes, etc.)
                    butcherId: needsBusinessAssignment ? effectiveBusinessId : undefined,
                    butcherName: needsBusinessAssignment ? effectiveBusinessName : undefined,
                    // 🟣 Primary Admin: If Super Admin is assigning a business admin, mark as primary (protected)
                    isPrimaryAdmin: admin?.adminType === 'super' && newUserRole !== 'user' && newUserRole !== 'super' && !newUserRole?.includes('_staff') ? true : undefined,
                    // Assigner details for welcome email
                    createdBy: admin?.email || admin?.id,
                    createdBySource: admin?.adminType === 'super' ? 'super_admin' : 'business_admin',
                    assignerName: admin?.displayName || admin?.firstName ? `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim() : 'Admin',
                    assignerEmail: admin?.email || '',
                    assignerPhone: admin?.phone || '',
                    assignerRole: admin?.adminType || 'admin',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setCreateError(data.error || 'Bir hata oluştu');
                setCreating(false);
                return;
            }

            // Success - close modal and refresh
            setShowCreateModal(false);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserConfirmPassword('');
            setNewUserPhone('');
            setNewUserName('');
            setNewUserRole('user');
            setNewUserLocation('');
            setSelectedButcherId('');

            // Refresh admins list if admin was created
            if (newUserRole !== 'user') {
                // 🔐 SECURITY: Use filtered reload function
                await reloadAdmins();
            }

            showToast(data.message, 'success');
        } catch (error) {
            console.error('Create user error:', error);
            setCreateError('Bağlantı hatası');
        }
        setCreating(false);
    };

    // Send invitation via SMS
    const handleSendInvitation = async () => {
        if (!newUserPhone) {
            setCreateError('Telefon numarası zorunludur');
            return;
        }

        if (newUserRole === 'user') {
            setCreateError('Bir rol seçmelisiniz');
            return;
        }

        // For kasap roles, require business selection OR admin must have butcherId
        if ((newUserRole === 'kasap' || newUserRole === 'kasap_staff') && !selectedButcherId && !admin?.butcherId) {
            setCreateError('İşletme seçimi zorunludur');
            return;
        }

        setCreating(true);
        setCreateError('');

        // For kasap admins with butcherId, use their own business
        // For super admin, use selected butcher
        const effectiveButcherId = admin?.butcherId || selectedButcherId;
        const selectedButcher = admin?.butcherId
            ? { name: admin.butcherName || 'Kasap', city: '' }
            : butcherList.find(b => b.id === selectedButcherId);

        try {
            const response = await fetch('/api/admin/send-invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: newUserPhone,
                    role: newUserRole,
                    businessId: effectiveButcherId || undefined,
                    businessName: selectedButcher ? `${selectedButcher.name}${selectedButcher.city ? ' - ' + selectedButcher.city : ''}` : undefined,
                    businessType: (newUserRole === 'kasap' || newUserRole === 'kasap_staff') ? 'kasap' : undefined,
                    invitedBy: admin?.id,
                    invitedByName: admin?.displayName || 'Admin',
                    invitedByEmail: admin?.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setCreateError(data.error || 'Bir hata oluştu');
                setCreating(false);
                return;
            }

            // Success - close create modal and open share modal
            const link = `https://miraportal.com/invite/${data.token}`;
            setInvitationLink(link);
            setInvitationToken(data.token);
            setInvitationPhone(newUserPhone);
            setInvitationRole(getRoleLabel(newUserRole) || newUserRole);
            setInvitationBusiness(selectedButcher ? `${selectedButcher.name} - ${selectedButcher.city}` : '');

            setShowCreateModal(false);
            setNewUserPhone('');
            setNewUserRole('user');
            setSelectedButcherId('');
            setCreateError('');
            setLinkCopied(false);

            // Show share modal
            setShowShareModal(true);
        } catch (error) {
            console.error('Send invitation error:', error);
            setCreateError('Bağlantı hatası');
        }
        setCreating(false);
    };

    // Trigger butcher loading when role assignment needs it
    // Load butchers whenever a role that needs business is selected
    useEffect(() => {
        // Any non-super role needs business selection
        const needsBusiness = assignRole && assignRole !== 'super';
        if (needsBusiness && butcherList.length === 0) {
            loadButchersHelper();
        }
    }, [assignRole, butcherList.length, loadButchersHelper]);

    useEffect(() => {
        // Any non-super role needs business selection in edit modal
        const needsBusiness = editRole && editRole !== 'super';
        if (needsBusiness && butcherList.length === 0) {
            loadButchersHelper();
        }
    }, [editRole, butcherList.length, loadButchersHelper]);

    // 🆕 Kermes rolleri için organizasyon yükleme
    useEffect(() => {
        const isKermesRole = assignRole === 'kermes' || assignRole === 'kermes_staff';
        if (isKermesRole && organizationList.length === 0) {
            loadOrganizationsHelper();
        }
    }, [assignRole, organizationList.length, loadOrganizationsHelper]);

    useEffect(() => {
        const isKermesRole = editRole === 'kermes' || editRole === 'kermes_staff';
        if (isKermesRole && organizationList.length === 0) {
            loadOrganizationsHelper();
        }
    }, [editRole, organizationList.length, loadOrganizationsHelper]);

    // Remove loadPendingInvitations - Moved to AdminHeader

    const handleLogout = async () => {
        await auth.signOut();
        // Force hard refresh to ensure clean state
        window.location.href = '/login';
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Toast Notification - CENTERED & PROMINENT */}
            {toast && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pointer-events-none pt-20">
                    <div
                        className={`pointer-events-auto px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce-in border-2 min-w-[400px] max-w-[600px] ${toast.type === 'success'
                            ? 'bg-green-600 text-white border-green-400'
                            : 'bg-red-600 text-white border-red-400'
                            }`}
                        style={{
                            boxShadow: toast.type === 'success'
                                ? '0 0 40px rgba(34, 197, 94, 0.5), 0 20px 50px rgba(0,0,0,0.4)'
                                : '0 0 40px rgba(239, 68, 68, 0.5), 0 20px 50px rgba(0,0,0,0.4)',
                            animation: 'slideDown 0.3s ease-out, pulse 2s infinite'
                        }}
                    >
                        <span className="text-4xl flex-shrink-0">{toast.type === 'success' ? '✅' : '❌'}</span>
                        <span className="font-bold text-lg flex-1">{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-2 text-white/80 hover:text-white text-2xl font-bold hover:scale-110 transition-transform"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
            {/* Header removed - moved to layout */}
            {/* Toolbars removed - now in AdminHeader component for consistency */}


            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-4 pt-6">
                {/* Tab navigation removed - filtering via dropdown now */}
            </div>

            <main className="max-w-7xl mx-auto px-4 pb-8">
                {/* User Search Tab */}
                {activeTab === 'users' && (
                    <div className="bg-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">👥 Kullanıcı Yönetimi</h2>
                            {/* Super Admin ve İşletme Sahipleri kullanıcı/personel ekleyebilir */}
                            {(admin?.adminType === 'super' || (admin?.adminType && !admin?.adminType?.includes('_staff'))) && (
                                <button
                                    onClick={() => {
                                        // İşletme admin ise staff rolünü ve sektörü otomatik doldur
                                        if (admin?.adminType !== 'super') {
                                            const adminSector = admin?.adminType?.replace('_admin', '').replace('_staff', '') || 'kasap';
                                            setNewUserData(prev => ({
                                                ...prev,
                                                role: 'staff',
                                                sector: adminSector,
                                            }));
                                        }
                                        setShowNewUserModal(true);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 font-medium flex items-center gap-2"
                                >
                                    ➕ Yeni Kullanıcı Ekle
                                </button>
                            )}
                        </div>

                        {/* Aktif / Arşivlenmiş Tabs - Matching Admin Tab */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setUserStatusFilter('active')}
                                className={`px-4 py-2 rounded-lg font-medium transition ${userStatusFilter === 'active'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                            >
                                ✅ Aktif ({users.filter(u => (u as any).isActive !== false).length})
                            </button>
                            <button
                                onClick={() => setUserStatusFilter('archived')}
                                className={`px-4 py-2 rounded-lg font-medium transition ${userStatusFilter === 'archived'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                            >
                                📦 Arşivlenmiş ({users.filter(u => (u as any).isActive === false).length})
                            </button>
                        </div>

                        {/* Search Input and Controls */}
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-3 mb-3">
                                <div className="relative flex-1 min-w-[300px]">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (e.target.value.length > 0) {
                                                if (showAllUsers) setShowAllUsers(false);
                                            } else {
                                                // When search is cleared, show all users again
                                                setShowAllUsers(true);
                                                loadAllUsers(1);
                                            }
                                        }}
                                        placeholder="İsim, soyisim, e-posta, telefon veya işletme adı ile ara..."
                                        className="w-full px-4 py-3 pl-12 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
                                    {searchLoading && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                        </span>
                                    )}
                                </div>

                                {/* All users is now default view - no button needed */}
                            </div>

                            {/* Sorting Controls (only when showing all users) */}
                            {showAllUsers && (
                                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                                    <span className="text-gray-400 text-sm">Sırala:</span>
                                    <select
                                        value={allUsersSortBy}
                                        onChange={(e) => setAllUsersSortBy(e.target.value as 'createdAt' | 'firstName' | 'lastName')}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500"
                                    >
                                        <option value="createdAt">📅 Kayıt Tarihi</option>
                                        <option value="firstName">👤 İsim (A-Z)</option>
                                        <option value="lastName">👤 Soyisim (A-Z)</option>
                                    </select>
                                    <select
                                        value={allUsersSortOrder}
                                        onChange={(e) => setAllUsersSortOrder(e.target.value as 'asc' | 'desc')}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500"
                                    >
                                        <option value="desc">⬇️ Yeniden Eskiye</option>
                                        <option value="asc">⬆️ Eskiden Yeniye</option>
                                    </select>

                                    {/* User Type Filter */}
                                    <select
                                        value={userTypeFilter}
                                        onChange={(e) => setUserTypeFilter(e.target.value as 'all' | 'user' | 'admin' | 'staff' | 'super' | 'driver' | 'driver_lokma' | 'driver_business')}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500"
                                    >
                                        <option value="all">👥 Tümü</option>
                                        <option value="user">👤 Sadece Kullanıcılar</option>
                                        <option value="admin">🎫 İşletme Adminleri</option>
                                        <option value="staff">👷 Personel</option>
                                        <option value="driver">🚗 Tüm Sürücüler</option>
                                        <option value="driver_lokma">🚚 LOKMA Filosu</option>
                                        <option value="driver_business">🏪 İşletme Sürücüleri</option>
                                        {/* 🔒 SECURITY: Super Admin filter only visible to super admins */}
                                        {admin?.adminType === 'super' && (
                                            <option value="super">👑 Super Admin</option>
                                        )}
                                    </select>

                                    {/* Pagination */}
                                    <div className="flex-1" />
                                    <span className="text-gray-400 text-sm">
                                        Sayfa {allUsersPage} / {Math.ceil(allUsersTotal / USERS_PER_PAGE) || 1}
                                    </span>
                                    <button
                                        onClick={() => loadAllUsers(allUsersPage - 1)}
                                        disabled={allUsersPage <= 1}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        ◀ Önceki
                                    </button>
                                    <button
                                        onClick={() => loadAllUsers(allUsersPage + 1)}
                                        disabled={allUsersPage >= Math.ceil(allUsersTotal / USERS_PER_PAGE)}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        Sonraki ▶
                                    </button>
                                </div>
                            )}

                            {!showAllUsers && (
                                <p className="text-gray-400 text-sm mt-2">
                                    İsim, soyisim, e-posta veya telefon ile kullanıcı arayın. Tüm listeyi görmek için "Tüm Kullanıcılar" butonunu kullanın.
                                </p>
                            )}
                        </div>

                        {/* Search Results */}
                        {users.length > 0 ? (
                            <div className="space-y-2">
                                {users.filter(user => {
                                    // Filter by status (active/archived) - MATCHING ADMIN TAB
                                    const matchesStatus = userStatusFilter === 'active'
                                        ? (user as any).isActive !== false
                                        : (user as any).isActive === false;
                                    if (!matchesStatus) return false;

                                    // Filter by type
                                    if (userTypeFilter === 'all') return true;
                                    if (userTypeFilter === 'user') return !user.isAdmin;
                                    if (userTypeFilter === 'admin') return user.isAdmin && user.adminType !== 'super' && !user.adminType?.includes('_staff');
                                    if (userTypeFilter === 'staff') return user.isAdmin && user.adminType?.includes('_staff');
                                    if (userTypeFilter === 'super') return user.isAdmin && user.adminType === 'super';
                                    if (userTypeFilter === 'driver') return (user.adminProfile as any)?.isDriver === true;
                                    if (userTypeFilter === 'driver_lokma') return (user.adminProfile as any)?.isDriver === true && (user.adminProfile as any)?.driverType === 'lokma_fleet';
                                    if (userTypeFilter === 'driver_business') return (user.adminProfile as any)?.isDriver === true && ((user.adminProfile as any)?.driverType === 'business' || !(user.adminProfile as any)?.driverType);
                                    return true;
                                })
                                    // 🔍 ENHANCED SEARCH: Also search by business name and PHONE
                                    .filter(user => {
                                        if (!searchQuery) return true;
                                        const q = searchQuery.toLowerCase();
                                        const qDigits = searchQuery.replace(/\D/g, ''); // Extract just digits for phone search
                                        const name = (user.displayName || '').toLowerCase();
                                        const firstName = ((user as any).firstName || '').toLowerCase();
                                        const lastName = ((user as any).lastName || '').toLowerCase();
                                        const email = (user.email || '').toLowerCase();
                                        const phone = ((user as any).phoneNumber || '');
                                        const phoneDigits = phone.replace(/\D/g, ''); // Normalize phone for digit comparison
                                        const businessName = ((user.adminProfile as any)?.butcherName || '').toLowerCase();
                                        const roleLabel = (getRoleLabel(user.adminType as string) || '').toLowerCase();

                                        // Text matches (name, email, business)
                                        const textMatch = name.includes(q) ||
                                            firstName.includes(q) ||
                                            lastName.includes(q) ||
                                            email.includes(q) ||
                                            businessName.includes(q) ||
                                            roleLabel.includes(q);

                                        // Phone match - compare digits only (supports partial match)
                                        const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);

                                        return textMatch || phoneMatch;
                                    }).map((user) => (
                                        <div
                                            key={user.id}
                                            onClick={() => {
                                                loadButchersHelper(); // Load business list when modal opens
                                                // CRITICAL: Parse displayName into firstName/lastName if not available
                                                let firstName = (user as any).firstName || '';
                                                let lastName = (user as any).lastName || '';
                                                if (!firstName && !lastName && user.displayName) {
                                                    const nameParts = user.displayName.trim().split(' ');
                                                    firstName = nameParts[0] || '';
                                                    lastName = nameParts.slice(1).join(' ') || '';
                                                }
                                                // Parse phone - strip country code if embedded in legacy format
                                                let phoneValue = user.phoneNumber || '';
                                                let parsedDialCode = (user as any).dialCode || '+49'; // Default Germany

                                                // Legacy phone numbers may have country code embedded (e.g., +495710057)
                                                // Extract it and set as dialCode, leave only local number
                                                if (phoneValue.startsWith('+')) {
                                                    // Try common country codes
                                                    for (const code of ['+49', '+90', '+43', '+41', '+1']) {
                                                        if (phoneValue.startsWith(code)) {
                                                            parsedDialCode = code;
                                                            phoneValue = phoneValue.slice(code.length);
                                                            break;
                                                        }
                                                    }
                                                }
                                                // Don't strip leading zeros - many countries use them (e.g., 0177-57100571)

                                                setEditingUserProfile({
                                                    userId: user.id,
                                                    firstName,
                                                    lastName,
                                                    email: user.email || '',
                                                    phone: phoneValue,
                                                    isAdmin: user.isAdmin || false,
                                                    adminType: user.adminType,
                                                    adminDocId: user.adminProfile?.id, // Store the actual admin doc ID
                                                    originalAdminType: user.adminType, // Track original role for change detection
                                                    butcherId: (user.adminProfile as any)?.butcherId || '', // Load existing business assignment
                                                    butcherName: (user.adminProfile as any)?.butcherName || '', // Load existing business name
                                                    organizationId: (user.adminProfile as any)?.organizationId || '', // 🆕 Load existing organization
                                                    organizationName: (user.adminProfile as any)?.organizationName || '', // 🆕 Load existing organization name
                                                    isActive: (user as any).isActive !== false, // Default true if undefined
                                                    photoURL: user.photoURL || (user as any).profileImageUrl, // Load existing photo
                                                    // 🟣 Load isPrimaryAdmin from admin record
                                                    isPrimaryAdmin: (user.adminProfile as any)?.isPrimaryAdmin || false,
                                                    isDriver: (user.adminProfile as any)?.isDriver || false, // 🚗 Load isDriver from admin record
                                                    driverType: (user.adminProfile as any)?.driverType || 'business', // 🚚 Load driverType
                                                    assignedTables: (user.adminProfile as any)?.assignedTables || [], // 🪑 Load assigned tables

                                                    // 🆕 ÇOKLU ROL DESTEĞİ - Mevcut rolden roles dizisi oluştur
                                                    roles: (user.adminProfile as any)?.roles || (user.isAdmin && user.adminType ? [{
                                                        type: user.adminType,
                                                        businessId: (user.adminProfile as any)?.butcherId || undefined,
                                                        businessName: (user.adminProfile as any)?.butcherName || undefined,
                                                        organizationId: (user.adminProfile as any)?.organizationId || undefined,
                                                        organizationName: (user.adminProfile as any)?.organizationName || undefined,
                                                        isPrimary: true,
                                                        isActive: true,
                                                        assignedAt: (user.adminProfile as any)?.createdAt || new Date(),
                                                        assignedBy: (user.adminProfile as any)?.createdBy || 'system'
                                                    }] : []),

                                                    // Address & Location
                                                    address: (user as any).address || '',
                                                    houseNumber: (user as any).houseNumber || '',
                                                    addressLine2: (user as any).addressLine2 || '',
                                                    city: (user as any).city || '',
                                                    country: (user as any).country || '',
                                                    postalCode: (user as any).postalCode || '',
                                                    dialCode: parsedDialCode,
                                                    latitude: (user as any).latitude,
                                                    longitude: (user as any).longitude,
                                                });
                                            }}
                                            className={`flex items-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition cursor-pointer group border-l-4 relative overflow-hidden ${(user as any).isActive !== false ? 'border-green-500' : 'border-red-500 opacity-90'
                                                }`}

                                        >
                                            <div className="flex items-center space-x-4 flex-1">
                                                {/* Profile Photo or Avatar */}
                                                {(user as any).photoURL || (user as any).profileImageUrl ? (
                                                    <img
                                                        src={(user as any).photoURL || (user as any).profileImageUrl}
                                                        alt=""
                                                        className={`w-12 h-12 rounded-full object-cover border-2 shrink-0 ${(user as any).isActive !== false ? 'border-gray-600 group-hover:border-gray-500' : 'border-red-500/50'
                                                            }`}
                                                    />
                                                ) : (
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${(user as any).isActive !== false ? 'bg-gray-600 group-hover:bg-gray-500' : 'bg-red-900/30 text-red-200'
                                                        }`}>
                                                        {(user as any).firstName?.charAt(0)?.toUpperCase() || user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {/* Name with Role Badge and Location */}
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <p className={`font-medium ${(user as any).isActive !== false ? 'text-white' : 'text-gray-300'
                                                            }`}>
                                                            {(user as any).firstName && (user as any).lastName
                                                                ? `${(user as any).firstName} ${(user as any).lastName}`
                                                                : user.displayName || 'İsimsiz Kullanıcı'}
                                                        </p>

                                                        {/* Status Badge */}
                                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${(user as any).isActive !== false
                                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                            }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${(user as any).isActive !== false ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                                                }`}></span>
                                                            {(user as any).isActive !== false ? 'AKTİF' : 'PASİF'}
                                                        </span>

                                                        {/* Role Badge - Color coded by role type */}
                                                        {user.isAdmin ? (
                                                            user.adminType === 'super' ? (
                                                                // 🔴 SUPER ADMIN - Red
                                                                <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-medium">
                                                                    👑 Süper Admin
                                                                </span>
                                                            ) : user.adminType?.includes('_staff') ? (
                                                                // 🟢 STAFF/PERSONEL - Green
                                                                <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-medium">
                                                                    {(getRoleLabel(user.adminType as string) || user.adminType || 'Personel').toUpperCase()}
                                                                    {(user.adminProfile as any)?.butcherName && ` | ${(user.adminProfile as any).butcherName}`}
                                                                </span>
                                                            ) : (
                                                                // 🟠 BUSINESS ADMIN - Orange (or 🟣 Purple if Primary Admin)
                                                                <span className={`px-2 py-0.5 text-white rounded-full text-xs font-medium ${(user.adminProfile as any)?.isPrimaryAdmin
                                                                    ? 'bg-purple-600'
                                                                    : 'bg-amber-500'
                                                                    }`}>
                                                                    {(user.adminProfile as any)?.isPrimaryAdmin && '👑 '}
                                                                    {(getRoleLabel(user.adminType as string) || user.adminType || 'Admin').toUpperCase()}
                                                                    {(user.adminProfile as any)?.butcherName && ` | ${(user.adminProfile as any).butcherName}`}
                                                                </span>
                                                            )
                                                        ) : (
                                                            // 🔵 USER/KULLANICI - Blue
                                                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-medium">
                                                                Kullanıcı
                                                            </span>
                                                        )}
                                                        {/* 🚚 Driver Type Badge */}
                                                        {(user.adminProfile as any)?.isDriver && (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(user.adminProfile as any)?.driverType === 'lokma_fleet'
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-amber-600 text-white'
                                                                }`}>
                                                                {(user.adminProfile as any)?.driverType === 'lokma_fleet' ? '🚚 LOKMA Filo' : '🏪 İşletme Sürücü'}
                                                            </span>
                                                        )}
                                                        {/* Location - City, Country */}
                                                        {((user as any).country || (user as any).city) && (
                                                            <span className="text-gray-400 text-sm flex items-center gap-1">
                                                                <span>📍</span>
                                                                {(user as any).city || ''}{(user as any).city && (user as any).country ? ', ' : ''}{(user as any).country || ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right side - Business info + Action buttons (matching Admin tab) */}
                                            <div className="flex items-center gap-4 ml-4 shrink-0">
                                                {/* Business Assignment (if admin) */}
                                                {user.isAdmin && (user.adminProfile as any)?.butcherName && (
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-gray-300 font-medium text-sm">
                                                            {(user.adminProfile as any).butcherName}
                                                        </p>
                                                        <p className="text-gray-500 text-xs flex items-center justify-end gap-1">
                                                            🇩🇪 {(user as any).postalCode || '41836'} {(user as any).city || 'Hückelhoven'}
                                                        </p>
                                                    </div>
                                                )}
                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {/* Edit Button */}
                                                    <button
                                                        className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition"
                                                        title="Düzenle"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {/* Archive/Activate Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isActive = (user as any).isActive !== false;
                                                            setConfirmState({
                                                                isOpen: true,
                                                                title: isActive ? 'Kullanıcıyı Arşivle' : 'Kullanıcıyı Aktifleştir',
                                                                message: isActive
                                                                    ? `${user.displayName} adlı kullanıcıyı arşivlemek istediğinize emin misiniz?`
                                                                    : `${user.displayName} adlı kullanıcıyı tekrar aktifleştirmek istediğinize emin misiniz?`,
                                                                itemName: user.displayName || user.email,
                                                                variant: isActive ? 'warning' : undefined,
                                                                confirmText: isActive ? 'Evet, Arşivle' : 'Evet, Aktifleştir',
                                                                onConfirm: async () => {
                                                                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                    const userRef = doc(db, 'users', user.id);
                                                                    const now = new Date();
                                                                    if (isActive) {
                                                                        await updateDoc(userRef, {
                                                                            isActive: false,
                                                                            deactivatedAt: now,
                                                                            deactivationReason: 'Admin panelinden arşivlendi',
                                                                        }).then(() => {
                                                                            showToast(`${user.displayName} arşivlendi`, 'success');
                                                                            loadAllUsers(allUsersPage);
                                                                        });
                                                                    } else {
                                                                        await updateDoc(userRef, {
                                                                            isActive: true,
                                                                            deactivatedAt: null,
                                                                            deactivationReason: null,
                                                                        }).then(() => {
                                                                            showToast(`${user.displayName} tekrar aktifleştirildi`, 'success');
                                                                            loadAllUsers(allUsersPage);
                                                                        });
                                                                    }
                                                                },
                                                            });
                                                        }}
                                                        className={`p-2 rounded-lg transition ${(user as any).isActive !== false
                                                            ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white'
                                                            : 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white'}`}
                                                        title={(user as any).isActive !== false ? 'Arşivle' : 'Aktifleştir'}
                                                    >
                                                        {(user as any).isActive !== false ? '📦' : '✅'}
                                                    </button>
                                                    {/* Arrow indicator */}
                                                    <div className="text-gray-500 group-hover:text-white transition text-xl">
                                                        →
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}


                            </div>
                        ) : (searchQuery && !searchLoading) || showAllUsers ? (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-4xl mb-4">🔍</p>
                                <p>Sonuç bulunamadı</p>
                            </div>
                        ) : allUsersLoading ? (
                            <div className="text-center py-12 text-gray-400">
                                <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p>Kullanıcılar yükleniyor...</p>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-4xl mb-4">👆</p>
                                <p>Aramaya başlamak için yukarıya yazın veya "Tüm Kullanıcılar" butonunu kullanın</p>
                            </div>
                        )}
                    </div>
                )
                }

                {/* Admins Tab */}
                {
                    activeTab === 'admins' && (
                        <div className="bg-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">Mevcut Adminler</h2>
                                <button
                                    onClick={() => {
                                        // 🔧 CRITICAL FIX: Set the correct state for showNewUserModal
                                        // Extract admin's sector from their adminType (e.g., kasap_admin → kasap)
                                        const adminSector = admin?.adminType?.replace('_admin', '').replace('_staff', '') || 'kasap';

                                        // Pre-populate newUserData with staff role and admin's sector
                                        setNewUserData(prev => ({
                                            ...prev,
                                            role: 'staff',  // Default to staff for business admin
                                            sector: adminSector,  // Auto-fill with admin's sector
                                        }));
                                        setShowNewUserModal(true);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 font-medium flex items-center gap-2"
                                >
                                    ➕ Yeni Personel Ekle
                                </button>
                            </div>

                            {/* Aktif / Arşivlenmiş Tabs */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setAdminStatusFilter('active')}
                                    className={`px-4 py-2 rounded-lg font-medium transition ${adminStatusFilter === 'active'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    ✅ Aktif ({admins.filter(a => a.isActive !== false).length})
                                </button>
                                <button
                                    onClick={() => setAdminStatusFilter('archived')}
                                    className={`px-4 py-2 rounded-lg font-medium transition ${adminStatusFilter === 'archived'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    📦 Arşivlenmiş ({admins.filter(a => a.isActive === false).length})
                                </button>
                            </div>

                            {/* Search and Filter Controls - Matching Users Tab */}
                            <div className="space-y-4 mb-6">
                                {/* Search Bar */}
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="İsim, e-posta veya telefon ile ara..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                                    <span className="text-gray-400 text-sm">Filtrele:</span>
                                    <select
                                        value={adminFilter}
                                        onChange={(e) => setAdminFilter(e.target.value as 'all' | 'business' | 'staff' | 'super')}
                                        className="px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500"
                                    >
                                        <option value="all">👥 Tümü</option>
                                        <option value="business">🎫 İşletme Adminleri</option>
                                        <option value="staff">👷 Personel</option>
                                        {/* 🔒 SECURITY: Super Admin filter only visible to super admins */}
                                        {admin?.adminType === 'super' && (
                                            <option value="super">👑 Super Admin</option>
                                        )}
                                    </select>
                                    <span className="text-gray-400 text-sm ml-auto">
                                        {admins.filter(a => {
                                            // Filter by search
                                            const matchesSearch = !searchQuery ||
                                                a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                a.phone?.includes(searchQuery);
                                            // Filter by type
                                            const matchesFilter = adminFilter === 'all' ||
                                                (adminFilter === 'super' && a.adminType === 'super') ||
                                                (adminFilter === 'staff' && a.adminType?.includes('_staff')) ||
                                                (adminFilter === 'business' && a.adminType !== 'super' && !a.adminType?.includes('_staff'));
                                            return matchesSearch && matchesFilter;
                                        }).length} admin gösteriliyor
                                    </span>
                                </div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="text-gray-400 border-b border-gray-700">
                                    <tr>
                                        <th className="pb-3 py-2">Kullanıcı</th>
                                        <th className="pb-3 py-2">Rol</th>
                                        <th className="pb-3 py-2">Konum</th>
                                        <th className="pb-3 py-2">Durum</th>
                                        <th className="pb-3 py-2">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="text-white">
                                    {admins.filter(a => {
                                        // Filter by search
                                        const matchesSearch = !searchQuery ||
                                            a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            a.phone?.includes(searchQuery);
                                        // Filter by type
                                        const matchesFilter = adminFilter === 'all' ||
                                            (adminFilter === 'super' && a.adminType === 'super') ||
                                            (adminFilter === 'staff' && a.adminType?.includes('_staff')) ||
                                            (adminFilter === 'business' && a.adminType !== 'super' && !a.adminType?.includes('_staff'));
                                        // Filter by status (active/archived)
                                        const matchesStatus = adminStatusFilter === 'active'
                                            ? a.isActive !== false
                                            : a.isActive === false;
                                        return matchesSearch && matchesFilter && matchesStatus;
                                    }).length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-400">
                                                    <p className="text-2xl mb-2">👥</p>
                                                    <p>{adminStatusFilter === 'archived' ? 'Arşivlenmiş admin bulunamadı' : 'Admin bulunamadı'}</p>
                                                </td>
                                            </tr>
                                        )}
                                    {admins.filter(a => {
                                        const matchesSearch = !searchQuery ||
                                            a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            a.phone?.includes(searchQuery);
                                        const matchesFilter = adminFilter === 'all' ||
                                            (adminFilter === 'super' && a.adminType === 'super') ||
                                            (adminFilter === 'staff' && a.adminType?.includes('_staff')) ||
                                            (adminFilter === 'business' && a.adminType !== 'super' && !a.adminType?.includes('_staff'));
                                        // Filter by status (active/archived)
                                        const matchesStatus = adminStatusFilter === 'active'
                                            ? a.isActive !== false
                                            : a.isActive === false;
                                        return matchesSearch && matchesFilter && matchesStatus;
                                    }).map((a) => (
                                        <tr key={a.id} className="border-b border-gray-700 hover:bg-gray-750">
                                            <td className="py-4">
                                                <div>
                                                    <p className="font-medium">{a.displayName}</p>
                                                    <p className="text-gray-400 text-sm">{a.email}</p>
                                                    <p className="text-gray-500 text-xs font-mono">ID: {a.id}</p>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                {/* 🟣 Primary Admin (İşletme Sahibi) - Purple */}
                                                {(a as any).isPrimaryAdmin ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-purple-600 text-white font-medium">
                                                        👑 {getRoleLabel(a.adminType) || a.adminType} / İşletme Sahibi
                                                    </span>
                                                ) : a.adminType === 'super' ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-red-600 text-white">
                                                        👑 Super Admin
                                                    </span>
                                                ) : a.adminType?.includes('_staff') ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">
                                                        {getRoleIcon(a.adminType)} {getRoleLabel(a.adminType) || a.adminType}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded text-xs bg-amber-500 text-white">
                                                        {getRoleIcon(a.adminType)} {getRoleLabel(a.adminType) || a.adminType}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 text-gray-400">
                                                {(a as Admin & { location?: string }).location || '-'}
                                            </td>
                                            <td className="py-4">
                                                <span className={`px-2 py-1 rounded text-xs ${a.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
                                                    {a.isActive ? 'Aktif' : 'Devre Dışı'}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                {/* Super Admin ve Primary Admin için işlem butonları kontrol */}
                                                {a.role !== 'super_admin' && a.adminType !== 'super' && (
                                                    <div className="flex space-x-2 flex-wrap gap-1">
                                                        {/* Düzenle - herkes için göster */}
                                                        <button
                                                            onClick={() => handleEditAdmin(a)}
                                                            className="text-blue-400 hover:text-blue-300 text-sm"
                                                        >
                                                            ✏️ Düzenle
                                                        </button>

                                                        {/* 🛡️ Primary Admin Koruması: Arşivle, Yetkiyi Kaldır, Sil butonları GİZLİ (Super Admin hariç) */}
                                                        {(admin?.adminType === 'super' || !(a as any).isPrimaryAdmin) && (
                                                            <>
                                                                {/* Arşivle / Aktifleştir toggle button */}
                                                                <button
                                                                    onClick={() => {
                                                                        const isActive = a.isActive !== false;
                                                                        setConfirmState({
                                                                            isOpen: true,
                                                                            title: isActive ? 'Admin Arşivle' : 'Admin Aktifleştir',
                                                                            message: isActive
                                                                                ? `${a.displayName} adlı admini arşivlemek istediğinize emin misiniz?`
                                                                                : `${a.displayName} adlı admini tekrar aktifleştirmek istediğinize emin misiniz?`,
                                                                            itemName: a.displayName,
                                                                            variant: isActive ? 'warning' : undefined,
                                                                            confirmText: isActive ? 'Evet, Arşivle' : 'Evet, Aktifleştir',
                                                                            onConfirm: async () => {
                                                                                setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                                try {
                                                                                    const adminRef = doc(db, 'admins', a.id);
                                                                                    const now = new Date();
                                                                                    if (isActive) {
                                                                                        // Deactivate (archive)
                                                                                        await updateDoc(adminRef, {
                                                                                            isActive: false,
                                                                                            deactivatedBy: admin?.email || 'system',
                                                                                            deactivatedAt: now,
                                                                                            deactivationReason: 'Admin panelinden arşivlendi',
                                                                                            updatedAt: now,
                                                                                            updatedBy: admin?.email || 'system',
                                                                                        });
                                                                                        showToast(`${a.displayName} arşivlendi`, 'success');
                                                                                    } else {
                                                                                        // Reactivate
                                                                                        await updateDoc(adminRef, {
                                                                                            isActive: true,
                                                                                            deactivatedBy: null,
                                                                                            deactivatedAt: null,
                                                                                            deactivationReason: null,
                                                                                            updatedAt: now,
                                                                                            updatedBy: admin?.email || 'system',
                                                                                        });
                                                                                        showToast(`${a.displayName} tekrar aktifleştirildi`, 'success');
                                                                                    }
                                                                                    // 🔐 SECURITY: Use filtered reload function
                                                                                    await reloadAdmins();
                                                                                } catch (error) {
                                                                                    console.error('Archive/activate error:', error);
                                                                                    showToast('İşlem sırasında hata oluştu', 'error');
                                                                                }
                                                                            },
                                                                        });
                                                                    }}
                                                                    className={`text-sm ${a.isActive !== false ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'}`}
                                                                >
                                                                    {a.isActive !== false ? '📦 Arşivle' : '✅ Aktifleştir'}
                                                                </button>
                                                                {/* Yetkiyi Kaldır (soft delete - removes admin role) */}
                                                                <button
                                                                    onClick={() => handleRemoveAdmin(a.id, a.displayName)}
                                                                    className="text-amber-400 hover:text-amber-300 text-sm"
                                                                >
                                                                    🚫 Yetkiyi Kaldır
                                                                </button>
                                                                {/* Kalıcı Sil button */}
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmState({
                                                                            isOpen: true,
                                                                            title: 'Admini Kalıcı Sil',
                                                                            message: 'DİKKAT: Bu admini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!',
                                                                            itemName: a.displayName,
                                                                            variant: 'danger',
                                                                            confirmText: 'Evet, Kalıcı Sil',
                                                                            onConfirm: async () => {
                                                                                setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                                try {
                                                                                    // Delete from admins collection
                                                                                    await deleteDoc(doc(db, 'admins', a.id));
                                                                                    showToast(`${a.displayName} kalıcı olarak silindi`, 'success');
                                                                                    // 🔐 SECURITY: Use filtered reload function
                                                                                    await reloadAdmins();
                                                                                } catch (error) {
                                                                                    console.error('Delete error:', error);
                                                                                    showToast('Silme sırasında hata oluştu', 'error');
                                                                                }
                                                                            },
                                                                        });
                                                                    }}
                                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                                >
                                                                    🗑️ Sil
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
            </main >

            {/* Role Assignment Modal */}
            {
                selectedUser && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl">
                            <h3 className="text-xl font-bold text-white mb-4">Admin Rolü Ata</h3>

                            <div className="bg-gray-700 rounded-lg p-4 mb-6">
                                <p className="text-white font-medium">{selectedUser.displayName || 'İsimsiz'}</p>
                                <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-gray-300 text-sm mb-2">Admin Rolü</label>
                                    <select
                                        value={assignRole}
                                        onChange={(e) => setAssignRole(e.target.value as AdminType)}
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    >
                                        {getAllRoles().map((role) => (
                                            <option key={role.value} value={role.value}>{role.icon} {role.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Business Selection - for kasap/restoran roles */}
                                {(assignRole === 'kasap' || assignRole === 'kasap_staff' || assignRole === 'restoran' || assignRole === 'restoran_staff') && (
                                    <div>
                                        <label className="block text-gray-300 text-sm mb-2">🏪 İşletme Seçin</label>
                                        {selectedButcherId && (
                                            <div className="mb-2 px-4 py-2 bg-green-600/20 border border-green-500 rounded-lg flex items-center justify-between">
                                                <span className="text-green-400">
                                                    ✅ {butcherList.find(b => b.id === selectedButcherId)?.name || 'Seçili'}
                                                </span>
                                                <button
                                                    onClick={() => setSelectedButcherId('')}
                                                    className="text-green-400 hover:text-green-300"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            placeholder="İşletme ara..."
                                            value={assignLocation}
                                            onChange={(e) => setAssignLocation(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                        {assignLocation && (
                                            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-700 rounded-lg border border-gray-600">
                                                {butcherList
                                                    .filter(b =>
                                                        b.name.toLowerCase().includes(assignLocation.toLowerCase()) ||
                                                        b.city.toLowerCase().includes(assignLocation.toLowerCase()) ||
                                                        b.postalCode.includes(assignLocation)
                                                    )
                                                    .slice(0, 5)
                                                    .map(b => (
                                                        <button
                                                            key={b.id}
                                                            onClick={() => {
                                                                setSelectedButcherId(b.id);
                                                                setAssignLocation('');
                                                            }}
                                                            className="w-full px-4 py-3 text-left hover:bg-gray-600 border-b border-gray-600 last:border-b-0 text-white"
                                                        >
                                                            <p className="font-medium">{b.name}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {b.country === 'TR' ? '🇹🇷' : '🇩🇪'} {b.postalCode} {b.city}
                                                            </p>
                                                        </button>
                                                    ))
                                                }
                                                {butcherList.filter(b =>
                                                    b.name.toLowerCase().includes(assignLocation.toLowerCase()) ||
                                                    b.city.toLowerCase().includes(assignLocation.toLowerCase()) ||
                                                    b.postalCode.includes(assignLocation)
                                                ).length === 0 && (
                                                        <p className="px-4 py-3 text-gray-400 text-sm">İşletme bulunamadı</p>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                    disabled={assigning}
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleAssignRole}
                                    disabled={assigning}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                                >
                                    {assigning ? 'Atanıyor...' : '✓ Rolü Ata'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create User Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span>📱</span> Admin Davetiyesi Gönder
                            </h3>

                            {createError && (
                                <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
                                    {createError}
                                </div>
                            )}

                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                                <p className="text-blue-400 text-sm">
                                    📋 Davet edilen kişiye SMS gönderilecek. Link üzerinden profilini tamamlayıp kayıt olacak.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Phone Number - Primary Field */}
                                <div>
                                    <label htmlFor="invitePhone" className="block text-gray-400 text-sm mb-1">
                                        📱 Telefon Numarası *
                                    </label>
                                    <input
                                        id="invitePhone"
                                        type="tel"
                                        value={newUserPhone}
                                        onChange={(e) => setNewUserPhone(e.target.value)}
                                        placeholder="+49 178 444 3475"
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 text-lg"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Bu numaraya davet SMS&apos;i gönderilecek
                                    </p>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label htmlFor="inviteRole" className="block text-gray-400 text-sm mb-1">
                                        👔 Rol Seçimi *
                                    </label>
                                    <select
                                        id="inviteRole"
                                        value={newUserRole}
                                        onChange={(e) => {
                                            const role = e.target.value as AdminType | 'user';
                                            setNewUserRole(role);
                                            if ((role === 'kasap' || role === 'kasap_staff') && butcherList.length === 0) {
                                                loadButchersHelper();
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500"
                                    >
                                        <option value="user" disabled>-- Rol Seçin --</option>
                                        <option value="kasap">🥩 Kasap Sahibi (Owner)</option>
                                        <option value="kasap_staff">👷 Kasap Personel (Staff)</option>
                                        <option value="restoran">🍽️ Restoran Sahibi</option>
                                        <option value="restoran_staff">👨‍🍳 Restoran Personel</option>
                                        <option value="kermes">🎪 Kermes Admin</option>
                                        <option value="bakkal">🏪 Bakkal Admin</option>
                                        <option value="hali_yikama">🧹 Halı Yıkama Admin</option>
                                        <option value="transfer_surucu">✈️ Transfer Sürücü</option>
                                        <option value="tur_rehberi">🗺️ Tur Rehberi</option>
                                    </select>
                                </div>

                                {/* Business Selection - Shows for kasap roles */}
                                {(newUserRole === 'kasap' || newUserRole === 'kasap_staff') && (
                                    <div>
                                        <label htmlFor="selectedButcher" className="block text-gray-400 text-sm mb-1">
                                            🏪 İşletme {admin?.adminType === 'super' ? '* (Zorunlu)' : ''}
                                        </label>

                                        {/* If admin is a kasap admin with butcherId, show auto-assigned info */}
                                        {admin?.butcherId && admin?.adminType !== 'super' ? (
                                            <div className="w-full px-4 py-3 bg-green-900/30 border border-green-600 text-green-400 rounded-lg">
                                                <span className="font-medium">✓ {admin.butcherName || 'Senin Kasabın'}</span>
                                                <p className="text-xs text-green-500 mt-1">
                                                    Personel davetiyesi kendi işletmene otomatik atanır
                                                </p>
                                            </div>
                                        ) : loadingButchers ? (
                                            <div className="w-full px-4 py-3 bg-gray-700 text-gray-400 rounded-lg">
                                                Kasaplar yükleniyor...
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {/* Seçili işletme gösterimi */}
                                                {selectedButcherId ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 px-3 py-2 bg-green-900/30 border border-green-600 text-green-200 rounded-lg">
                                                            ✅ {butcherList.find(b => b.id === selectedButcherId)?.name || 'Seçildi'}
                                                            <span className="text-xs text-green-400 ml-2">
                                                                - {butcherList.find(b => b.id === selectedButcherId)?.city}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedButcherId('');
                                                                setBusinessSearchFilter('');
                                                            }}
                                                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={businessSearchFilter}
                                                            onChange={(e) => setBusinessSearchFilter(e.target.value)}
                                                            placeholder="🔍 İşletme adı veya şehir yazın (en az 3 karakter)..."
                                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500"
                                                        />
                                                        {businessSearchFilter.length > 0 && businessSearchFilter.length < 3 && (
                                                            <p className="text-yellow-400 text-xs mt-1">
                                                                ⏳ En az 3 karakter yazın...
                                                            </p>
                                                        )}

                                                        {/* Arama Sonuçları */}
                                                        {businessSearchFilter.length >= 3 && (
                                                            <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg">
                                                                {(() => {
                                                                    const searchLower = businessSearchFilter.toLowerCase();
                                                                    const filtered = butcherList.filter(b =>
                                                                        b.name.toLowerCase().includes(searchLower) ||
                                                                        b.city.toLowerCase().includes(searchLower) ||
                                                                        b.postalCode?.includes(searchLower)
                                                                    ).slice(0, 15);

                                                                    if (filtered.length === 0) {
                                                                        return (
                                                                            <div className="p-3 text-gray-400 text-center">
                                                                                ❌ "{businessSearchFilter}" için sonuç bulunamadı
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return filtered.map(b => (
                                                                        <button
                                                                            key={b.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedButcherId(b.id);
                                                                                setBusinessSearchFilter('');
                                                                            }}
                                                                            className="w-full text-left px-4 py-3 hover:bg-green-600/30 border-b border-gray-700 last:border-b-0 transition"
                                                                        >
                                                                            <div className="font-medium text-white">{b.name}</div>
                                                                            <div className="text-sm text-gray-400">
                                                                                {b.country === 'TR' ? '🇹🇷' : '🇩🇪'} {b.postalCode && `${b.postalCode}`} {b.city}
                                                                                {b.types?.length > 0 && (
                                                                                    <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">
                                                                                        {b.types.join(', ').toUpperCase()}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </button>
                                                                    ));
                                                                })()}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Only show warning for super admin dropdown */}
                                        {admin?.adminType === 'super' && !admin?.butcherId && (
                                            <p className="text-xs text-yellow-500 mt-1">
                                                ⚠️ Doğru işletmeyi seçtiğinizden emin olun!
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Info Box */}
                                <div className="bg-gray-700/50 rounded-lg p-3 mt-2">
                                    <p className="text-gray-400 text-xs">
                                        <strong>Davetiye içeriği:</strong><br />
                                        &quot;{admin?.displayName || 'Admin'} sizi MIRA Admin olarak davet etti.
                                        {selectedButcherId && butcherList.find(b => b.id === selectedButcherId) && (
                                            <> İşletme: {butcherList.find(b => b.id === selectedButcherId)?.name}</>
                                        )}
                                        &quot;
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setCreateError('');
                                        setNewUserPhone('');
                                        setNewUserRole('user');
                                        setSelectedButcherId('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSendInvitation}
                                    disabled={creating || !newUserPhone || newUserRole === 'user'}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>Gönderiliyor...</>
                                    ) : (
                                        <>📱 Davetiye Gönder</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Invitation Share Modal */}
            {
                showShareModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span>✅</span> Davetiye Oluşturuldu!
                            </h3>

                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                                <div className="text-sm text-gray-400 mb-2">Davet Detayları:</div>
                                <div className="text-white font-medium">{invitationRole}</div>
                                {invitationBusiness && (
                                    <div className="text-gray-300 text-sm">{invitationBusiness}</div>
                                )}
                                <div className="text-gray-400 text-sm mt-1">📱 {invitationPhone}</div>
                            </div>

                            {/* Invitation Link */}
                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm mb-2">🔗 Davet Linki</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={invitationLink}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(invitationLink);
                                            setLinkCopied(true);
                                            setTimeout(() => setLinkCopied(false), 2000);
                                        }}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${linkCopied
                                            ? 'bg-green-600 text-white'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                    >
                                        {linkCopied ? '✓ Kopyalandı' : '📋 Kopyala'}
                                    </button>
                                </div>
                            </div>

                            {/* Share Options */}
                            <div className="space-y-3">
                                <div className="text-gray-400 text-sm font-medium">📤 Davetiye Gönder:</div>

                                {/* WhatsApp */}
                                <a
                                    href={`https://wa.me/${invitationPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                        `🎉 MIRA Admin Davetiyesi\n\n` +
                                        `Sizin için bir admin hesabı oluşturuldu:\n` +
                                        `📌 Rol: ${invitationRole}\n` +
                                        (invitationBusiness ? `🏪 İşletme: ${invitationBusiness}\n` : '') +
                                        `\nProfilinizi tamamlamak için:\n${invitationLink}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <span className="text-xl">📱</span>
                                    <span className="font-medium">WhatsApp ile Gönder</span>
                                </a>

                                {/* SMS */}
                                <a
                                    href={`sms:${invitationPhone}?body=${encodeURIComponent(
                                        `MIRA Admin Davetiyesi: ${invitationLink}`
                                    )}`}
                                    className="flex items-center gap-3 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <span className="text-xl">💬</span>
                                    <span className="font-medium">SMS ile Gönder</span>
                                </a>

                                {/* Email */}
                                <a
                                    href={`mailto:?subject=${encodeURIComponent('MIRA Admin Davetiyesi')}&body=${encodeURIComponent(
                                        `Merhaba,\n\n` +
                                        `Sizin için MIRA Admin Portal'da bir hesap oluşturuldu.\n\n` +
                                        `📌 Rol: ${invitationRole}\n` +
                                        (invitationBusiness ? `🏪 İşletme: ${invitationBusiness}\n` : '') +
                                        `\nProfilinizi tamamlamak için aşağıdaki linke tıklayın:\n${invitationLink}\n\n` +
                                        `Saygılarımızla,\nMIRA Ekibi`
                                    )}`}
                                    className="flex items-center gap-3 w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    <span className="text-xl">📧</span>
                                    <span className="font-medium">E-posta ile Gönder</span>
                                </a>

                                {/* Telegram */}
                                <a
                                    href={`https://t.me/share/url?url=${encodeURIComponent(invitationLink)}&text=${encodeURIComponent(
                                        `🎉 MIRA Admin Davetiyesi\nRol: ${invitationRole}${invitationBusiness ? `\nİşletme: ${invitationBusiness}` : ''}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 w-full px-4 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                                >
                                    <span className="text-xl">✈️</span>
                                    <span className="font-medium">Telegram ile Gönder</span>
                                </a>
                            </div>

                            <button
                                onClick={() => setShowShareModal(false)}
                                className="w-full mt-6 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Pending Invitations Modal Removed - Fully Cleaned up */}

            {/* Edit Admin Modal - COMPREHENSIVE FORMAT */}
            {
                editingAdmin && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl my-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">✏️ Admin Düzenle</h3>
                                <button onClick={() => setEditingAdmin(null)} className="text-gray-400 hover:text-white text-2xl">✕</button>
                            </div>

                            <div className="space-y-6">
                                {/* 📝 Kişisel Bilgiler */}
                                <div>
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                        📝 Kişisel Bilgiler
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">Ad</label>
                                            <input
                                                type="text"
                                                value={(editingAdmin.displayName || '').split(' ')[0] || ''}
                                                onChange={(e) => {
                                                    const lastName = (editingAdmin.displayName || '').split(' ').slice(1).join(' ') || '';
                                                    setEditingAdmin({
                                                        ...editingAdmin,
                                                        displayName: `${e.target.value} ${lastName}`.trim()
                                                    });
                                                }}
                                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                placeholder="Ad"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">Soyad</label>
                                            <input
                                                type="text"
                                                value={(editingAdmin.displayName || '').split(' ').slice(1).join(' ') || ''}
                                                onChange={(e) => {
                                                    const firstName = (editingAdmin.displayName || '').split(' ')[0] || '';
                                                    setEditingAdmin({
                                                        ...editingAdmin,
                                                        displayName: `${firstName} ${e.target.value}`.trim()
                                                    });
                                                }}
                                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                placeholder="Soyad"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 📞 İletişim Bilgileri */}
                                <div>
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                        📞 İletişim Bilgileri
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">E-posta</label>
                                            <input
                                                type="email"
                                                value={editingAdmin.email || ''}
                                                onChange={(e) => setEditingAdmin({ ...editingAdmin, email: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                placeholder="örn: email@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">Telefon</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={(editingAdmin as any).dialCode || '+49'}
                                                    onChange={(e) => setEditingAdmin({ ...editingAdmin, dialCode: e.target.value } as any)}
                                                    className="w-28 px-2 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 text-sm"
                                                >
                                                    {COUNTRY_CODES.map(c => (
                                                        <option key={c.code} value={c.dial}>
                                                            {c.flag} {c.dial}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="tel"
                                                    value={(editingAdmin as any).phone || ''}
                                                    onChange={(e) => setEditingAdmin({ ...editingAdmin, phone: e.target.value } as any)}
                                                    className="flex-1 px-3 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                    placeholder="örn: XXX XXX XXXX"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 📍 Adres Bilgileri */}
                                <div>
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                        📍 Adres Bilgileri
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2 relative">
                                                <label className="block text-gray-400 text-sm mb-1">Sokak / Cadde</label>
                                                <input
                                                    type="text"
                                                    value={(editingAdmin as any).address || ''}
                                                    onChange={(e) => {
                                                        setEditingAdmin({ ...editingAdmin, address: e.target.value } as any);
                                                        handleAddressInputChange(e.target.value, false);
                                                    }}
                                                    onFocus={() => { if (addressSuggestions.length > 0) setShowAddressSuggestions(true); }}
                                                    onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                    placeholder="örn: Musterstraße"
                                                    autoComplete="off"
                                                />
                                                {showAddressSuggestions && addressSuggestions.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                        {addressSuggestions.map((s) => (
                                                            <div
                                                                key={s.place_id}
                                                                className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white text-sm"
                                                                onClick={() => handleAddressSelect(s.place_id, s.description, false)}
                                                            >
                                                                📍 {s.description}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-sm mb-1">Ev No</label>
                                                <input
                                                    type="text"
                                                    value={(editingAdmin as any).houseNumber || ''}
                                                    onChange={(e) => setEditingAdmin({ ...editingAdmin, houseNumber: e.target.value } as any)}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                    placeholder="No"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="relative">
                                                <label className="block text-gray-400 text-sm mb-1">Şehir</label>
                                                <input
                                                    type="text"
                                                    value={(editingAdmin as any).city || ''}
                                                    onChange={(e) => {
                                                        setEditingAdmin({ ...editingAdmin, city: e.target.value } as any);
                                                        handleCityInputChange(e.target.value, false);
                                                    }}
                                                    onFocus={() => { if (citySuggestions.length > 0) setShowCitySuggestions(true); }}
                                                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                    placeholder="örn: Berlin"
                                                />
                                                {showCitySuggestions && citySuggestions.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                        {citySuggestions.map((s) => (
                                                            <div
                                                                key={s.place_id}
                                                                className="px-2 py-1 hover:bg-gray-700 cursor-pointer text-white text-xs"
                                                                onClick={() => {
                                                                    setShowCitySuggestions(false);
                                                                    setCitySuggestions([]);
                                                                    setEditingAdmin({ ...editingAdmin, city: s.description.split(',')[0].trim() } as any);
                                                                }}
                                                            >
                                                                🏙️ {s.description.split(',')[0]}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-sm mb-1">Posta Kodu</label>
                                                <input
                                                    type="text"
                                                    value={(editingAdmin as any).postalCode || ''}
                                                    onChange={(e) => setEditingAdmin({ ...editingAdmin, postalCode: e.target.value } as any)}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="41836"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-sm mb-1">Ülke</label>
                                                <select
                                                    value={(editingAdmin as any).country || 'Deutschland'}
                                                    onChange={(e) => setEditingAdmin({ ...editingAdmin, country: e.target.value } as any)}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                >
                                                    <option value="Deutschland">🇩🇪 Almanya</option>
                                                    <option value="Österreich">🇦🇹 Avusturya</option>
                                                    <option value="Schweiz">🇨🇭 İsviçre</option>
                                                    <option value="Türkei">🇹🇷 Türkiye</option>
                                                    <option value="Niederlande">🇳🇱 Hollanda</option>
                                                    <option value="Belgien">🇧🇪 Belçika</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 🔐 Yetki Yönetimi */}
                                <div>
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                        🔐 Yetki Yönetimi
                                    </h4>
                                    <div className="space-y-4">
                                        {/* Role Selector - Business admins only see their sector's roles */}
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">
                                                {admin?.adminType === 'super' ? 'Admin Rolü' : 'Rol'}
                                            </label>
                                            <select
                                                value={editRole}
                                                onChange={(e) => {
                                                    setEditRole(e.target.value as AdminType);
                                                    if (e.target.value !== 'super') {
                                                        loadButchersHelper();
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                                title="Rol seçin"
                                            >
                                                {admin?.adminType === 'super' ? (
                                                    // Super Admin: Tüm roller
                                                    getAllRoles().map((role) => (
                                                        <option key={role.value} value={role.value}>
                                                            {role.icon} {role.label}
                                                        </option>
                                                    ))
                                                ) : (
                                                    // İşletme Admini: Sadece kendi sektörünün admin ve personel rolleri
                                                    <>
                                                        {/* Kendi sektörünün admin rolü */}
                                                        <option value={admin?.adminType || 'kasap'}>
                                                            👔 Admin
                                                        </option>
                                                        {/* Kendi sektörünün personel rolü */}
                                                        <option value={`${admin?.adminType?.replace('_staff', '') || 'kasap'}_staff`}>
                                                            👤 Personel
                                                        </option>
                                                    </>
                                                )}
                                            </select>
                                        </div>

                                        {/* Location Input */}
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">Konum (Opsiyonel)</label>
                                            <input
                                                type="text"
                                                value={editLocation}
                                                onChange={(e) => setEditLocation(e.target.value)}
                                                placeholder="örn: Hückelhoven, Almanya"
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500"
                                                title="Admin konumunu girin"
                                            />
                                        </div>

                                        {/* İşletme Seçimi - SADECE Super Admin görebilir */}
                                        {admin?.adminType === 'super' && editRole !== 'super' && (
                                            <div>
                                                <label className="block text-gray-400 text-sm mb-1">
                                                    🏢 İşletme Seçimi
                                                </label>
                                                {loadingButchers ? (
                                                    <div className="text-gray-400 text-sm py-2">Yükleniyor...</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={businessSearchFilter}
                                                            onChange={(e) => setBusinessSearchFilter(e.target.value)}
                                                            placeholder="🔍 İşletme ara..."
                                                            className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder:text-gray-400 text-sm"
                                                        />
                                                        <select
                                                            value={editButcherId}
                                                            onChange={(e) => setEditButcherId(e.target.value)}
                                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                                            title="İşletme seçin"
                                                            size={Math.min(butcherList.filter(b => {
                                                                if (!businessSearchFilter.trim()) return true;
                                                                const search = businessSearchFilter.toLowerCase();
                                                                return b.name.toLowerCase().includes(search) ||
                                                                    b.city.toLowerCase().includes(search) ||
                                                                    b.postalCode.toLowerCase().includes(search);
                                                            }).length + 1, 6)}
                                                        >
                                                            <option value="">-- İşletme Seçin --</option>
                                                            {butcherList
                                                                .filter(b => {
                                                                    if (!businessSearchFilter.trim()) return true;
                                                                    const search = businessSearchFilter.toLowerCase();
                                                                    return b.name.toLowerCase().includes(search) ||
                                                                        b.city.toLowerCase().includes(search) ||
                                                                        b.postalCode.toLowerCase().includes(search);
                                                                })
                                                                .map((b) => (
                                                                    <option key={b.id} value={b.id}>
                                                                        {b.name} - {b.postalCode} {b.city}
                                                                    </option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 🟣 İşletme Sahibi Toggle - Only Super Admin can see/set */}
                                        {admin?.adminType === 'super' && editRole !== 'super' && !editRole?.includes('_staff') && (
                                            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-purple-200 font-medium flex items-center gap-2">
                                                            👑 İşletme Sahibi Olarak İşaretle
                                                        </p>
                                                        <p className="text-purple-400 text-xs mt-1">
                                                            İşletme sahipleri diğer adminler tarafından silinemez, arşivlenemez veya seviye düşürülemez.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditIsPrimaryAdmin(!editIsPrimaryAdmin)}
                                                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${editIsPrimaryAdmin ? 'bg-purple-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${editIsPrimaryAdmin ? 'translate-x-8' : 'translate-x-1'
                                                                }`}
                                                        />
                                                    </button>
                                                </div>
                                                {editIsPrimaryAdmin && (
                                                    <div className="mt-3 bg-purple-800/30 rounded p-2 text-center">
                                                        <span className="text-purple-200 text-sm font-medium">
                                                            ✅ Bu admin İşletme Sahibi olarak korunacak
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* İşletme admini için bilgi notu */}
                                        {admin?.adminType !== 'super' && (
                                            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                                                <p className="text-blue-300 text-sm">
                                                    ℹ️ Personel kendi işletmenize ({admin?.butcherName || 'İşletme'}) atanacaktır.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setEditingAdmin(null)}
                                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium"
                                    disabled={saving}
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSaveAdmin}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* New User Modal */}
            {
                showNewUserModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-2xl w-full p-6 my-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    ➕ Yeni Kullanıcı Ekle
                                </h3>
                                <button
                                    onClick={() => setShowNewUserModal(false)}
                                    className="text-gray-400 hover:text-white text-xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Personal Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Ad *</label>
                                        <input
                                            type="text"
                                            value={newUserData.firstName}
                                            onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                            placeholder="Adı"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Soyad *</label>
                                        <input
                                            type="text"
                                            value={newUserData.lastName}
                                            onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                            placeholder="Soyadı"
                                        />
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">E-posta *</label>
                                    <input
                                        type="email"
                                        value={newUserData.email}
                                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                        placeholder="ornek@email.com"
                                    />
                                </div>

                                {/* Phone with Country Code */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">📞 Telefon</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={newUserData.dialCode}
                                            onChange={(e) => setNewUserData({ ...newUserData, dialCode: e.target.value })}
                                            className="w-28 px-2 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 text-sm"
                                        >
                                            {COUNTRY_CODES.map((cc) => (
                                                <option key={cc.code} value={cc.dial}>
                                                    {cc.flag} {cc.dial}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="tel"
                                            value={newUserData.phone}
                                            onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                                            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                            placeholder="1771234567"
                                        />
                                    </div>
                                </div>

                                {/* Address Section */}
                                <div className="border-t border-gray-700 pt-4 mt-2">
                                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        📍 Adres Bilgileri
                                    </h4>
                                    <div className="space-y-3">
                                        {/* Street with Google Places */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2 relative">
                                                <label className="block text-gray-400 text-xs mb-1">Sokak</label>
                                                <input
                                                    type="text"
                                                    id="newUserStreetInput"
                                                    value={newUserData.address}
                                                    onChange={(e) => handleAddressInputChange(e.target.value, true)}
                                                    onFocus={() => {
                                                        if (addressSuggestions.length > 0) setShowAddressSuggestions(true);
                                                    }}
                                                    onBlur={() => {
                                                        setTimeout(() => setShowAddressSuggestions(false), 200);
                                                    }}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="En az 3 karakter yazın..."
                                                    autoComplete="off"
                                                />
                                                {/* Custom Autocomplete Dropdown */}
                                                {showAddressSuggestions && addressSuggestions.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                        {addressSuggestions.map((suggestion) => (
                                                            <div
                                                                key={suggestion.place_id}
                                                                className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white text-sm flex items-center gap-2"
                                                                onClick={() => handleAddressSelect(suggestion.place_id, suggestion.description, true)}
                                                            >
                                                                <span className="text-red-500">📍</span>
                                                                <span className="truncate">{suggestion.description}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {addressSearchLoading && (
                                                    <div className="absolute right-2 top-7 text-gray-400 text-xs">🔍</div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">Bina No</label>
                                                <input
                                                    type="text"
                                                    value={newUserData.houseNumber}
                                                    onChange={(e) => setNewUserData({ ...newUserData, houseNumber: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="12a"
                                                />
                                            </div>
                                        </div>
                                        {/* Address Line 2 */}
                                        <div>
                                            <label className="block text-gray-400 text-xs mb-1">Adres Satırı 2 (Daire, Kat vb.)</label>
                                            <input
                                                type="text"
                                                value={newUserData.addressLine2}
                                                onChange={(e) => setNewUserData({ ...newUserData, addressLine2: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                placeholder="2. Kat, Daire 5"
                                            />
                                        </div>
                                        {/* City, Postal Code, Country */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="relative">
                                                <label className="block text-gray-400 text-xs mb-1">Şehir</label>
                                                <input
                                                    type="text"
                                                    value={newUserData.city}
                                                    onChange={(e) => handleCityInputChange(e.target.value, true)}
                                                    onFocus={() => {
                                                        if (citySuggestions.length > 0) setShowCitySuggestions(true);
                                                    }}
                                                    onBlur={() => {
                                                        setTimeout(() => setShowCitySuggestions(false), 200);
                                                    }}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="Şehir yazın..."
                                                />
                                                {showCitySuggestions && citySuggestions.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                        {citySuggestions.map((suggestion) => (
                                                            <div
                                                                key={suggestion.place_id}
                                                                className="px-2 py-1 hover:bg-gray-700 cursor-pointer text-white text-xs"
                                                                onClick={() => handleCitySelect(suggestion.description, true)}
                                                            >
                                                                🏙️ {suggestion.description.split(',')[0]}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">Posta Kodu</label>
                                                <input
                                                    type="text"
                                                    value={newUserData.postalCode}
                                                    onChange={(e) => setNewUserData({ ...newUserData, postalCode: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="12345"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">Ülke</label>
                                                <input
                                                    type="text"
                                                    value={newUserData.country}
                                                    onChange={(e) => setNewUserData({ ...newUserData, country: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    placeholder="Almanya"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Rol *</label>
                                    <select
                                        value={newUserData.role}
                                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any, sector: '' })}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                    >
                                        {/* Normal Kullanıcı option - ONLY visible to Super Admins */}
                                        {admin?.adminType === 'super' && (
                                            <option value="user">👤 Normal Kullanıcı</option>
                                        )}
                                        <option value="staff">👷 Personel</option>
                                        <option value="business_admin">🏪 İşletme Admin</option>
                                        <option value="driver_lokma">🚚 LOKMA Filosu Sürücüsü</option>
                                        <option value="driver_business">🏪 İşletme Sürücüsü</option>
                                        {/* Super Admin option only visible to super admins */}
                                        {admin?.adminType === 'super' && (
                                            <option value="super">👑 Süper Admin</option>
                                        )}
                                    </select>
                                </div>

                                {/* Sector Selection - Only for Staff and Business Admin */}
                                {(newUserData.role === 'staff' || newUserData.role === 'business_admin') && (
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Sektör Modülü *</label>
                                        <select
                                            value={newUserData.sector}
                                            onChange={(e) => setNewUserData({ ...newUserData, sector: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                        >
                                            <option value="">Sektör seçin...</option>
                                            {/* Filter sectors based on admin's access */}
                                            {(() => {
                                                // Super Admin sees all sectors
                                                if (admin?.adminType === 'super') {
                                                    return getModuleBusinessTypes().map(bt => (
                                                        <option key={bt.value} value={bt.value}>
                                                            {bt.icon} {bt.label}
                                                        </option>
                                                    ));
                                                }

                                                // İşletme Admin/Personel only sees their sector
                                                const currentAdminType = admin?.adminType || '';
                                                const sectorMatch = currentAdminType.replace(/_admin$/, '').replace(/_staff$/, '');

                                                return getModuleBusinessTypes()
                                                    .filter(bt => bt.value === sectorMatch || currentAdminType === bt.value)
                                                    .map(bt => (
                                                        <option key={bt.value} value={bt.value}>
                                                            {bt.icon} {bt.label}
                                                        </option>
                                                    ));
                                            })()}
                                        </select>
                                    </div>
                                )}

                                {/* Temporary Password */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Geçici Şifre *</label>
                                    <input
                                        type="text"
                                        value={newUserData.password}
                                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                        placeholder="Geçici şifre (en az 6 karakter)"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Kullanıcı ilk girişte şifresini değiştirebilir</p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                                <button
                                    onClick={() => {
                                        setShowNewUserModal(false);
                                        setNewUserData({
                                            firstName: '', lastName: '', email: '', phone: '', dialCode: '+49',
                                            address: '', houseNumber: '', addressLine2: '', city: '', country: 'Almanya', postalCode: '',
                                            role: 'user', sector: '', password: ''
                                        });
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={async () => {
                                        // Validation
                                        if (!newUserData.firstName || !newUserData.lastName || !newUserData.email || !newUserData.password) {
                                            showToast('Lütfen zorunlu alanları doldurun', 'error');
                                            return;
                                        }
                                        if (newUserData.password.length < 6) {
                                            showToast('Şifre en az 6 karakter olmalı', 'error');
                                            return;
                                        }
                                        if ((newUserData.role === 'staff' || newUserData.role === 'business_admin') && !newUserData.sector) {
                                            showToast('Lütfen sektör seçin', 'error');
                                            return;
                                        }

                                        setCreatingUser(true);
                                        try {
                                            // 🔑 UNIVERSAL BUSINESS ID SYSTEM
                                            // Business admins should auto-use their own business ID when creating staff
                                            const needsBusinessId = newUserData.role === 'staff' || newUserData.role === 'business_admin';

                                            // Priority order for business ID lookup:
                                            // 1. businessId (NEW - universal field, sector-agnostic)
                                            // 2. butcherId (legacy - kasap)
                                            // 3. restaurantId (legacy - restoran)
                                            // 4. admin.id (fallback - always exists)
                                            const effectiveBusinessId = needsBusinessId ? (
                                                admin?.businessId ||    // NEW universal field
                                                admin?.butcherId ||     // Legacy kasap field
                                                admin?.restaurantId ||  // Legacy restoran field
                                                admin?.id               // Fallback: admin's own ID
                                            ) : undefined;

                                            const effectiveBusinessName = needsBusinessId ? (
                                                admin?.businessName ||  // NEW universal field
                                                admin?.butcherName ||   // Legacy kasap field
                                                admin?.restaurantName || // Legacy restoran field
                                                admin?.displayName      // Fallback
                                            ) : undefined;

                                            // 🔍 DEBUG: Log what we're sending
                                            console.log('🔍 CREATE USER DEBUG:', {
                                                needsBusinessId,
                                                effectiveBusinessId,
                                                effectiveBusinessName,
                                                adminBusinessId: admin?.businessId,
                                                adminButcherId: admin?.butcherId,
                                                adminRestaurantId: admin?.restaurantId,
                                                adminBusinessType: admin?.businessType,
                                                adminType: admin?.adminType,
                                                newUserRole: newUserData.role,
                                                sector: newUserData.sector,
                                                adminId: admin?.id,
                                            });

                                            // CRITICAL FIX: Call API to create user in Firebase Auth + Firestore
                                            const response = await fetch('/api/admin/create-user', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    email: newUserData.email,
                                                    password: newUserData.password,
                                                    displayName: `${newUserData.firstName} ${newUserData.lastName}`,
                                                    firstName: newUserData.firstName,
                                                    lastName: newUserData.lastName,
                                                    phone: newUserData.phone ? `${newUserData.dialCode}${newUserData.phone}` : undefined,
                                                    dialCode: newUserData.dialCode,
                                                    // Address fields
                                                    address: newUserData.address || undefined,
                                                    houseNumber: newUserData.houseNumber || undefined,
                                                    addressLine2: newUserData.addressLine2 || undefined,
                                                    city: newUserData.city || undefined,
                                                    country: newUserData.country || undefined,
                                                    postalCode: newUserData.postalCode || undefined,
                                                    // Role info
                                                    role: newUserData.role !== 'user' ? 'admin' : 'user',
                                                    adminType: newUserData.role === 'super' ? 'super' :
                                                        newUserData.role === 'business_admin' ? `${newUserData.sector}` :
                                                            newUserData.role === 'staff' ? `${newUserData.sector}_staff` :
                                                                (newUserData.role === 'driver_lokma' || newUserData.role === 'driver_business') ? undefined : undefined,
                                                    // 🚗 Driver fields
                                                    isDriver: newUserData.role === 'driver_lokma' || newUserData.role === 'driver_business',
                                                    driverType: newUserData.role === 'driver_lokma' ? 'lokma_fleet' : newUserData.role === 'driver_business' ? 'business' : undefined,
                                                    // 🔑 UNIVERSAL: Business ID for all business types
                                                    businessId: effectiveBusinessId,
                                                    businessName: effectiveBusinessName,
                                                    businessType: newUserData.sector,
                                                    // Legacy support (for backward compatibility)
                                                    butcherId: effectiveBusinessId,
                                                    butcherName: effectiveBusinessName,
                                                    // Assigner details for welcome email
                                                    createdBy: admin?.email || admin?.id,
                                                    createdBySource: admin?.adminType === 'super' ? 'super_admin' : 'business_admin',
                                                    assignerName: admin?.displayName || (admin?.firstName ? `${admin.firstName} ${admin.lastName || ''}`.trim() : 'Admin'),
                                                    assignerEmail: admin?.email || '',
                                                    assignerPhone: admin?.phone || '',
                                                    assignerRole: admin?.adminType || 'admin',
                                                }),
                                            });

                                            // 🔍 DEBUG: Try to get response as text first for debugging
                                            let data: any;
                                            let responseText = '';
                                            try {
                                                responseText = await response.text();
                                                data = JSON.parse(responseText);
                                            } catch (parseError) {
                                                console.error('🚨 API returned non-JSON:', responseText);
                                                showToast(`API hatası (${response.status}): ${responseText.substring(0, 100)}`, 'error');
                                                return;
                                            }

                                            if (!response.ok) {
                                                showToast(data.error || 'Kullanıcı oluşturulamadı', 'error');
                                                return;
                                            }

                                            // 🔍 DEBUG: Check if this was a debug response
                                            if (data.debug) {
                                                showToast(`DEBUG: ${data.message} - businessId: ${data.data?.businessId}`, 'success');
                                                console.log('🔍 DEBUG RESPONSE:', data);
                                                return;
                                            }

                                            showToast(`Kullanıcı başarıyla oluşturuldu: ${newUserData.firstName} ${newUserData.lastName}`, 'success');
                                            setShowNewUserModal(false);
                                            setNewUserData({
                                                firstName: '', lastName: '', email: '', phone: '', dialCode: '+49',
                                                address: '', houseNumber: '', addressLine2: '', city: '', country: 'Almanya', postalCode: '',
                                                role: 'user', sector: '', password: ''
                                            });

                                            // Refresh user list
                                            if (showAllUsers) {
                                                loadAllUsers(allUsersPage);
                                            }
                                        } catch (error) {
                                            console.error('Error creating user:', error);
                                            showToast(`Hata: ${error instanceof Error ? error.message : String(error)}`, 'error');
                                        } finally {
                                            setCreatingUser(false);
                                        }
                                    }}
                                    disabled={creatingUser}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 font-bold transition disabled:opacity-50"
                                >
                                    {creatingUser ? '⏳ Oluşturuluyor...' : '✓ Kullanıcı Oluştur'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* User Profile Edit Modal */}
            {
                editingUserProfile && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-6xl w-full p-6 my-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    👤 Kullanıcı Profili Düzenle
                                </h3>
                                <button
                                    onClick={() => setEditingUserProfile(null)}
                                    className="text-gray-400 hover:text-white text-xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Profile Picture Upload Section */}
                                <div className="flex items-center gap-6 p-4 bg-gray-750/50 rounded-xl border border-gray-700/50">
                                    <div className="relative group shrink-0">
                                        {editingUserProfile.photoURL ? (
                                            <img
                                                src={editingUserProfile.photoURL}
                                                alt="Profile"
                                                className="w-20 h-20 rounded-full object-cover border-2 border-gray-600 shadow-md bg-gray-800"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-500 border-2 border-gray-600 shadow-inner">
                                                {editingUserProfile.firstName?.charAt(0)?.toUpperCase() || editingUserProfile.email?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        {/* Upload Overlay */}
                                        <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-[2px]">
                                            <span className="text-white text-[10px] font-bold uppercase tracking-wider mb-1">Değiştir</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    // Max 5MB check
                                                    if (file.size > 5 * 1024 * 1024) {
                                                        showToast('Dosya boyutu 5MB\'dan büyük olamaz', 'error');
                                                        return;
                                                    }

                                                    try {
                                                        const storage = getStorage();
                                                        // Upload to profile_images/UID path
                                                        // Note: We use unique timestamp to effectively bypass CDN caching on update
                                                        const fileName = `profile_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                                                        const storageRef = ref(storage, `profile_images/${editingUserProfile.userId}/${fileName}`);

                                                        showToast('Resim yükleniyor...', 'success');

                                                        await uploadBytes(storageRef, file);
                                                        const downloadURL = await getDownloadURL(storageRef);

                                                        setEditingUserProfile({
                                                            ...editingUserProfile,
                                                            photoURL: downloadURL
                                                        });

                                                        showToast('Resim başarıyla yüklendi (Kaydet butonuna basmayı unutmayın!)', 'success');
                                                    } catch (error) {
                                                        console.error('Upload error:', error);
                                                        showToast('Resim yükleme hatası oluştu', 'error');
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-white font-medium">Profil Görseli</h4>
                                            {editingUserProfile.photoURL && (
                                                <button
                                                    onClick={() => {
                                                        setConfirmState({
                                                            isOpen: true,
                                                            title: 'Profil Resmini Kaldır',
                                                            message: 'Profil resmini kaldırmak istediğinizden emin misiniz?',
                                                            variant: 'warning',
                                                            confirmText: 'Evet, Kaldır',
                                                            onConfirm: () => {
                                                                setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                setEditingUserProfile({ ...editingUserProfile, photoURL: undefined });
                                                            },
                                                        });
                                                    }}
                                                    className="text-red-400 text-xs hover:text-red-300 transition flex items-center gap-1 px-2 py-1 hover:bg-red-900/20 rounded"
                                                >
                                                    ✕ Resmi Kaldır
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-xs leading-relaxed">
                                            Kullanıcının profil fotoğrafını güncelleyin. Google ile giriş yapan kullanıcıların fotoğrafları varsayılan olarak gelir ancak buradan değiştirilebilir.
                                        </p>
                                    </div>
                                </div>

                                {/* 2-COLUMN GRID for tablet/desktop */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* LEFT COLUMN: Personal + Contact + Address */}
                                    <div className="space-y-6">
                                        {/* Personal Info */}
                                        <div>
                                            <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                                📝 Kişisel Bilgiler
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-1">Ad</label>
                                                    <input
                                                        type="text"
                                                        value={editingUserProfile.firstName}
                                                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, firstName: e.target.value })}
                                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-1">Soyad</label>
                                                    <input
                                                        type="text"
                                                        value={editingUserProfile.lastName}
                                                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, lastName: e.target.value })}
                                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Active/Inactive Toggle */}
                                            <div className="mt-4 flex items-center justify-between p-3 bg-gray-750 rounded-lg border border-gray-600">
                                                <div className="flex-1">
                                                    <span className="text-white font-medium">Hesap Durumu</span>
                                                    <p className="text-gray-400 text-xs">Pasif hesaplar giriş yapamaz ama veriler korunur</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingUserProfile({
                                                            ...editingUserProfile,
                                                            isActive: editingUserProfile.isActive === false ? true : false
                                                        })}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${editingUserProfile.isActive !== false
                                                            ? 'bg-green-500 focus:ring-green-500'
                                                            : 'bg-red-500 focus:ring-red-500'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${editingUserProfile.isActive !== false
                                                                ? 'translate-x-6'
                                                                : 'translate-x-1'
                                                                }`}
                                                        />
                                                    </button>
                                                    <span className={`text-sm font-medium min-w-[60px] ${editingUserProfile.isActive !== false
                                                        ? 'text-green-400'
                                                        : 'text-red-400'
                                                        }`}>
                                                        {editingUserProfile.isActive !== false ? '✅ Aktif' : '⛔ Pasif'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contact Info - GDPR Privacy: Business admins cannot see phone/email */}
                                        <div>
                                            <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                                📞 İletişim Bilgileri
                                                {admin?.adminType !== 'super' && (
                                                    <span className="text-xs text-yellow-500 font-normal ml-2">🔒 Gizlilik Korumalı</span>
                                                )}
                                            </h4>
                                            {admin?.adminType === 'super' ? (
                                                /* Super Admin: Full access to contact info */
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-1">E-posta Adresi</label>
                                                        <input
                                                            type="email"
                                                            value={editingUserProfile.email}
                                                            onChange={(e) => setEditingUserProfile({ ...editingUserProfile, email: e.target.value })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-1">Telefon</label>
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={editingUserProfile.dialCode || '+90'}
                                                                onChange={(e) => setEditingUserProfile({ ...editingUserProfile, dialCode: e.target.value })}
                                                                className="w-28 px-2 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 text-sm appearance-none"
                                                            >
                                                                {COUNTRY_CODES.map(c => (
                                                                    <option key={c.code} value={c.dial}>
                                                                        {c.flag} {c.dial}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                type="tel"
                                                                value={editingUserProfile.phone}
                                                                onChange={(e) => setEditingUserProfile({ ...editingUserProfile, phone: e.target.value })}
                                                                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 placeholder:text-gray-500/40 placeholder:italic"
                                                                placeholder="örn: XXX XXX XX XX"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Business Admin: Privacy protected - cannot see or edit contact info */
                                                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                                                    <div className="flex items-center gap-3 text-yellow-400 mb-2">
                                                        <span className="text-xl">🔒</span>
                                                        <span className="font-medium">Müşteri Gizliliği Koruması</span>
                                                    </div>
                                                    <p className="text-yellow-300/70 text-sm">
                                                        GDPR uyumluluğu gereği, işletme yöneticileri müşterilerin e-posta ve telefon bilgilerine erişemez.
                                                        Teslimat sırasında gerekli iletişim bilgileri sipariş detayında görüntülenir.
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                                        <div>
                                                            <label className="block text-gray-500 text-sm mb-1">E-posta</label>
                                                            <div className="px-3 py-2 bg-gray-800 text-gray-500 rounded-lg border border-gray-700">
                                                                🔒 Gizli
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-gray-500 text-sm mb-1">Telefon</label>
                                                            <div className="px-3 py-2 bg-gray-800 text-gray-500 rounded-lg border border-gray-700">
                                                                🔒 Gizli
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Address */}
                                        <div>
                                            <h4 className="text-white font-semibold mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
                                                <span className="flex items-center gap-2">📍 Adres Bilgileri</span>
                                                <button
                                                    type="button"
                                                    onClick={handleReverseGeocode}
                                                    disabled={isGeocoding}
                                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 transition disabled:opacity-50"
                                                >
                                                    {isGeocoding ? '📍 Aranıyor...' : '📍 GPS\'ten Adres Çek'}
                                                </button>
                                            </h4>
                                            <div className="space-y-4">
                                                {/* Street and House Number Row */}
                                                <div className="grid grid-cols-4 gap-4">
                                                    <div className="col-span-3 relative">
                                                        <label className="block text-gray-400 text-sm mb-1">Cadde / Sokak</label>
                                                        <input
                                                            id="google-places-street-input"
                                                            type="text"
                                                            value={editingUserProfile.address}
                                                            onChange={(e) => handleAddressInputChange(e.target.value, false)}
                                                            onFocus={() => {
                                                                if (addressSuggestions.length > 0) setShowAddressSuggestions(true);
                                                            }}
                                                            onBlur={() => {
                                                                // Delay to allow click on suggestion
                                                                setTimeout(() => setShowAddressSuggestions(false), 200);
                                                            }}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                            placeholder="En az 3 karakter yazın..."
                                                            autoComplete="off"
                                                        />
                                                        {/* Custom Autocomplete Dropdown */}
                                                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                                                            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                                {addressSuggestions.map((suggestion, index) => (
                                                                    <div
                                                                        key={suggestion.place_id}
                                                                        className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white text-sm flex items-center gap-2"
                                                                        onClick={() => handleAddressSelect(suggestion.place_id, suggestion.description, false)}
                                                                    >
                                                                        <span className="text-red-500">📍</span>
                                                                        <span className="truncate">{suggestion.description}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {addressSearchLoading && (
                                                            <div className="absolute right-2 top-8 text-gray-400 text-xs">🔍</div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-1">Kapı No</label>
                                                        <input
                                                            type="text"
                                                            value={editingUserProfile.houseNumber}
                                                            onChange={(e) => setEditingUserProfile({ ...editingUserProfile, houseNumber: e.target.value })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                            placeholder="No"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Address Line 2 */}
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-1">
                                                        Adres Satırı 2 <span className="text-gray-500 text-xs">(Daire, Kat, Site Adı vb.)</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editingUserProfile.addressLine2}
                                                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, addressLine2: e.target.value })}
                                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                        placeholder="Zorunlu alan: Daire, Kat veya Site/Apartman adı"
                                                    />
                                                </div>

                                                {/* City, Zip, Country */}
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="relative">
                                                        <label className="block text-gray-400 text-sm mb-1">Şehir</label>
                                                        <input
                                                            type="text"
                                                            value={editingUserProfile.city}
                                                            onChange={(e) => handleCityInputChange(e.target.value, false)}
                                                            onFocus={() => {
                                                                if (citySuggestions.length > 0) setShowCitySuggestions(true);
                                                            }}
                                                            onBlur={() => {
                                                                setTimeout(() => setShowCitySuggestions(false), 200);
                                                            }}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                            placeholder="Şehir yazın..."
                                                        />
                                                        {/* City Autocomplete Dropdown */}
                                                        {showCitySuggestions && citySuggestions.length > 0 && (
                                                            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                                {citySuggestions.map((suggestion) => (
                                                                    <div
                                                                        key={suggestion.place_id}
                                                                        className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white text-sm flex items-center gap-2"
                                                                        onClick={() => handleCitySelect(suggestion.description, false)}
                                                                    >
                                                                        <span className="text-blue-400">🏙️</span>
                                                                        <span className="truncate">{suggestion.description}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {citySearchLoading && (
                                                            <div className="absolute right-2 top-8 text-gray-400 text-xs">🔍</div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-1">Posta Kodu</label>
                                                        <input
                                                            type="text"
                                                            value={editingUserProfile.postalCode}
                                                            onChange={(e) => setEditingUserProfile({ ...editingUserProfile, postalCode: e.target.value })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-1">Ülke</label>
                                                        <input
                                                            type="text"
                                                            value={editingUserProfile.country}
                                                            onChange={(e) => setEditingUserProfile({ ...editingUserProfile, country: e.target.value })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* RIGHT COLUMN: Yetki/Roles/Toggles */}
                                    <div className="space-y-6">
                                        {/* Admin Role Section */}
                                        <div>
                                            <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                                🔐 Yetki Yönetimi
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-1">Rol</label>
                                                    <select
                                                        value={editingUserProfile.isAdmin ? (editingUserProfile.adminType || 'admin') : 'user'}
                                                        onChange={(e) => {
                                                            const newRole = e.target.value;
                                                            if (newRole === 'user') {
                                                                setEditingUserProfile({
                                                                    ...editingUserProfile,
                                                                    isAdmin: false,
                                                                    adminType: undefined
                                                                });
                                                            } else {
                                                                setEditingUserProfile({
                                                                    ...editingUserProfile,
                                                                    isAdmin: true,
                                                                    adminType: newRole
                                                                });
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                    >
                                                        <option value="user">👤 Kullanıcı</option>
                                                        {/* 🆕 KONSOLİDE ROLLER */}
                                                        <optgroup label="İşletme Rolleri">
                                                            <option value="isletme_admin">🏪 İşletme Admin</option>
                                                            <option value="isletme_staff">🏪 İşletme Personel</option>
                                                        </optgroup>
                                                        <optgroup label="Organizasyon Rolleri">
                                                            <option value="kermes">🎪 Kermes Admin</option>
                                                            <option value="kermes_staff">🎪 Kermes Personel</option>
                                                        </optgroup>
                                                        {/* Super Admin - sadece süper adminler görebilir */}
                                                        {(admin?.adminType === 'super' || editingUserProfile.adminType === 'super') && (
                                                            <option value="super">👑 Süper Admin</option>
                                                        )}
                                                    </select>
                                                </div>

                                                {/* Business Selection - ARAMA BAZLI AUTOCOMPLETE (Kermes HARİCİ roller için) */}
                                                {editingUserProfile.isAdmin && editingUserProfile.adminType && editingUserProfile.adminType !== 'super' && editingUserProfile.adminType !== 'user' && editingUserProfile.adminType !== 'kermes' && editingUserProfile.adminType !== 'kermes_staff' && (
                                                    <div className="relative">
                                                        <label className="block text-gray-400 text-sm mb-1">
                                                            🏪 İşletme Seçimi <span className="text-red-500">*</span>
                                                        </label>

                                                        {/* Seçili işletme göster veya arama inputu */}
                                                        {editingUserProfile.butcherId ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 px-3 py-2 bg-green-900/30 border border-green-600 text-green-200 rounded-lg">
                                                                    ✅ {editingUserProfile.butcherName || 'İşletme Seçildi'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingUserProfile({
                                                                            ...editingUserProfile,
                                                                            butcherId: '',
                                                                            butcherName: ''
                                                                        });
                                                                        setBusinessSearchFilter('');
                                                                    }}
                                                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                                                >
                                                                    ✕ Değiştir
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={businessSearchFilter}
                                                                        onChange={(e) => setBusinessSearchFilter(e.target.value)}
                                                                        placeholder="🔍 İşletme adı veya şehir yazın (en az 3 karakter)..."
                                                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
                                                                    />
                                                                    {businessSearchFilter.length > 0 && businessSearchFilter.length < 3 && (
                                                                        <p className="text-yellow-400 text-xs mt-1">
                                                                            ⏳ En az 3 karakter yazın...
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Arama Sonuçları */}
                                                                {businessSearchFilter.length >= 3 && (
                                                                    <div className="mt-2 max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg">
                                                                        {loadingButchers ? (
                                                                            <div className="p-3 text-gray-400 text-center">
                                                                                ⏳ Yükleniyor...
                                                                            </div>
                                                                        ) : (
                                                                            (() => {
                                                                                const searchLower = businessSearchFilter.toLowerCase();
                                                                                const filteredBusinesses = butcherList.filter(b =>
                                                                                    b.name.toLowerCase().includes(searchLower) ||
                                                                                    b.city.toLowerCase().includes(searchLower) ||
                                                                                    b.postalCode?.includes(searchLower)
                                                                                ).slice(0, 20);

                                                                                if (filteredBusinesses.length === 0) {
                                                                                    return (
                                                                                        <div className="p-3 text-gray-400 text-center">
                                                                                            ❌ "{businessSearchFilter}" için sonuç bulunamadı
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                return filteredBusinesses.map(b => (
                                                                                    <button
                                                                                        key={b.id}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setEditingUserProfile({
                                                                                                ...editingUserProfile,
                                                                                                butcherId: b.id,
                                                                                                butcherName: `${b.name} - ${b.city}`
                                                                                            });
                                                                                            setBusinessSearchFilter('');
                                                                                        }}
                                                                                        className="w-full text-left px-4 py-3 hover:bg-blue-600/30 border-b border-gray-700 last:border-b-0 transition"
                                                                                    >
                                                                                        <div className="font-medium text-white">{b.name}</div>
                                                                                        <div className="text-sm text-gray-400">
                                                                                            📍 {b.city} {b.postalCode && `- ${b.postalCode}`}
                                                                                            {b.types?.length > 0 && (
                                                                                                <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">
                                                                                                    {b.types.join(', ').toUpperCase()}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </button>
                                                                                ));
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {!editingUserProfile.butcherId && (
                                                            <p className="text-red-400 text-xs mt-1">
                                                                ⚠️ Admin rolü için işletme seçimi zorunludur!
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 🆕 ORGANIZASYON SEÇİMİ - Kermes Admin/Personel için */}
                                                {editingUserProfile.isAdmin && (editingUserProfile.adminType === 'kermes' || editingUserProfile.adminType === 'kermes_staff') && (
                                                    <div className="relative">
                                                        <label className="block text-gray-400 text-sm mb-1">
                                                            🕌 Organizasyon Seçimi (VIKZ Camii) <span className="text-red-500">*</span>
                                                        </label>

                                                        {/* Seçili organizasyon göster veya arama inputu */}
                                                        {editingUserProfile.organizationId ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 px-3 py-2 bg-emerald-900/30 border border-emerald-600 text-emerald-200 rounded-lg">
                                                                    🕌 {editingUserProfile.organizationName || 'Organizasyon Seçildi'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingUserProfile({
                                                                            ...editingUserProfile,
                                                                            organizationId: '',
                                                                            organizationName: ''
                                                                        });
                                                                        setOrganizationSearchFilter('');
                                                                    }}
                                                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                                                >
                                                                    ✕ Değiştir
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={organizationSearchFilter}
                                                                        onChange={(e) => setOrganizationSearchFilter(e.target.value)}
                                                                        placeholder="🔍 Posta kodu, şehir veya dernek adı yazın (en az 3 karakter)..."
                                                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-emerald-500"
                                                                    />
                                                                    {organizationSearchFilter.length > 0 && organizationSearchFilter.length < 3 && (
                                                                        <p className="text-yellow-400 text-xs mt-1">
                                                                            ⏳ En az 3 karakter yazın...
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Organizasyon Arama Sonuçları */}
                                                                {organizationSearchFilter.length >= 3 && (
                                                                    <div className="mt-2 max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg">
                                                                        {loadingOrganizations ? (
                                                                            <div className="p-3 text-gray-400 text-center">
                                                                                ⏳ Organizasyonlar yükleniyor...
                                                                            </div>
                                                                        ) : (
                                                                            (() => {
                                                                                const searchLower = organizationSearchFilter.toLowerCase();
                                                                                const filteredOrgs = organizationList.filter(o =>
                                                                                    o.name.toLowerCase().includes(searchLower) ||
                                                                                    o.city.toLowerCase().includes(searchLower) ||
                                                                                    o.shortName?.toLowerCase().includes(searchLower) ||
                                                                                    o.postalCode?.includes(searchLower)
                                                                                ).slice(0, 20);

                                                                                if (filteredOrgs.length === 0) {
                                                                                    return (
                                                                                        <div className="p-3 text-gray-400 text-center">
                                                                                            ❌ "{organizationSearchFilter}" için organizasyon bulunamadı
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                return filteredOrgs.map(o => (
                                                                                    <button
                                                                                        key={o.id}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setEditingUserProfile({
                                                                                                ...editingUserProfile,
                                                                                                organizationId: o.id,
                                                                                                organizationName: `${o.shortName || o.name} - ${o.city}`
                                                                                            });
                                                                                            setOrganizationSearchFilter('');
                                                                                        }}
                                                                                        className="w-full text-left px-4 py-3 hover:bg-emerald-600/30 border-b border-gray-700 last:border-b-0 transition"
                                                                                    >
                                                                                        <div className="font-medium text-white">🕌 {o.shortName || o.name}</div>
                                                                                        <div className="text-sm text-gray-400">
                                                                                            📍 {o.postalCode && `${o.postalCode} `}{o.city}
                                                                                            <span className="ml-2 text-xs bg-emerald-800 px-2 py-0.5 rounded text-emerald-200">
                                                                                                {o.type.toUpperCase()}
                                                                                            </span>
                                                                                        </div>
                                                                                    </button>
                                                                                ));
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {!editingUserProfile.organizationId && (
                                                            <p className="text-red-400 text-xs mt-1">
                                                                ⚠️ Kermes admin/personel için organizasyon seçimi zorunludur!
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Role description */}
                                                <p className="text-gray-500 text-xs">
                                                    {editingUserProfile.isAdmin
                                                        ? `Bu kullanıcı "${getRoleLabel(editingUserProfile.adminType as string) || editingUserProfile.adminType || 'Admin'}" yetkisine sahip.`
                                                        : 'Bu kullanıcının admin yetkisi bulunmuyor.'}
                                                </p>

                                                {/* 🟣 İşletme Sahibi Toggle - Only Super Admin can see/set */}
                                                {admin?.adminType === 'super' && editingUserProfile.isAdmin && editingUserProfile.adminType !== 'super' && (
                                                    <div className="mt-4 bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-purple-200 font-medium flex items-center gap-2">
                                                                    👑 İşletme Sahibi Olarak İşaretle
                                                                </p>
                                                                <p className="text-purple-400 text-xs mt-1">
                                                                    İşletme sahipleri diğer adminler tarafından silinemez, arşivlenemez veya seviye düşürülemez.
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingUserProfile({
                                                                    ...editingUserProfile,
                                                                    isPrimaryAdmin: !(editingUserProfile as any).isPrimaryAdmin
                                                                } as any)}
                                                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${(editingUserProfile as any).isPrimaryAdmin ? 'bg-purple-600' : 'bg-gray-600'
                                                                    }`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${(editingUserProfile as any).isPrimaryAdmin ? 'translate-x-8' : 'translate-x-1'
                                                                        }`}
                                                                />
                                                            </button>
                                                        </div>
                                                        {(editingUserProfile as any).isPrimaryAdmin && (
                                                            <div className="mt-3 bg-purple-800/30 rounded p-2 text-center">
                                                                <span className="text-purple-200 text-sm font-medium">
                                                                    ✅ Bu admin İşletme Sahibi olarak korunacak
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 🚗 Sürücü Toggle - Tüm kullanıcılar için görünür (sürücü admin olmadan da atanabilir) */}
                                                {(
                                                    <div className="mt-4 bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-emerald-200 font-medium flex items-center gap-2">
                                                                    🚗 Sürücü Olarak İşaretle
                                                                </p>
                                                                <p className="text-emerald-400 text-xs mt-1">
                                                                    Bu kullanıcıyı teslimat sürücüsü olarak atayın. Sürücü paneline erişim sağlar.
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingUserProfile({
                                                                    ...editingUserProfile,
                                                                    isDriver: !(editingUserProfile as any).isDriver
                                                                } as any)}
                                                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${(editingUserProfile as any).isDriver ? 'bg-emerald-600' : 'bg-gray-600'
                                                                    }`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${(editingUserProfile as any).isDriver ? 'translate-x-8' : 'translate-x-1'
                                                                        }`}
                                                                />
                                                            </button>
                                                        </div>
                                                        {(editingUserProfile as any).isDriver && (
                                                            <div className="mt-3">
                                                                <p className="text-emerald-300 text-xs font-medium mb-2">Sürücü Tipi:</p>
                                                                <div className="flex gap-3">
                                                                    <label
                                                                        className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${(editingUserProfile as any).driverType === 'lokma_fleet'
                                                                            ? 'border-emerald-400 bg-emerald-800/40'
                                                                            : 'border-gray-600 bg-gray-800/40 hover:border-gray-500'
                                                                            }`}
                                                                        onClick={() => setEditingUserProfile({
                                                                            ...editingUserProfile,
                                                                            driverType: 'lokma_fleet'
                                                                        } as any)}
                                                                    >
                                                                        <input
                                                                            type="radio"
                                                                            name="driverType"
                                                                            checked={(editingUserProfile as any).driverType === 'lokma_fleet'}
                                                                            readOnly
                                                                            className="accent-emerald-500"
                                                                        />
                                                                        <div>
                                                                            <p className="text-emerald-200 text-sm font-medium">🚚 LOKMA Filosu</p>
                                                                            <p className="text-emerald-400/70 text-xs">Platform sürücüsü, tüm işletmelere atanabilir</p>
                                                                        </div>
                                                                    </label>
                                                                    <label
                                                                        className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${(editingUserProfile as any).driverType !== 'lokma_fleet'
                                                                            ? 'border-amber-400 bg-amber-800/30'
                                                                            : 'border-gray-600 bg-gray-800/40 hover:border-gray-500'
                                                                            }`}
                                                                        onClick={() => setEditingUserProfile({
                                                                            ...editingUserProfile,
                                                                            driverType: 'business'
                                                                        } as any)}
                                                                    >
                                                                        <input
                                                                            type="radio"
                                                                            name="driverType"
                                                                            checked={(editingUserProfile as any).driverType !== 'lokma_fleet'}
                                                                            readOnly
                                                                            className="accent-amber-500"
                                                                        />
                                                                        <div>
                                                                            <p className="text-amber-200 text-sm font-medium">🏪 İşletme Sürücüsü</p>
                                                                            <p className="text-amber-400/70 text-xs">Sadece kendi işletmesinin siparişlerini taşır</p>
                                                                        </div>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 🪑 MASA ATAMASI - Garson masa ataması */}
                                                {editingUserProfile.isAdmin && editingUserProfile.butcherId && (
                                                    (() => {
                                                        // Load maxReservationTables on first render for this business
                                                        const bizId = editingUserProfile.butcherId;
                                                        if (bizId && maxTablesForBusiness === 0) {
                                                            getDoc(doc(db, 'businesses', bizId)).then(bizDoc => {
                                                                if (bizDoc.exists()) {
                                                                    const maxT = bizDoc.data()?.maxReservationTables as number || 0;
                                                                    if (maxT > 0) setMaxTablesForBusiness(maxT);
                                                                }
                                                            });
                                                        }
                                                        if (maxTablesForBusiness <= 0) return null;

                                                        const selectedTables = (editingUserProfile as any).assignedTables || [];
                                                        const toggleTable = (num: number) => {
                                                            const current = [...selectedTables];
                                                            const idx = current.indexOf(num);
                                                            if (idx >= 0) current.splice(idx, 1);
                                                            else current.push(num);
                                                            current.sort((a: number, b: number) => a - b);
                                                            setEditingUserProfile({ ...editingUserProfile, assignedTables: current } as any);
                                                        };
                                                        const selectAll = () => {
                                                            const all = Array.from({ length: maxTablesForBusiness }, (_, i) => i + 1);
                                                            setEditingUserProfile({ ...editingUserProfile, assignedTables: all } as any);
                                                        };
                                                        const clearAll = () => {
                                                            setEditingUserProfile({ ...editingUserProfile, assignedTables: [] } as any);
                                                        };

                                                        return (
                                                            <div className="mt-4 bg-amber-900/30 border border-amber-700 rounded-lg p-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div>
                                                                        <p className="text-amber-200 font-medium flex items-center gap-2">
                                                                            🪑 Masa Ataması
                                                                        </p>
                                                                        <p className="text-amber-400 text-xs mt-1">
                                                                            Toplam {maxTablesForBusiness} masa · Seçili: {selectedTables.length}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={selectAll}
                                                                            className="px-3 py-1 text-xs bg-amber-700 text-amber-100 rounded hover:bg-amber-600 transition"
                                                                        >
                                                                            Tümünü Seç
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={clearAll}
                                                                            className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
                                                                        >
                                                                            Temizle
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-10 gap-1.5 max-h-48 overflow-y-auto">
                                                                    {Array.from({ length: maxTablesForBusiness }, (_, i) => i + 1).map(num => (
                                                                        <button
                                                                            key={num}
                                                                            type="button"
                                                                            onClick={() => toggleTable(num)}
                                                                            className={`w-full aspect-square flex items-center justify-center rounded text-xs font-medium transition-all ${selectedTables.includes(num)
                                                                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                                                                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                                                                                }`}
                                                                        >
                                                                            {num}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                {selectedTables.length > 0 && (
                                                                    <div className="mt-2 text-amber-300/70 text-xs">
                                                                        Atanan masalar: {selectedTables.join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                )}

                                                {/* 🆕 ROLLER BÖLÜMÜ - Çoklu Rol Listesi ve Rol Ekleme */}
                                                {editingUserProfile.isAdmin && admin?.adminType === 'super' && (
                                                    <div className="mt-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-700 rounded-xl p-4">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-indigo-200 font-semibold flex items-center gap-2">
                                                                🎭 Kullanıcı Rolleri
                                                            </h4>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewRoleType('');
                                                                    setNewRoleBusinessId('');
                                                                    setNewRoleBusinessName('');
                                                                    setNewRoleOrganizationId('');
                                                                    setNewRoleOrganizationName('');
                                                                    setShowAddRoleModal(true);
                                                                    loadButchersHelper();
                                                                    loadOrganizationsHelper();
                                                                }}
                                                                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition flex items-center gap-1"
                                                            >
                                                                ➕ Rol Ekle
                                                            </button>
                                                        </div>

                                                        {/* Mevcut Roller Listesi */}
                                                        {editingUserProfile.roles && editingUserProfile.roles.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {editingUserProfile.roles.map((role, index) => (
                                                                    <div
                                                                        key={index}
                                                                        className={`flex items-center justify-between p-3 rounded-lg border ${role.isPrimary
                                                                            ? 'bg-yellow-900/30 border-yellow-600'
                                                                            : role.isActive
                                                                                ? 'bg-gray-800/50 border-gray-600'
                                                                                : 'bg-gray-900/50 border-gray-700 opacity-50'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-2xl">
                                                                                {role.type === 'super' ? '👑' :
                                                                                    role.type?.includes('kermes') ? '🎪' :
                                                                                        role.type?.includes('kasap') ? '🥩' :
                                                                                            role.type?.includes('restoran') ? '🍽️' :
                                                                                                role.type?.includes('market') ? '🛒' : '🎫'}
                                                                            </span>
                                                                            <div>
                                                                                <p className="text-white font-medium">
                                                                                    {getRoleLabel(role.type) || role.type}
                                                                                    {role.isPrimary && (
                                                                                        <span className="ml-2 text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded">
                                                                                            ⭐ Ana Rol
                                                                                        </span>
                                                                                    )}
                                                                                </p>
                                                                                <p className="text-gray-400 text-sm">
                                                                                    {role.businessName || role.organizationName || 'Tüm Sistem'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {/* Ana Rol Yap butonu */}
                                                                            {!role.isPrimary && role.isActive && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const updatedRoles = editingUserProfile.roles?.map((r, i) => ({
                                                                                            ...r,
                                                                                            isPrimary: i === index
                                                                                        }));
                                                                                        setEditingUserProfile({
                                                                                            ...editingUserProfile,
                                                                                            roles: updatedRoles,
                                                                                            // Ana rolü de güncelle
                                                                                            adminType: role.type,
                                                                                            butcherId: role.businessId || '',
                                                                                            butcherName: role.businessName || '',
                                                                                            organizationId: role.organizationId || '',
                                                                                            organizationName: role.organizationName || ''
                                                                                        });
                                                                                    }}
                                                                                    className="px-2 py-1 text-xs bg-yellow-700 text-yellow-100 rounded hover:bg-yellow-600 transition"
                                                                                    title="Bu rolü ana rol yap"
                                                                                >
                                                                                    ⭐ Ana Yap
                                                                                </button>
                                                                            )}
                                                                            {/* Rol Sil butonu - ana rol silinemez */}
                                                                            {!role.isPrimary && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const updatedRoles = editingUserProfile.roles?.filter((_, i) => i !== index);
                                                                                        setEditingUserProfile({
                                                                                            ...editingUserProfile,
                                                                                            roles: updatedRoles
                                                                                        });
                                                                                    }}
                                                                                    className="px-2 py-1 text-xs bg-red-700 text-red-100 rounded hover:bg-red-600 transition"
                                                                                    title="Bu rolü kaldır"
                                                                                >
                                                                                    🗑️
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 text-gray-400">
                                                                <p className="text-3xl mb-2">🎭</p>
                                                                <p>Henüz ek rol atanmamış</p>
                                                                <p className="text-xs mt-1">Mevcut ana rol: <span className="text-indigo-300 font-medium">{(editingUserProfile.adminType ? getRoleLabel(editingUserProfile.adminType) : null) || editingUserProfile.adminType || 'Atanmamış'}</span></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                                {/* Delete/Archive Button - Only for Super Admin */}
                                {admin?.adminType === 'super' && (
                                    <button
                                        onClick={() => {
                                            const isAdmin = editingUserProfile.isAdmin;
                                            setConfirmState({
                                                isOpen: true,
                                                title: isAdmin ? 'Kullanıcıyı Arşivle' : 'Kullanıcıyı Sil',
                                                message: isAdmin
                                                    ? 'Bu kullanıcı admin yetkisine sahip. Arşivlemek istediğinizden emin misiniz?'
                                                    : 'Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!',
                                                itemName: `${editingUserProfile.firstName} ${editingUserProfile.lastName}`.trim() || editingUserProfile.email,
                                                variant: isAdmin ? 'warning' : 'danger',
                                                confirmText: isAdmin ? 'Evet, Arşivle' : 'Evet, Sil',
                                                onConfirm: async () => {
                                                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                    try {
                                                        const userRef = doc(db, 'users', editingUserProfile.userId);
                                                        if (isAdmin) {
                                                            // Archive - set isArchived flag
                                                            await updateDoc(userRef, {
                                                                isArchived: true,
                                                                archivedAt: new Date(),
                                                                archivedBy: admin?.displayName || 'admin'
                                                            });
                                                            showToast('Kullanıcı arşivlendi', 'success');
                                                        } else {
                                                            // Try to delete user via API (Firebase Auth + Firestore)
                                                            try {
                                                                const response = await fetch('/api/admin/delete-user', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        userId: editingUserProfile.userId,
                                                                        email: editingUserProfile.email,
                                                                        phoneNumber: editingUserProfile.phone,
                                                                    }),
                                                                });

                                                                if (response.ok) {
                                                                    showToast('Kullanıcı tüm sistemlerden silindi', 'success');
                                                                } else {
                                                                    // API failed - fallback to direct Firestore delete
                                                                    throw new Error('API hatası - fallback moduna geçiliyor');
                                                                }
                                                            } catch (apiError) {
                                                                console.log('API delete failed, using Firestore fallback:', apiError);
                                                                // Fallback: Delete directly from Firestore (orphan record)
                                                                const userDocRef = doc(db, 'users', editingUserProfile.userId);
                                                                const adminDocRef = doc(db, 'admins', editingUserProfile.userId);
                                                                const profileDocRef = doc(db, 'user_profiles', editingUserProfile.userId);

                                                                await deleteDoc(userDocRef).catch(e => console.log('users delete:', e));
                                                                await deleteDoc(adminDocRef).catch(e => console.log('admins delete:', e));
                                                                await deleteDoc(profileDocRef).catch(e => console.log('user_profiles delete:', e));

                                                                showToast('Kullanıcı Firestore\'dan silindi (Auth kontrolü atlandı)', 'success');
                                                            }
                                                        }
                                                        setEditingUserProfile(null);
                                                        loadAllUsers();
                                                    } catch (error) {
                                                        console.error('Delete/archive error:', error);
                                                        const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
                                                        showToast(`İşlem başarısız: ${errorMsg}`, 'error');
                                                    }
                                                },
                                            });
                                        }}
                                        className={`px-4 py-3 rounded-lg font-medium transition ${editingUserProfile.isAdmin
                                            ? 'bg-amber-600 text-white hover:bg-amber-500'
                                            : 'bg-red-600 text-white hover:bg-red-500'
                                            }`}
                                    >
                                        {editingUserProfile.isAdmin ? '📦 Arşivle' : '🗑️ Sil'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setEditingUserProfile(null)}
                                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={async () => {
                                        // Validation: Non-super, non-kermes admins MUST have a business selected
                                        if (editingUserProfile.isAdmin && editingUserProfile.adminType !== 'super' && editingUserProfile.adminType !== 'kermes' && editingUserProfile.adminType !== 'kermes_staff' && !editingUserProfile.butcherId) {
                                            showToast('Admin rolü için işletme seçimi zorunludur!', 'error');
                                            return;
                                        }
                                        // Validation: Kermes admins MUST have an organization selected
                                        if (editingUserProfile.isAdmin && (editingUserProfile.adminType === 'kermes' || editingUserProfile.adminType === 'kermes_staff') && !editingUserProfile.organizationId) {
                                            showToast('Kermes rolü için organizasyon seçimi zorunludur!', 'error');
                                            return;
                                        }

                                        setSavingProfile(true);
                                        try {
                                            console.log('🔄 SAVE STARTED - userId:', editingUserProfile.userId);
                                            console.log('📊 Profile data:', JSON.stringify({
                                                firstName: editingUserProfile.firstName,
                                                lastName: editingUserProfile.lastName,
                                                email: editingUserProfile.email,
                                                phone: editingUserProfile.phone,
                                            }));

                                            // Update user document in users collection - use setDoc with merge for safety
                                            const userRef = doc(db, 'users', editingUserProfile.userId);

                                            // CRITICAL FIX: Clean phone number - only strip dial code if it starts with +
                                            let cleanPhone = editingUserProfile.phone || '';
                                            if (cleanPhone.startsWith('+')) {
                                                // Strip any dial code prefix if present (legacy data)
                                                for (const code of ['+49', '+90', '+43', '+41', '+1']) {
                                                    if (cleanPhone.startsWith(code)) {
                                                        cleanPhone = cleanPhone.slice(code.length);
                                                        break;
                                                    }
                                                }
                                            }

                                            // Prepare update data
                                            const updateData: Record<string, unknown> = {
                                                firstName: editingUserProfile.firstName,
                                                lastName: editingUserProfile.lastName,
                                                displayName: `${editingUserProfile.firstName} ${editingUserProfile.lastName}`.trim() || null,
                                                email: editingUserProfile.email,
                                                phoneNumber: (editingUserProfile.dialCode || '+49') + cleanPhone,
                                                dialCode: editingUserProfile.dialCode || '+49',
                                                address: editingUserProfile.address,
                                                houseNumber: editingUserProfile.houseNumber || null,
                                                addressLine2: editingUserProfile.addressLine2 || null,
                                                city: editingUserProfile.city,
                                                country: editingUserProfile.country,
                                                postalCode: editingUserProfile.postalCode,
                                                latitude: editingUserProfile.latitude || null,
                                                longitude: editingUserProfile.longitude || null,
                                                photoURL: editingUserProfile.photoURL || null,
                                                // ** CRITICAL: Save role info to users collection **
                                                isAdmin: editingUserProfile.isAdmin,
                                                adminType: editingUserProfile.isAdmin ? editingUserProfile.adminType : null,
                                                // ** NEW: Save activation status **
                                                isActive: editingUserProfile.isActive !== false, // Default true if undefined
                                                updatedAt: new Date(),
                                                updatedBy: admin?.email || 'admin'
                                            };

                                            // 📝 DEACTIVATION AUDIT: Track who/when/why if user is being deactivated
                                            if (editingUserProfile.isActive === false) {
                                                updateData.deactivatedBy = admin?.email || admin?.displayName || 'system';
                                                updateData.deactivatedAt = new Date();
                                                updateData.deactivationReason = 'Admin tarafından devre dışı bırakıldı';
                                            } else {
                                                // If reactivating, clear deactivation fields
                                                updateData.deactivatedBy = null;
                                                updateData.deactivatedAt = null;
                                                updateData.deactivationReason = null;
                                            }

                                            await setDoc(userRef, updateData, { merge: true });
                                            console.log('✅ users collection SAVED with isAdmin:', editingUserProfile.isAdmin, 'adminType:', editingUserProfile.adminType, 'isActive:', editingUserProfile.isActive);

                                            // Handle admin role changes - ONLY super admin can change roles
                                            const roleChanged = editingUserProfile.adminType !== editingUserProfile.originalAdminType ||
                                                editingUserProfile.isAdmin !== !!editingUserProfile.originalAdminType;

                                            if (roleChanged) {
                                                // Authorization check: Only super admin can change roles
                                                if (admin?.adminType !== 'super') {
                                                    showToast('Rol değiştirme yetkisi sadece Süper Admin\'a aittir', 'error');
                                                    setSavingProfile(false);
                                                    return;
                                                }
                                            }

                                            if (editingUserProfile.isAdmin && editingUserProfile.adminType) {
                                                // Use existing admin doc ID if available, otherwise use userId
                                                const adminDocId = editingUserProfile.adminDocId || editingUserProfile.userId;
                                                const adminRef = doc(db, 'admins', adminDocId);
                                                const existingAdminDoc = await getDoc(adminRef);

                                                if (existingAdminDoc.exists()) {
                                                    // Update existing admin - use BOTH adminType and type for compatibility
                                                    await updateDoc(adminRef, {
                                                        adminType: editingUserProfile.adminType,
                                                        type: editingUserProfile.adminType, // For backward compatibility
                                                        displayName: `${editingUserProfile.firstName} ${editingUserProfile.lastName}`,
                                                        firstName: editingUserProfile.firstName,
                                                        lastName: editingUserProfile.lastName,
                                                        email: editingUserProfile.email,
                                                        phoneNumber: editingUserProfile.phone,
                                                        butcherId: editingUserProfile.butcherId || null, // Required for business isolation
                                                        butcherName: editingUserProfile.butcherName || null,
                                                        // 🆕 Organization support for kermes roles
                                                        organizationId: editingUserProfile.organizationId || null,
                                                        organizationName: editingUserProfile.organizationName || null,
                                                        // 🆕 ÇOKLU ROL DESTEĞİ
                                                        roles: editingUserProfile.roles || [],
                                                        // CRITICAL: Sync photoURL to admin record for header display
                                                        photoURL: editingUserProfile.photoURL || null,
                                                        isActive: true,
                                                        updatedAt: new Date(),
                                                        updatedBy: admin?.email || 'system',
                                                        // 🟣 Primary Admin flag - only Super Admin can set
                                                        ...(admin?.adminType === 'super' ? { isPrimaryAdmin: (editingUserProfile as any).isPrimaryAdmin || false } : {}),
                                                        // 🚗 Driver flag - only Super Admin can set
                                                        ...(admin?.adminType === 'super' ? { isDriver: (editingUserProfile as any).isDriver || false } : {}),
                                                        // 🚚 Driver type - lokma_fleet or business
                                                        ...(admin?.adminType === 'super' && (editingUserProfile as any).isDriver ? { driverType: (editingUserProfile as any).driverType || 'business' } : {}),
                                                        // 🪑 Assigned tables for waiter
                                                        assignedTables: (editingUserProfile as any).assignedTables || [],
                                                    });
                                                } else {
                                                    // Create new admin record with userId as doc ID
                                                    await setDoc(doc(db, 'admins', editingUserProfile.userId), {
                                                        firebaseUid: editingUserProfile.userId,
                                                        displayName: `${editingUserProfile.firstName} ${editingUserProfile.lastName}`,
                                                        firstName: editingUserProfile.firstName,
                                                        lastName: editingUserProfile.lastName,
                                                        email: editingUserProfile.email,
                                                        phoneNumber: editingUserProfile.phone,
                                                        adminType: editingUserProfile.adminType,
                                                        type: editingUserProfile.adminType, // For backward compatibility
                                                        butcherId: editingUserProfile.butcherId || null, // Required for business isolation
                                                        butcherName: editingUserProfile.butcherName || null,
                                                        // 🆕 Organization support for kermes roles
                                                        organizationId: editingUserProfile.organizationId || null,
                                                        organizationName: editingUserProfile.organizationName || null,
                                                        // 🆕 ÇOKLU ROL DESTEĞİ
                                                        roles: editingUserProfile.roles || [],
                                                        // CRITICAL: Copy photoURL to admin record for header display
                                                        photoURL: editingUserProfile.photoURL || null,
                                                        role: 'admin',
                                                        isActive: true,
                                                        createdAt: new Date(),
                                                        createdBy: admin?.email || 'system',
                                                        // 🟣 Primary Admin flag - only Super Admin can set
                                                        ...(admin?.adminType === 'super' ? { isPrimaryAdmin: (editingUserProfile as any).isPrimaryAdmin || false } : {}),
                                                        // 🚗 Driver flag - only Super Admin can set
                                                        ...(admin?.adminType === 'super' ? { isDriver: (editingUserProfile as any).isDriver || false } : {}),
                                                        // 🚚 Driver type - lokma_fleet or business
                                                        ...(admin?.adminType === 'super' && (editingUserProfile as any).isDriver ? { driverType: (editingUserProfile as any).driverType || 'business' } : {}),
                                                        // 🪑 Assigned tables for waiter
                                                        assignedTables: (editingUserProfile as any).assignedTables || [],
                                                    });

                                                    // 🎉 SEND ADMIN PROMOTION NOTIFICATIONS
                                                    const roleName = getRoleLabel(editingUserProfile.adminType) || editingUserProfile.adminType;
                                                    const businessInfo = editingUserProfile.butcherName || 'Tüm İşletmeler';

                                                    // Send Email notification
                                                    if (editingUserProfile.email) {
                                                        try {
                                                            await fetch('/api/email/send', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    to: editingUserProfile.email,
                                                                    subject: '🎖️ LOKMA Admin Yetkiniz Aktif!',
                                                                    html: `
                                                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                                                        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 12px; text-align: center;">
                                                                            <h1 style="color: white; margin: 0; font-size: 28px;">🎖️ LOKMA Admin</h1>
                                                                            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Yönetim Paneli Erişimi</p>
                                                                        </div>
                                                                        
                                                                        <div style="padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;">
                                                                            <h2 style="color: #1f2937; margin-top: 0;">Tebrikler ${editingUserProfile.firstName}! 🎉</h2>
                                                                            
                                                                            <p style="color: #4b5563; line-height: 1.6;">
                                                                                LOKMA platformunda yönetici yetkiniz aktif edildi.
                                                                            </p>
                                                                            
                                                                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                                                                                <p style="margin: 0; color: #374151;"><strong>👤 İsim:</strong> ${editingUserProfile.firstName} ${editingUserProfile.lastName}</p>
                                                                                <p style="margin: 8px 0 0 0; color: #374151;"><strong>🎯 Rol:</strong> ${roleName}</p>
                                                                                <p style="margin: 8px 0 0 0; color: #374151;"><strong>🏪 İşletme:</strong> ${businessInfo}</p>
                                                                                <p style="margin: 8px 0 0 0; color: #374151;"><strong>📧 E-posta:</strong> ${editingUserProfile.email}</p>
                                                                            </div>
                                                                            
                                                                            <a href="https://lokma.shop/admin" style="display: inline-block; background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">
                                                                                🚀 Admin Paneline Git
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                `,
                                                                }),
                                                            });
                                                            console.log('✅ Admin promotion email sent');
                                                        } catch (e) {
                                                            console.log('❌ Admin promotion email failed:', e);
                                                        }
                                                    }

                                                    // Send SMS notification
                                                    if (editingUserProfile.phone) {
                                                        try {
                                                            await fetch('/api/sms/send', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    to: editingUserProfile.phone,
                                                                    message: `LOKMA - Tebrikler ${editingUserProfile.firstName}! ${roleName} olarak atandiniz. Admin Panel: https://lokma.shop/admin`,
                                                                }),
                                                            });
                                                            console.log('✅ Admin promotion SMS sent');
                                                        } catch (e) {
                                                            console.log('❌ Admin promotion SMS failed:', e);
                                                        }
                                                    }
                                                }
                                            } else if (!editingUserProfile.isAdmin) {
                                                // User should not be admin - deactivate admin record if exists
                                                // Check BOTH adminDocId and userId since admin records can use either
                                                const possibleAdminIds = [
                                                    editingUserProfile.adminDocId,
                                                    editingUserProfile.userId
                                                ].filter(Boolean) as string[];

                                                for (const adminId of possibleAdminIds) {
                                                    try {
                                                        const adminRef = doc(db, 'admins', adminId);
                                                        const existingAdminDoc = await getDoc(adminRef);
                                                        if (existingAdminDoc.exists()) {
                                                            await updateDoc(adminRef, {
                                                                isActive: false,
                                                                adminType: null,
                                                                butcherId: null,
                                                                butcherName: null,
                                                                updatedAt: new Date(),
                                                                updatedBy: admin?.email || 'system',
                                                                // 📝 DEACTIVATION AUDIT TRAIL
                                                                deactivatedBy: admin?.email || admin?.displayName || 'system',
                                                                deactivatedAt: new Date(),
                                                                deactivationReason: 'Admin rolü kaldırıldı - Kullanıcıya indirgendi',
                                                            });
                                                            console.log(`✅ Admin record deactivated: ${adminId}`);
                                                            break; // Found and deactivated, no need to check more
                                                        }
                                                    } catch (e) {
                                                        console.log(`❌ Error checking admin ${adminId}:`, e);
                                                    }
                                                }

                                                // Also clear butcherId and butcherName from users collection
                                                const userRef = doc(db, 'users', editingUserProfile.userId);
                                                await updateDoc(userRef, {
                                                    butcherId: null,
                                                    butcherName: null,
                                                    adminType: null,
                                                    isAdmin: false,
                                                });
                                                console.log('✅ User demoted: business assignment cleared');
                                            }

                                            showToast('Kullanıcı profili güncellendi', 'success');
                                            setEditingUserProfile(null);
                                            // Refresh user list
                                            if (showAllUsers) {
                                                loadAllUsers(allUsersPage);
                                            } else {
                                                searchUsers(searchQuery, false);
                                            }
                                        } catch (error) {
                                            console.error('Error updating user:', error);
                                            showToast('Güncelleme hatası', 'error');
                                        } finally {
                                            setSavingProfile(false);
                                        }
                                    }}
                                    disabled={savingProfile}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-bold transition disabled:opacity-50"
                                >
                                    {savingProfile ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal - Styled */}
            {
                deleteModal?.show && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-2xl w-full p-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl">⚠️</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Kullanıcıyı Sil</h3>
                                <p className="text-gray-400">
                                    <span className="font-semibold text-white">"{deleteModal.userName}"</span> kullanıcısını silmek istediğinize emin misiniz?
                                </p>
                                <p className="text-red-400 text-sm mt-2 flex items-center justify-center gap-1">
                                    ⚠️ Bu işlem geri alınamaz!
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteModal(null)}
                                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={confirmDeleteUser}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 font-bold transition"
                                >
                                    🗑️ Evet, Sil
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 🆕 ROL EKLEME MODAL */}
            {showAddRoleModal && editingUserProfile && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-gray-800 rounded-xl border border-indigo-600 shadow-2xl max-w-2xl w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                ➕ Yeni Rol Ekle
                            </h3>
                            <button
                                onClick={() => setShowAddRoleModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Rol Türü Seçimi */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Rol Türü</label>
                                <select
                                    value={newRoleType}
                                    onChange={(e) => {
                                        setNewRoleType(e.target.value);
                                        // Rol değişince işletme/organizasyon sıfırla
                                        setNewRoleBusinessId('');
                                        setNewRoleBusinessName('');
                                        setNewRoleOrganizationId('');
                                        setNewRoleOrganizationName('');
                                    }}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500"
                                >
                                    <option value="">-- Rol Seçin --</option>
                                    <optgroup label="İşletme Rolleri">
                                        <option value="isletme_admin">🏪 İşletme Admin</option>
                                        <option value="isletme_staff">🏪 İşletme Personel</option>
                                    </optgroup>
                                    <optgroup label="Organizasyon Rolleri">
                                        <option value="kermes">🎪 Kermes Admin</option>
                                        <option value="kermes_staff">🎪 Kermes Personel</option>
                                    </optgroup>
                                </select>
                            </div>

                            {/* İşletme Seçimi (isletme_admin, isletme_staff için) */}
                            {newRoleType && ['isletme_admin', 'isletme_staff'].includes(newRoleType) && (
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">
                                        🏪 İşletme Seçimi <span className="text-red-500">*</span>
                                    </label>
                                    {newRoleBusinessId ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2 bg-green-900/30 border border-green-600 text-green-200 rounded-lg">
                                                ✅ {newRoleBusinessName}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewRoleBusinessId('');
                                                    setNewRoleBusinessName('');
                                                    setNewRoleBusinessSearch('');
                                                }}
                                                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            {/* 🆕 ARAMA INPUT */}
                                            <div className="relative mb-2">
                                                <input
                                                    type="text"
                                                    value={newRoleBusinessSearch}
                                                    onChange={(e) => setNewRoleBusinessSearch(e.target.value)}
                                                    placeholder="🔍 İşletme adı veya şehir ara..."
                                                    className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    autoFocus
                                                />
                                                {newRoleBusinessSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewRoleBusinessSearch('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            {/* Sonuç Listesi */}
                                            <div className="max-h-48 overflow-y-auto bg-gray-700 rounded-lg border border-gray-600">
                                                {loadingButchers ? (
                                                    <div className="p-3 text-center text-gray-400">⏳ Yükleniyor...</div>
                                                ) : (
                                                    (() => {
                                                        const searchLower = newRoleBusinessSearch.toLowerCase().trim();
                                                        const filtered = searchLower
                                                            ? butcherList.filter(b =>
                                                                b.name?.toLowerCase().includes(searchLower) ||
                                                                b.city?.toLowerCase().includes(searchLower) ||
                                                                b.postalCode?.toLowerCase().includes(searchLower)
                                                            )
                                                            : butcherList;
                                                        const results = filtered.slice(0, 30);

                                                        if (results.length === 0) {
                                                            return (
                                                                <div className="p-4 text-center text-gray-400">
                                                                    <p className="text-2xl mb-2">🔍</p>
                                                                    <p>"{newRoleBusinessSearch}" bulunamadı</p>
                                                                    <p className="text-xs mt-1">Farklı bir arama deneyin</p>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                {searchLower && (
                                                                    <div className="px-3 py-1.5 bg-indigo-900/30 text-indigo-300 text-xs border-b border-gray-600">
                                                                        🔍 {results.length} sonuç bulundu
                                                                    </div>
                                                                )}
                                                                {results.map(b => (
                                                                    <button
                                                                        key={b.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setNewRoleBusinessId(b.id);
                                                                            setNewRoleBusinessName(`${b.name} - ${b.city}`);
                                                                            setNewRoleBusinessSearch('');
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-indigo-600/30 border-b border-gray-600 last:border-b-0 transition"
                                                                    >
                                                                        <div className="text-white text-sm font-medium">{b.name}</div>
                                                                        <div className="text-gray-400 text-xs">📍 {b.city}</div>
                                                                    </button>
                                                                ))}
                                                            </>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Organizasyon Seçimi (kermes için) */}
                            {newRoleType && ['kermes', 'kermes_staff'].includes(newRoleType) && (
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">
                                        🕌 Organizasyon Seçimi <span className="text-red-500">*</span>
                                    </label>
                                    {newRoleOrganizationId ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2 bg-emerald-900/30 border border-emerald-600 text-emerald-200 rounded-lg">
                                                🕌 {newRoleOrganizationName}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewRoleOrganizationId('');
                                                    setNewRoleOrganizationName('');
                                                    setNewRoleOrgSearch('');
                                                }}
                                                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            {/* 🆕 ARAMA INPUT */}
                                            <div className="relative mb-2">
                                                <input
                                                    type="text"
                                                    value={newRoleOrgSearch}
                                                    onChange={(e) => setNewRoleOrgSearch(e.target.value)}
                                                    placeholder="🔍 Posta kodu, şehir veya dernek adı ara..."
                                                    className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                    autoFocus
                                                />
                                                {newRoleOrgSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewRoleOrgSearch('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            {/* Sonuç Listesi */}
                                            <div className="max-h-48 overflow-y-auto bg-gray-700 rounded-lg border border-gray-600">
                                                {loadingOrganizations ? (
                                                    <div className="p-3 text-center text-gray-400">⏳ Yükleniyor...</div>
                                                ) : (
                                                    (() => {
                                                        const searchLower = newRoleOrgSearch.toLowerCase().trim();
                                                        const filtered = searchLower
                                                            ? organizationList.filter(o =>
                                                                o.name?.toLowerCase().includes(searchLower) ||
                                                                o.shortName?.toLowerCase().includes(searchLower) ||
                                                                o.city?.toLowerCase().includes(searchLower) ||
                                                                o.postalCode?.includes(searchLower)
                                                            )
                                                            : organizationList;
                                                        const results = filtered.slice(0, 30);

                                                        if (results.length === 0) {
                                                            return (
                                                                <div className="p-4 text-center text-gray-400">
                                                                    <p className="text-2xl mb-2">🔍</p>
                                                                    <p>"{newRoleOrgSearch}" bulunamadı</p>
                                                                    <p className="text-xs mt-1">Farklı bir arama deneyin</p>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                {searchLower && (
                                                                    <div className="px-3 py-1.5 bg-emerald-900/30 text-emerald-300 text-xs border-b border-gray-600">
                                                                        🔍 {results.length} sonuç bulundu
                                                                    </div>
                                                                )}
                                                                {results.map(o => (
                                                                    <button
                                                                        key={o.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setNewRoleOrganizationId(o.id);
                                                                            setNewRoleOrganizationName(`${o.shortName || o.name} - ${o.city}`);
                                                                            setNewRoleOrgSearch('');
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-emerald-600/30 border-b border-gray-600 last:border-b-0 transition"
                                                                    >
                                                                        <div className="text-white text-sm font-medium">🕌 {o.shortName || o.name}</div>
                                                                        <div className="text-gray-400 text-xs">📍 {o.postalCode && `${o.postalCode} `}{o.city}</div>
                                                                    </button>
                                                                ))}
                                                            </>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Buttons */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                            <button
                                onClick={() => setShowAddRoleModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newRoleType) {
                                        showToast('Lütfen rol türü seçin', 'error');
                                        return;
                                    }

                                    const needsBusiness = ['isletme_admin', 'isletme_staff'].includes(newRoleType);
                                    const needsOrg = ['kermes', 'kermes_staff'].includes(newRoleType);

                                    if (needsBusiness && !newRoleBusinessId) {
                                        showToast('Lütfen işletme seçin', 'error');
                                        return;
                                    }

                                    if (needsOrg && !newRoleOrganizationId) {
                                        showToast('Lütfen organizasyon seçin', 'error');
                                        return;
                                    }

                                    // Yeni rol objesi oluştur
                                    const newRole = {
                                        type: newRoleType,
                                        businessId: newRoleBusinessId || undefined,
                                        businessName: newRoleBusinessName || undefined,
                                        organizationId: newRoleOrganizationId || undefined,
                                        organizationName: newRoleOrganizationName || undefined,
                                        isPrimary: !editingUserProfile.roles || editingUserProfile.roles.length === 0, // İlk rol ana rol olur
                                        isActive: true,
                                        assignedAt: new Date(),
                                        assignedBy: admin?.email || 'system'
                                    };

                                    // Mevcut rollere ekle
                                    const updatedRoles = [...(editingUserProfile.roles || []), newRole];

                                    setEditingUserProfile({
                                        ...editingUserProfile,
                                        roles: updatedRoles,
                                        // İlk rol ekleniyorsa ana rol olarak da ayarla
                                        ...(newRole.isPrimary ? {
                                            adminType: newRoleType,
                                            butcherId: newRoleBusinessId || '',
                                            butcherName: newRoleBusinessName || '',
                                            organizationId: newRoleOrganizationId || '',
                                            organizationName: newRoleOrganizationName || ''
                                        } : {})
                                    });

                                    setShowAddRoleModal(false);
                                    showToast(`${getRoleLabel(newRoleType) || newRoleType} rolü eklendi`, 'success');
                                }}
                                disabled={!newRoleType || addingRole}
                                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addingRole ? '⏳ Ekleniyor...' : '➕ Rol Ekle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ConfirmModal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                itemName={confirmState.itemName}
                variant={confirmState.variant}
                confirmText={confirmState.confirmText}
            />
        </div >
    )
}
