'use client';

import { redirect } from 'next/navigation';

/**
 * Legacy ERP Products Route - Redirects to unified /admin/products
 * 
 * "Hepsi Aynı Olsun" Law: All product management consolidates to a single authority.
 * This redirect ensures backward compatibility while maintaining the unified pattern.
 */
export default function ERPProductsRedirect() {
    redirect('/admin/products');
}
