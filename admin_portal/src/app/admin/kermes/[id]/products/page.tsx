'use client';

import { redirect } from 'next/navigation';
import { use } from 'react';

/**
 * Legacy Kermes Products Route - Redirects to unified /admin/products
 * 
 * "Hepsi Aynı Olsun" Law: All product management consolidates to a single authority.
 * This redirect ensures backward compatibility while maintaining the unified pattern.
 * 
 * Note: Kermes products use a special context with kermesId parameter.
 */
export default function KermesProductsRedirect({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    redirect(`/admin/products?kermesId=${id}`);
}
