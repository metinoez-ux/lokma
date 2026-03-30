'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Admin } from '@/types';
import { isSuperAdmin } from '@/lib/config';
import {
    getEffectivePermissions,
    getDefaultGroupForAdminType,
    clearPermissionCache,
    type PermissionSubject,
    type PermissionMap,
} from '@/lib/permissions';

// Session invalidation reasons
export type LogoutReason =
    | 'account_deactivated'
    | 'account_deleted'
    | 'business_disconnected'
    | 'role_changed'
    | 'manual';

interface AdminContextType {
    admin: Admin | null;
    loading: boolean;
    refreshAdmin: () => Promise<void>;
    forceLogout: (reason: LogoutReason) => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
    admin: null,
    loading: true,
    refreshAdmin: async () => { },
    forceLogout: async () => { },
});

export const useAdmin = () => useContext(AdminContext);

// 🔐 Resolve RBAC 2.0 permissions for an admin
const resolvePermissions = (admin: Admin): Admin => {
    // Clear the permission cache when resolving fresh data
    clearPermissionCache();

    // If already has a resolved permissionMap, use it
    if (admin.permissionMap && Object.keys(admin.permissionMap).length > 0) {
        return admin;
    }

    // Auto-assign permission group from adminType if not set
    const groupId = admin.permissionGroupId || getDefaultGroupForAdminType(admin.adminType || '');

    // Build permission subject
    const subject: PermissionSubject = {
        adminType: admin.adminType,
        permissionGroupId: groupId,
        permissions: admin.permissionMap as PermissionMap | undefined,
        permissionOverrides: admin.permissionOverrides as Partial<PermissionMap> | undefined,
    };

    // Resolve effective permissions
    const effectivePermissions = getEffectivePermissions(subject);

    return {
        ...admin,
        permissionGroupId: groupId,
        permissionMap: effectivePermissions as Record<string, boolean>,
    };
};

// 🪄 Virtual Active Context Injection
// This intercepts the Admin object and overrides its legacy fields (businessId, adminType)
// to match the currently selected Assignment. This ensures ALL existing code works un-modified!
const applyVirtualContext = (admin: Admin): Admin => {
    // Super admins have global scope, no virtual context needed
    if (admin.role === 'super_admin') return admin;
    
    let clonedAdmin = { ...admin };

    // Auto-migrate in memory if zero assignments but legacy field exists
    if (!clonedAdmin.assignments || clonedAdmin.assignments.length === 0) {
        if (clonedAdmin.businessId || clonedAdmin.kermesId) {
            clonedAdmin.assignments = [{
                id: clonedAdmin.businessId || clonedAdmin.kermesId || 'legacy_id',
                entityId: clonedAdmin.businessId || clonedAdmin.kermesId || 'legacy_id',
                entityType: clonedAdmin.kermesId ? 'kermes' : 'business',
                entityName: clonedAdmin.businessName || 'Legacy Entity',
                role: clonedAdmin.adminType
            }];
        } else {
            return clonedAdmin; // No assignments and no legacy logic
        }
    }

    let activeAssignmentId: string | null = null;
    if (typeof window !== 'undefined') {
        activeAssignmentId = localStorage.getItem('mira_active_assignment_id');
    }

    let activeAssignment = clonedAdmin.assignments?.find(a => a.id === activeAssignmentId);
    
    // If not found or empty, default to the very first assignment
    if (!activeAssignment && clonedAdmin.assignments && clonedAdmin.assignments.length > 0) {
        activeAssignment = clonedAdmin.assignments[0];
        if (typeof window !== 'undefined') {
            localStorage.setItem('mira_active_assignment_id', activeAssignment.id);
        }
    }

    if (activeAssignment) {
        // Override fields so the rest of the application perceives the user as only having this specific role
        return {
            ...clonedAdmin,
            adminType: activeAssignment.role,
            businessId: activeAssignment.entityType === 'business' ? activeAssignment.entityId : undefined,
            kermesId: activeAssignment.entityType === 'kermes' ? activeAssignment.entityId : undefined,
            businessName: activeAssignment.entityType === 'business' ? activeAssignment.entityName : clonedAdmin.businessName,
        };
    }
    
    return clonedAdmin;
};

// 📸 Helper to always ensure we have a photoURL if possible
const enrichAdminData = async (baseAdmin: Admin): Promise<Admin> => {
    // 1. Inject Virtual Context
    const contextAdmin = applyVirtualContext(baseAdmin);

    // 2. Resolve permissions first
    const permissionedAdmin = resolvePermissions(contextAdmin);

    const adminAny = permissionedAdmin as any;
    if (adminAny.photoURL) return permissionedAdmin;

    try {
        const targetUserId = adminAny.firebaseUid || permissionedAdmin.id;

        // 1. Check Auth (Priority)
        if (auth.currentUser && (auth.currentUser.uid === targetUserId || auth.currentUser.uid === permissionedAdmin.id)) {
            if (auth.currentUser.photoURL) {
                console.log('📸 [Enrich] Hydrated photoURL from Auth');
                return { ...permissionedAdmin, photoURL: auth.currentUser.photoURL } as any;
            }
        }

        // 2. Check Users Collection (Fallback)
        if (targetUserId) {
            const userDoc = await getDoc(doc(db, 'users', targetUserId));
            if (userDoc.exists() && userDoc.data()?.photoURL) {
                console.log('📸 [Enrich] Hydrated photoURL from DB');
                return { ...permissionedAdmin, photoURL: userDoc.data().photoURL } as any;
            }
        }
    } catch (e) {
        console.warn('📸 [Enrich] Error:', e);
    }
    return permissionedAdmin;
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Track current admin doc ID for real-time listener
    const adminIdRef = useRef<string | null>(null);
    const unsubscribeAdminRef = useRef<(() => void) | null>(null);
    const unsubscribePromotionRef = useRef<(() => void) | null>(null);

    // Logout reason messages (Turkish)
    const logoutReasonMessages: Record<LogoutReason, string> = {
        account_deactivated: 'Hesabınız devre dışı bırakıldı.',
        account_deleted: 'Admin kaydınız silindi.',
        business_disconnected: 'İşletme bağlantınız kaldırıldı.',
        role_changed: 'Yetki değişikliği nedeniyle tekrar giriş yapmanız gerekiyor.',
        manual: '',
    };

    // Force logout function - immediately logs out user with a reason
    const forceLogout = useCallback(async (reason: LogoutReason) => {
        console.log('🔒 Force logout triggered:', reason);

        // Clear cached profile
        if (typeof window !== 'undefined') {
            localStorage.removeItem('mira_admin_profile');
            // Store reason to display on login page
            if (reason !== 'manual') {
                sessionStorage.setItem('logout_reason', logoutReasonMessages[reason]);
            }
        }

        // Clear admin state
        setAdmin(null);

        // Unsubscribe from real-time listener
        if (unsubscribeAdminRef.current) {
            unsubscribeAdminRef.current();
            unsubscribeAdminRef.current = null;
        }
        adminIdRef.current = null;

        // Sign out from Firebase
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }

        // Redirect to login
        router.push('/login');
    }, [router]);

    // Setup real-time listener for admin document changes
    const setupRealtimeListener = useCallback((adminId: string, currentAdmin: Admin) => {
        // Don't listen for super admins (they're defined in config, not Firestore)
        if (currentAdmin.role === 'super_admin' && currentAdmin.createdBy === 'system') {
            console.log('⚡ Skipping real-time listener for config-based super admin');
            return;
        }

        // Clean up previous listener
        if (unsubscribeAdminRef.current) {
            unsubscribeAdminRef.current();
        }

        console.log('👁️ Setting up real-time admin listener for:', adminId);
        adminIdRef.current = adminId;

        const unsubscribe = onSnapshot(
            doc(db, 'admins', adminId),
            async (snapshot) => {
                if (!snapshot.exists()) {
                    // Admin record was deleted
                    console.log('🚨 Admin record deleted - forcing logout');
                    forceLogout('account_deleted');
                    return;
                }

                const adminData = snapshot.data() as Admin;

                // Check if account was deactivated
                if (adminData.isActive === false) {
                    console.log('🚨 Admin account deactivated - forcing logout');
                    forceLogout('account_deactivated');
                    return;
                }

                // Check if business connection was removed (for non-super admins)
                // 🔑 UNIVERSAL: Check businessId first, then legacy fields
                const currentBusinessId = currentAdmin.businessId || currentAdmin.butcherId || currentAdmin.restaurantId;
                const newBusinessId = adminData.businessId || adminData.butcherId || adminData.restaurantId;

                if (currentBusinessId && !newBusinessId) {
                    console.log('🚨 Business connection removed - forcing logout');
                    forceLogout('business_disconnected');
                    return;
                }

                // Check if role changed significantly
                if (adminData.role !== currentAdmin.role || adminData.adminType !== currentAdmin.adminType) {
                    console.log('🔄 Admin role changed - forcing re-login');
                    forceLogout('role_changed');
                    return;
                }

                // Update admin state with latest data (for non-critical changes like name)
                // Update admin state with latest data - ENRICHED
                const baseAdmin = { ...adminData, id: snapshot.id } as Admin;
                const updatedAdmin = await enrichAdminData(baseAdmin);

                // 🔒 Security Check: Force Password Reset
                if ((updatedAdmin as any).requirePasswordChange === true) {
                    if (typeof window !== 'undefined' && !window.location.pathname.includes('/force-password-reset')) {
                        console.log('🚨 User requires password reset. Redirecting...');
                        router.push('/force-password-reset');
                    }
                }

                setAdmin(updatedAdmin);

                // Update cache
                if (typeof window !== 'undefined') {
                    localStorage.setItem('mira_admin_profile', JSON.stringify(updatedAdmin));
                }
            },
            (error) => {
                console.error('Real-time admin listener error:', error);
            }
        );

        unsubscribeAdminRef.current = unsubscribe;
    }, [forceLogout]);

    // Setup promotion listener - watches for NEW admin records matching current user
    const setupPromotionListener = useCallback((userId: string, userEmail: string | null, userPhone: string | null) => {
        // Clean up previous promotion listener
        if (unsubscribePromotionRef.current) {
            unsubscribePromotionRef.current();
            unsubscribePromotionRef.current = null;
        }

        // No point in listening if no identifiers
        if (!userEmail && !userPhone) {
            console.log('⚠️ No email or phone to listen for admin promotion');
            return;
        }

        console.log('👀 Setting up admin promotion listener for:', userEmail || userPhone);

        const { collection, query, where, onSnapshot: onSnapshotQuery } = require('firebase/firestore');

        // Build queries for email and phone
        const queries: any[] = [];

        if (userEmail) {
            queries.push(query(collection(db, 'admins'), where('email', '==', userEmail)));
        }

        if (userPhone) {
            const normalizedPhone = userPhone.replace(/[\s\-()]/g, '');
            queries.push(query(collection(db, 'admins'), where('phoneNumber', '==', normalizedPhone)));
            // Also try without + prefix variations
            const phoneDigits = userPhone.replace(/\D/g, '');
            if (phoneDigits !== normalizedPhone) {
                queries.push(query(collection(db, 'admins'), where('phoneNumber', '==', `+${phoneDigits}`)));
            }
        }

        // Listen to each query
        const unsubscribes: (() => void)[] = [];

        queries.forEach((q: any) => {
            const unsub = onSnapshotQuery(q, (snapshot: any) => {
                if (!snapshot.empty) {
                    const adminDoc = snapshot.docs[0];
                    const adminData = adminDoc.data();

                    // Only promote if admin is active
                    if (adminData.isActive !== false) {
                        console.log('🎉 Admin promotion detected! Granting access...');

                        const promotedAdmin = { ...adminData, id: adminDoc.id } as Admin;
                        setAdmin(promotedAdmin);

                        // Cache the profile
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('mira_admin_profile', JSON.stringify(promotedAdmin));
                        }

                        // Stop promotion listener and start admin listener
                        if (unsubscribePromotionRef.current) {
                            unsubscribePromotionRef.current();
                            unsubscribePromotionRef.current = null;
                        }

                        // Setup real-time listener for future changes
                        setupRealtimeListener(adminDoc.id, promotedAdmin);

                        // Redirect to admin dashboard or password reset
                        if ((promotedAdmin as any).requirePasswordChange === true) {
                            if (typeof window !== 'undefined' && !window.location.pathname.includes('/force-password-reset')) {
                                router.push('/force-password-reset');
                            }
                        } else {
                            router.push('/admin/dashboard');
                        }
                    }
                }
            }, (error: any) => {
                console.error('Admin promotion listener error:', error);
            });

            unsubscribes.push(unsub);
        });

        // Combined unsubscribe function
        unsubscribePromotionRef.current = () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [router, setupRealtimeListener]);

    const loadAdmin = useCallback(async (userId: string, email: string | null, displayName: string | null, phoneNumber: string | null = null) => {
        try {
            // Check email whitelist first for super admin access
            let adminProfile: Admin | null = null;

            if (email && isSuperAdmin(email)) {
                adminProfile = {
                    id: userId,
                    email: email || '',
                    displayName: displayName || 'Super Admin',
                    role: 'super_admin',
                    adminType: 'super',
                    permissions: [],
                    isActive: true,
                    createdAt: new Date(),
                    createdBy: 'system',
                } as Admin;
            } else {
                // Strategy 1: Check Firestore admins collection by UID
                const adminDoc = await getDoc(doc(db, 'admins', userId));
                if (adminDoc.exists()) {
                    adminProfile = { id: adminDoc.id, ...adminDoc.data() } as Admin;
                } else {
                    // Strategy 2: Search by phone number (for phone auth login)
                    const userPhoneNumber = phoneNumber || auth.currentUser?.phoneNumber;
                    if (userPhoneNumber) {
                        const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');

                        // Normalize phone number for search
                        const normalizedPhone = userPhoneNumber.replace(/\s/g, '');

                        const phoneQuery = query(
                            collection(db, 'admins'),
                            where('phoneNumber', '==', normalizedPhone)
                        );
                        const phoneSnapshot = await getDocs(phoneQuery);

                        if (!phoneSnapshot.empty) {
                            const matchedAdmin = phoneSnapshot.docs[0];
                            adminProfile = { id: matchedAdmin.id, ...matchedAdmin.data() } as Admin;

                            // Link Firebase UID to this admin record for future logins
                            console.log('🔗 Linking Firebase UID to existing admin:', matchedAdmin.id);
                            await updateDoc(doc(db, 'admins', matchedAdmin.id), {
                                firebaseUid: userId,
                                linkedAt: new Date(),
                            });
                        } else {
                            // Try alternative phone formats (+49 vs 0049 vs without prefix)
                            const altPhones = [
                                normalizedPhone,
                                normalizedPhone.replace('+49', '0049'),
                                normalizedPhone.replace('+49', '0'),
                                '0' + normalizedPhone.slice(-10), // Last 10 digits with 0 prefix
                            ];

                            for (const altPhone of altPhones) {
                                const altQuery = query(
                                    collection(db, 'admins'),
                                    where('phoneNumber', '==', altPhone)
                                );
                                const altSnapshot = await getDocs(altQuery);

                                if (!altSnapshot.empty) {
                                    const matchedAdmin = altSnapshot.docs[0];
                                    adminProfile = { id: matchedAdmin.id, ...matchedAdmin.data() } as Admin;

                                    // Link Firebase UID
                                    console.log('🔗 Linking Firebase UID (alt phone) to admin:', matchedAdmin.id);
                                    await updateDoc(doc(db, 'admins', matchedAdmin.id), {
                                        firebaseUid: userId,
                                        phoneNumber: normalizedPhone, // Update to normalized format
                                        linkedAt: new Date(),
                                    });
                                    break;
                                }
                            }
                        }
                    }

                    // Strategy 3: Search by email if phone not found
                    if (!adminProfile && email) {
                        const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
                        const emailQuery = query(
                            collection(db, 'admins'),
                            where('email', '==', email)
                        );
                        const emailSnapshot = await getDocs(emailQuery);

                        if (!emailSnapshot.empty) {
                            const matchedAdmin = emailSnapshot.docs[0];
                            adminProfile = { id: matchedAdmin.id, ...matchedAdmin.data() } as Admin;

                            // Link Firebase UID
                            console.log('🔗 Linking Firebase UID (email) to admin:', matchedAdmin.id);
                            await updateDoc(doc(db, 'admins', matchedAdmin.id), {
                                firebaseUid: userId,
                                linkedAt: new Date(),
                            });
                        }
                    }
                }
            }

            if (adminProfile) {
                // Enrich and set
                const enrichedAdmin = await enrichAdminData(adminProfile);

                // 🔒 Security Check: Force Password Reset
                if ((enrichedAdmin as any).requirePasswordChange === true) {
                    if (typeof window !== 'undefined' && !window.location.pathname.includes('/force-password-reset')) {
                        console.log('🚨 Profile loaded, user requires password reset. Redirecting...');
                        router.push('/force-password-reset');
                    }
                }

                setAdmin(enrichedAdmin);
                // Cache the profile
                if (typeof window !== 'undefined') {
                    localStorage.setItem('mira_admin_profile', JSON.stringify(enrichedAdmin));
                }
                // Setup real-time listener for permission changes
                setupRealtimeListener(enrichedAdmin.id, enrichedAdmin);
            } else {
                setAdmin(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('mira_admin_profile');
                }
                // Start listening for admin promotion (if user gets added as admin while logged in)
                setupPromotionListener(userId, email, phoneNumber);
            }
        } catch (error) {
            console.error('Error loading admin:', error);
            setAdmin(null);
        }
        setLoading(false);
    }, [setupRealtimeListener, setupPromotionListener]);

    const refreshAdmin = useCallback(async () => {
        if (auth.currentUser) {
            // Keep loading true ONLY if we don't have an admin yet (or if explicitly desired)
            // Ideally for refresh we might want to show a spinner, but background refresh is better.
            // setLoading(true); // Don't block UI on refresh
            await loadAdmin(auth.currentUser.uid, auth.currentUser.email, auth.currentUser.displayName, auth.currentUser.phoneNumber);
        }
    }, [loadAdmin]);

    useEffect(() => {
        // Try to load from cache first for immediate feedback
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('mira_admin_profile');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setAdmin(parsed);
                    setLoading(false); // Enable UI immediately
                } catch (e) {
                    console.error('Error parsing cached admin:', e);
                }
            }
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                await loadAdmin(user.uid, user.email, user.displayName, user.phoneNumber);
            } else {
                setAdmin(null);
                setLoading(false);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('mira_admin_profile');
                }
                router.push('/login');
            }
        });
        return () => {
            unsubscribe();
            // Cleanup real-time admin listener
            if (unsubscribeAdminRef.current) {
                unsubscribeAdminRef.current();
                unsubscribeAdminRef.current = null;
            }
            // Cleanup promotion listener
            if (unsubscribePromotionRef.current) {
                unsubscribePromotionRef.current();
                unsubscribePromotionRef.current = null;
            }
        };
    }, [loadAdmin]);

    const value = useMemo(() => ({ admin, loading, refreshAdmin, forceLogout }), [admin, loading, refreshAdmin, forceLogout]);

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
}
