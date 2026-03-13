/**
 * LOKMA RBAC 2.0 — Permission Groups (Benutzergruppen)
 * 
 * Default templates that can be cloned and customized per business.
 * Each group defines a full PermissionMap with all module.action keys.
 * 
 * Hierarchy:
 *   CEO > Owner > Manager > Cashier / Kitchen / Driver > Intern
 */

import { PermissionMap } from './modules';

export interface PermissionGroup {
  id: string;
  name: string;
  nameKey: string;         // i18n key for group name
  description: string;
  descriptionKey: string;  // i18n key for description
  icon: string;
  color: string;           // Tailwind bg color class
  isSystem: boolean;       // Built-in templates can't be deleted
  isSuperAdminOnly: boolean; // Only for platform-level groups
  permissions: PermissionMap;
}

// ─── Helper: Create a permission map with all keys set to a default value ─────

function allPermissions(value: boolean): PermissionMap {
  return {
    // Operations
    'dashboard.view': value,
    'orders.view': value,
    'orders.edit': value,
    'orders.cancel': value,
    'orders.refund': value,
    'reservations.view': value,
    'reservations.edit': value,
    'customers.view': value,
    'customers.pii': value,
    // Catalog
    'products.view': value,
    'products.create': value,
    'products.edit': value,
    'products.delete': value,
    'products.pricing': value,
    'inventory.view': value,
    'inventory.edit': value,
    'suppliers.view': value,
    'suppliers.create': value,
    'suppliers.edit': value,
    'suppliers.delete': value,
    'suppliers.orders': value,
    // Finance
    'revenue.view': value,
    'revenue.export': value,
    'invoices.view': value,
    'invoices.create': value,
    'invoices.send': value,
    'subscriptions.view': value,
    'subscriptions.edit': value,
    // HR
    'staff.view': value,
    'staff.create': value,
    'staff.edit': value,
    'staff.delete': value,
    'staff.permissions': value,
    'shifts.view': value,
    'shifts.edit': value,
    'shifts.export': value,
    // Settings
    'business_settings.view': value,
    'business_settings.edit': value,
    'delivery_settings.view': value,
    'delivery_settings.edit': value,
    // Community
    'kermes.view': value,
    'kermes.create': value,
    'kermes.edit': value,
    'kermes.manage_staff': value,
    // Platform (Super Admin only)
    'platform_users.view': value,
    'platform_users.create': value,
    'platform_users.edit': value,
    'platform_users.promote': value,
    'platform_businesses.view': value,
    'platform_businesses.create': value,
    'platform_businesses.edit': value,
    'platform_analytics.view': value,
    'platform_analytics.export': value,
  } as PermissionMap;
}

function merge(base: PermissionMap, overrides: Partial<PermissionMap>): PermissionMap {
  return { ...base, ...overrides } as PermissionMap;
}

// ─── Default Groups ───────────────────────────────────────────────────────────

/** CEO — LOKMA platform full access (Super Admin tier) */
const CEO_GROUP: PermissionGroup = {
  id: 'ceo',
  name: 'CEO / Genel Müdür',
  nameKey: 'permGroup_ceo',
  description: 'Platform genelinde tam yetki. Tüm modüllere erişim.',
  descriptionKey: 'permGroup_ceo_desc',
  icon: '👑',
  color: 'bg-red-600',
  isSystem: true,
  isSuperAdminOnly: true,
  permissions: allPermissions(true),
};

/** Support — LOKMA support staff (Super Admin tier, no financials) */
const SUPPORT_GROUP: PermissionGroup = {
  id: 'support',
  name: 'Destek Ekibi',
  nameKey: 'permGroup_support',
  description: 'Platform kullanıcı/işletme yönetimi. Ciro verileri erişimi yok.',
  descriptionKey: 'permGroup_support_desc',
  icon: '🎧',
  color: 'bg-indigo-600',
  isSystem: true,
  isSuperAdminOnly: true,
  permissions: merge(allPermissions(true), {
    'revenue.view': false,
    'revenue.export': false,
    'invoices.view': false,
    'invoices.create': false,
    'invoices.send': false,
    'subscriptions.edit': false,
    'platform_analytics.export': false,
  } as Partial<PermissionMap>),
};

/** Owner — İşletme sahibi (full business access, no platform modules) */
const OWNER_GROUP: PermissionGroup = {
  id: 'owner',
  name: 'İşletme Sahibi',
  nameKey: 'permGroup_owner',
  description: 'İşletme genelinde tam yetki. Platform yönetimi hariç.',
  descriptionKey: 'permGroup_owner_desc',
  icon: '🏪',
  color: 'bg-purple-600',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(true), {
    // No platform access
    'platform_users.view': false,
    'platform_users.create': false,
    'platform_users.edit': false,
    'platform_users.promote': false,
    'platform_businesses.view': false,
    'platform_businesses.create': false,
    'platform_businesses.edit': false,
    'platform_analytics.view': false,
    'platform_analytics.export': false,
  } as Partial<PermissionMap>),
};

/** Manager — Müdür (most business access, limited financials) */
const MANAGER_GROUP: PermissionGroup = {
  id: 'manager',
  name: 'Müdür / Yönetici',
  nameKey: 'permGroup_manager',
  description: 'Operasyon, ürün ve personel yönetimi. Ciro dışa aktarımı ve abonelik yok.',
  descriptionKey: 'permGroup_manager_desc',
  icon: '👔',
  color: 'bg-orange-500',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(false), {
    // Operations — full
    'dashboard.view': true,
    'orders.view': true,
    'orders.edit': true,
    'orders.cancel': true,
    'orders.refund': false,  // Owner only
    'reservations.view': true,
    'reservations.edit': true,
    'customers.view': true,
    'customers.pii': false,  // Privacy: manager can't see PII
    // Catalog — full
    'products.view': true,
    'products.create': true,
    'products.edit': true,
    'products.delete': true,
    'products.pricing': true,
    'inventory.view': true,
    'inventory.edit': true,
    'suppliers.view': true,
    'suppliers.create': true,
    'suppliers.edit': true,
    'suppliers.delete': false,
    'suppliers.orders': true,
    // Finance — limited
    'revenue.view': true,
    'revenue.export': false,  // Can't export financial data
    'invoices.view': true,
    'invoices.create': false,
    'invoices.send': false,
    'subscriptions.view': true,
    'subscriptions.edit': false,
    // HR — full except permissions
    'staff.view': true,
    'staff.create': true,
    'staff.edit': true,
    'staff.delete': false,
    'staff.permissions': false,  // Can't change permission groups
    'shifts.view': true,
    'shifts.edit': true,
    'shifts.export': true,
    // Settings — view only
    'business_settings.view': true,
    'business_settings.edit': false,
    'delivery_settings.view': true,
    'delivery_settings.edit': true,
    // Community
    'kermes.view': true,
    'kermes.create': false,
    'kermes.edit': true,
    'kermes.manage_staff': false,
  } as Partial<PermissionMap>),
};

/** Cashier — Kasiyer (order & product focus) */
const CASHIER_GROUP: PermissionGroup = {
  id: 'cashier',
  name: 'Kasiyer',
  nameKey: 'permGroup_cashier',
  description: 'Sipariş işleme ve ürün görüntüleme. Stok ve fiyat düzenleme yok.',
  descriptionKey: 'permGroup_cashier_desc',
  icon: '💳',
  color: 'bg-green-600',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(false), {
    'dashboard.view': true,
    'orders.view': true,
    'orders.edit': true,
    'orders.cancel': false,
    'reservations.view': true,
    'customers.view': true,
    'products.view': true,
    'inventory.view': true,
    'shifts.view': true,
  } as Partial<PermissionMap>),
};

/** Kitchen — Mutfak personeli (order view & product view) */
const KITCHEN_GROUP: PermissionGroup = {
  id: 'kitchen',
  name: 'Mutfak',
  nameKey: 'permGroup_kitchen',
  description: 'Sipariş hazırlama ve ürün bilgilerini görüntüleme.',
  descriptionKey: 'permGroup_kitchen_desc',
  icon: '👨‍🍳',
  color: 'bg-amber-600',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(false), {
    'dashboard.view': true,
    'orders.view': true,
    'orders.edit': true,  // Can update order status (preparing → ready)
    'products.view': true,
    'inventory.view': true,
    'inventory.edit': true,  // Can update stock levels
    'shifts.view': true,
  } as Partial<PermissionMap>),
};

/** Driver — Sürücü (delivery focused) */
const DRIVER_GROUP: PermissionGroup = {
  id: 'driver',
  name: 'Sürücü / Kurye',
  nameKey: 'permGroup_driver',
  description: 'Teslimat siparişlerini görüntüleme ve durum güncelleme.',
  descriptionKey: 'permGroup_driver_desc',
  icon: '🚗',
  color: 'bg-blue-600',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(false), {
    'dashboard.view': true,
    'orders.view': true,
    'orders.edit': true,  // Update delivery status
    'customers.view': true,
    'customers.pii': true,  // Needs phone for delivery
    'delivery_settings.view': true,
    'shifts.view': true,
  } as Partial<PermissionMap>),
};

/** Intern — Stajyer / Yeni İşçi (minimal read-only) */
const INTERN_GROUP: PermissionGroup = {
  id: 'intern',
  name: 'Stajyer / Yardımcı',
  nameKey: 'permGroup_intern',
  description: 'Sadece dashboard ve ürün görüntüleme. Hiçbir düzenleme yetkisi yok.',
  descriptionKey: 'permGroup_intern_desc',
  icon: '🎓',
  color: 'bg-gray-500',
  isSystem: true,
  isSuperAdminOnly: false,
  permissions: merge(allPermissions(false), {
    'dashboard.view': true,
    'orders.view': true,
    'products.view': true,
    'shifts.view': true,
  } as Partial<PermissionMap>),
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const DEFAULT_PERMISSION_GROUPS: Record<string, PermissionGroup> = {
  ceo: CEO_GROUP,
  support: SUPPORT_GROUP,
  owner: OWNER_GROUP,
  manager: MANAGER_GROUP,
  cashier: CASHIER_GROUP,
  kitchen: KITCHEN_GROUP,
  driver: DRIVER_GROUP,
  intern: INTERN_GROUP,
};

/** Get all groups available to a specific admin type */
export function getAvailableGroups(isSuperAdmin: boolean): PermissionGroup[] {
  return Object.values(DEFAULT_PERMISSION_GROUPS).filter(
    g => isSuperAdmin || !g.isSuperAdminOnly
  );
}

/** Resolve the default group for a legacy adminType.
 *  IMPORTANT: Every AdminType from types/index.ts must be mapped here.
 *  Unmapped types fall back to 'intern' (minimal read-only). */
export function getDefaultGroupForAdminType(adminType: string): string {
  const mapping: Record<string, string> = {
    // ═══ Platform-Level ═══
    'super':           'ceo',

    // ═══ Business Owners ═══
    'kasap':           'owner',
    'restoran':        'owner',
    'market':          'owner',
    'bakkal':          'owner',
    'kermes':          'owner',
    'cenaze_fonu':     'owner',
    'hali_yikama':     'owner',

    // ═══ Staff / Personel ═══
    'kasap_staff':     'cashier',
    'restoran_staff':  'cashier',
    'market_staff':    'cashier',
    'kermes_staff':    'cashier',
    'garson':          'cashier',    // Waiter → cashier level
    'tur_rehberi':     'cashier',    // Tour guide → cashier level

    // ═══ Kitchen ═══
    'mutfak':          'kitchen',

    // ═══ Drivers ═══
    'teslimat':        'driver',
    'hali_surucu':     'driver',
    'transfer_surucu': 'driver',
  };
  return mapping[adminType] || 'intern';
}
