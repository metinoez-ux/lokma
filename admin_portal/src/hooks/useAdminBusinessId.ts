'use client';

import { useAdmin } from '@/components/providers/AdminProvider';

/**
 * useAdminBusinessId - Unified business ID resolution
 * 
 * Resolves the current admin's business ID from whichever legacy field exists.
 * This is the SINGLE SOURCE OF TRUTH for businessId resolution.
 * 
 * Priority: businessId > butcherId > restaurantId > marketId > kermesId
 */
export function useAdminBusinessId(): string | null {
 const { admin } = useAdmin();
 
 if (!admin) return null;
 
 return (
 admin.businessId ||
 admin.butcherId ||
 admin.restaurantId ||
 admin.marketId ||
 admin.kermesId ||
 null
 );
}
