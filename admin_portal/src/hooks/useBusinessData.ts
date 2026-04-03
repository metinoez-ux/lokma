'use client';

import { useAdminBusinessId } from './useAdminBusinessId';
import { useBusiness, type BusinessData } from './useBusiness';

interface UseBusinessDataReturn {
 businessId: string | null;
 business: BusinessData | null;
 loading: boolean;
 error: string | null;
 refresh: () => Promise<void>;
}

/**
 * useBusinessData - Giris yapan admin'in isletme verisi
 *
 * useAdminBusinessId + useBusiness birlestiren convenience hook.
 * Admin'in businessId cozumlemesi + isletme verisi tek hook'ta.
 *
 * Kullanim:
 * const { businessId, business, loading } = useBusinessData();
 */
export function useBusinessData(): UseBusinessDataReturn {
 const businessId = useAdminBusinessId();
 const { business, loading, error, refresh } = useBusiness(businessId);

 return { businessId, business, loading, error, refresh };
}
