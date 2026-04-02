/**
 * LOKMA RBAC 2.0 — Permission Modules Registry
 * 
 * Inspired by JTL Wawi's Benutzerrechte system.
 * Each module represents a feature area with granular actions.
 * 
 * All user-facing labels use i18n keys (perm.* namespace).
 * Resolved at render-time via useTranslations('perm').
 * 
 * Adding a new module:
 * 1. Add the module key + actions here
 * 2. Add default permissions to each group in groups.ts
 * 3. Add i18n keys in all locale files (messages/*.json) under "perm" namespace
 * 4. The UI will automatically pick up the new module in the permission editor
 */

// ─── Module Action Definitions ────────────────────────────────────────────────

export interface ModuleActions {
 [action: string]: {
 labelKey: string; // i18n key for action label
 descriptionKey?: string; // i18n key for action description
 };
}

export interface PermissionModule {
 id: string;
 labelKey: string; // i18n key for module label
 icon: string;
 category: PermissionCategory;
 actions: ModuleActions;
}

export type PermissionCategory =
 | 'operations' // Günlük operasyonlar
 | 'catalog' // Ürün & envanter
 | 'finance' // Mali veriler
 | 'hr' // Personel & vardiya
 | 'settings' // Ayarlar
 | 'community' // Kermes & organizasyon
 | 'platform'; // Süper admin — platform yönetimi

// ─── Category Labels ──────────────────────────────────────────────────────────

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, { labelKey: string; icon: string }> = {
 operations: { labelKey: 'perm.cat_operations', icon: '📋' },
 catalog: { labelKey: 'perm.cat_catalog', icon: '📦' },
 finance: { labelKey: 'perm.cat_finance', icon: '💰' },
 hr: { labelKey: 'perm.cat_hr', icon: '👥' },
 settings: { labelKey: 'perm.cat_settings', icon: '⚙️' },
 community: { labelKey: 'perm.cat_community', icon: '🎪' },
 platform: { labelKey: 'perm.cat_platform', icon: '🏛️' },
};

// ─── Module Registry ──────────────────────────────────────────────────────────

export const PERMISSION_MODULES: Record<string, PermissionModule> = {

 // ═══ OPERATIONS ═══════════════════════════════════════════════════════════

 dashboard: {
 id: 'dashboard',
 labelKey: 'perm.mod_dashboard',
 icon: '📊',
 category: 'operations',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_dashboard_view' },
 },
 },

 orders: {
 id: 'orders',
 labelKey: 'perm.mod_orders',
 icon: '🛒',
 category: 'operations',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_orders_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_orders_edit' },
 cancel: { labelKey: 'perm.act_cancel', descriptionKey: 'perm.desc_orders_cancel' },
 refund: { labelKey: 'perm.act_refund', descriptionKey: 'perm.desc_orders_refund' },
 },
 },

 reservations: {
 id: 'reservations',
 labelKey: 'perm.mod_reservations',
 icon: '📅',
 category: 'operations',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_reservations_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_reservations_edit' },
 },
 },

 customers: {
 id: 'customers',
 labelKey: 'perm.mod_customers',
 icon: '👤',
 category: 'operations',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_customers_view' },
 pii: { labelKey: 'perm.act_pii', descriptionKey: 'perm.desc_customers_pii' },
 },
 },

 // ═══ CATALOG ══════════════════════════════════════════════════════════════

 products: {
 id: 'products',
 labelKey: 'perm.mod_products',
 icon: '🍖',
 category: 'catalog',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_products_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_products_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_products_edit' },
 delete: { labelKey: 'perm.act_delete', descriptionKey: 'perm.desc_products_delete' },
 pricing: { labelKey: 'perm.act_pricing', descriptionKey: 'perm.desc_products_pricing' },
 },
 },

 inventory: {
 id: 'inventory',
 labelKey: 'perm.mod_inventory',
 icon: '📦',
 category: 'catalog',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_inventory_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_inventory_edit' },
 },
 },

 suppliers: {
 id: 'suppliers',
 labelKey: 'perm.mod_suppliers',
 icon: '🏭',
 category: 'catalog',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_suppliers_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_suppliers_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_suppliers_edit' },
 delete: { labelKey: 'perm.act_delete', descriptionKey: 'perm.desc_suppliers_delete' },
 orders: { labelKey: 'perm.act_supply_order', descriptionKey: 'perm.desc_suppliers_orders' },
 },
 },

 // ═══ FINANCE ══════════════════════════════════════════════════════════════

 revenue: {
 id: 'revenue',
 labelKey: 'perm.mod_revenue',
 icon: '💰',
 category: 'finance',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_revenue_view' },
 export: { labelKey: 'perm.act_export', descriptionKey: 'perm.desc_revenue_export' },
 },
 },

 invoices: {
 id: 'invoices',
 labelKey: 'perm.mod_invoices',
 icon: '🧾',
 category: 'finance',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_invoices_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_invoices_create' },
 send: { labelKey: 'perm.act_send', descriptionKey: 'perm.desc_invoices_send' },
 },
 },

 subscriptions: {
 id: 'subscriptions',
 labelKey: 'perm.mod_subscriptions',
 icon: '📋',
 category: 'finance',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_subscriptions_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_subscriptions_edit' },
 },
 },

 // ═══ HR (PERSONEL) ════════════════════════════════════════════════════════

 staff: {
 id: 'staff',
 labelKey: 'perm.mod_staff',
 icon: '👥',
 category: 'hr',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_staff_view' },
 create: { labelKey: 'perm.act_add', descriptionKey: 'perm.desc_staff_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_staff_edit' },
 delete: { labelKey: 'perm.act_archive', descriptionKey: 'perm.desc_staff_delete' },
 permissions: { labelKey: 'perm.act_permissions', descriptionKey: 'perm.desc_staff_permissions' },
 },
 },

 shifts: {
 id: 'shifts',
 labelKey: 'perm.mod_shifts',
 icon: '⏰',
 category: 'hr',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_shifts_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_shifts_edit' },
 export: { labelKey: 'perm.act_export', descriptionKey: 'perm.desc_shifts_export' },
 },
 },

 // ═══ SETTINGS ═════════════════════════════════════════════════════════════

 business_settings: {
 id: 'business_settings',
 labelKey: 'perm.mod_business_settings',
 icon: '⚙️',
 category: 'settings',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_business_settings_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_business_settings_edit' },
 },
 },

 delivery_settings: {
 id: 'delivery_settings',
 labelKey: 'perm.mod_delivery_settings',
 icon: '🚚',
 category: 'settings',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_delivery_settings_view' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_delivery_settings_edit' },
 },
 },

 // ═══ COMMUNITY ════════════════════════════════════════════════════════════

 kermes: {
 id: 'kermes',
 labelKey: 'perm.mod_kermes',
 icon: '🎪',
 category: 'community',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_kermes_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_kermes_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_kermes_edit' },
 manage_staff: { labelKey: 'perm.act_manage_staff', descriptionKey: 'perm.desc_kermes_manage_staff' },
 },
 },

 // ═══ PLATFORM (Super Admin Only) ══════════════════════════════════════════

 platform_users: {
 id: 'platform_users',
 labelKey: 'perm.mod_platform_users',
 icon: '👑',
 category: 'platform',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_platform_users_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_platform_users_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_platform_users_edit' },
 promote: { labelKey: 'perm.act_promote', descriptionKey: 'perm.desc_platform_users_promote' },
 },
 },

 platform_businesses: {
 id: 'platform_businesses',
 labelKey: 'perm.mod_platform_businesses',
 icon: '🏢',
 category: 'platform',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_platform_businesses_view' },
 create: { labelKey: 'perm.act_create', descriptionKey: 'perm.desc_platform_businesses_create' },
 edit: { labelKey: 'perm.act_edit', descriptionKey: 'perm.desc_platform_businesses_edit' },
 },
 },

 platform_analytics: {
 id: 'platform_analytics',
 labelKey: 'perm.mod_platform_analytics',
 icon: '📈',
 category: 'platform',
 actions: {
 view: { labelKey: 'perm.act_view', descriptionKey: 'perm.desc_platform_analytics_view' },
 export: { labelKey: 'perm.act_export', descriptionKey: 'perm.desc_platform_analytics_export' },
 },
 },
};

// ─── Type Helpers ─────────────────────────────────────────────────────────────

/** A permission key is "module.action" e.g. "orders.view", "revenue.export" */
export type PermissionKey = `${string}.${string}`;

/** A flat permission map: { "orders.view": true, "revenue.export": false } */
export type PermissionMap = Record<PermissionKey, boolean>;

/** Get all possible permission keys from the registry */
export function getAllPermissionKeys(): PermissionKey[] {
 const keys: PermissionKey[] = [];
 for (const [moduleId, mod] of Object.entries(PERMISSION_MODULES)) {
 for (const actionId of Object.keys(mod.actions)) {
 keys.push(`${moduleId}.${actionId}` as PermissionKey);
 }
 }
 return keys;
}

/** Get modules grouped by category */
export function getModulesByCategory(): Record<PermissionCategory, PermissionModule[]> {
 const grouped: Record<PermissionCategory, PermissionModule[]> = {
 operations: [],
 catalog: [],
 finance: [],
 hr: [],
 settings: [],
 community: [],
 platform: [],
 };
 for (const mod of Object.values(PERMISSION_MODULES)) {
 grouped[mod.category].push(mod);
 }
 return grouped;
}
