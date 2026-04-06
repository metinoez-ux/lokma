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

 const isKermesContext = admin.businessType === 'kermes' || 
   ['kermes', 'kermes_staff', 'kermes_admin', 'staff', 'mutfak', 'garson', 'teslimat'].includes(admin.adminType || '');

 // Prioritize kermesId for kermes staff. Many volunteers may have a legacy businessId that ruins their queries.
 if (isKermesContext && admin.kermesId) {
   return admin.kermesId;
 }
 
 return (
 admin.businessId ||
 admin.butcherId ||
 admin.restaurantId ||
 admin.marketId ||
 admin.kermesId ||
 null
 );
}
