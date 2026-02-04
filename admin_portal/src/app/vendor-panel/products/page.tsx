'use client';

import { redirect } from 'next/navigation';

/**
 * Legacy Vendor Panel Products Route - Redirects to unified /admin/products
 * 
 * "Hepsi Aynı Olsun" Law: All product management consolidates to a single authority.
 * This redirect ensures backward compatibility while maintaining the unified pattern.
 * 
 * The unified /admin/products page will auto-detect the vendor context via AdminProvider.
 */
export default function VendorProductsRedirect() {
    redirect('/admin/products');
}
