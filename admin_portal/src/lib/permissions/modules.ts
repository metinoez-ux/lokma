/**
 * LOKMA RBAC 2.0 — Permission Modules Registry
 * 
 * Inspired by JTL Wawi's Benutzerrechte system.
 * Each module represents a feature area with granular actions.
 * 
 * Adding a new module:
 * 1. Add the module key + actions here
 * 2. Add default permissions to each group in groups.ts
 * 3. The UI will automatically pick up the new module in the permission editor
 */

// ─── Module Action Definitions ────────────────────────────────────────────────

export interface ModuleActions {
  [action: string]: {
    label: string;
    description?: string;
  };
}

export interface PermissionModule {
  id: string;
  label: string;
  icon: string;
  category: PermissionCategory;
  actions: ModuleActions;
}

export type PermissionCategory =
  | 'operations'    // Günlük operasyonlar
  | 'catalog'       // Ürün & envanter
  | 'finance'       // Mali veriler
  | 'hr'            // Personel & vardiya
  | 'settings'      // Ayarlar
  | 'community'     // Kermes & organizasyon
  | 'platform';     // Süper admin — platform yönetimi

// ─── Category Labels ──────────────────────────────────────────────────────────

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, { label: string; icon: string }> = {
  operations:  { label: 'Operasyonlar',     icon: '📋' },
  catalog:     { label: 'Ürün & Envanter',  icon: '📦' },
  finance:     { label: 'Finans',           icon: '💰' },
  hr:          { label: 'Personel',         icon: '👥' },
  settings:    { label: 'Ayarlar',          icon: '⚙️' },
  community:   { label: 'Topluluk',         icon: '🎪' },
  platform:    { label: 'Platform Yönetimi', icon: '🏛️' },
};

// ─── Module Registry ──────────────────────────────────────────────────────────

export const PERMISSION_MODULES: Record<string, PermissionModule> = {

  // ═══ OPERATIONS ═══════════════════════════════════════════════════════════

  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    category: 'operations',
    actions: {
      view: { label: 'Görüntüle', description: 'Dashboard ana sayfasını görebilir' },
    },
  },

  orders: {
    id: 'orders',
    label: 'Siparişler',
    icon: '🛒',
    category: 'operations',
    actions: {
      view:   { label: 'Görüntüle', description: 'Sipariş listesini ve detayını görebilir' },
      edit:   { label: 'Düzenle',   description: 'Sipariş durumunu değiştirebilir' },
      cancel: { label: 'İptal',     description: 'Siparişleri iptal edebilir' },
      refund: { label: 'İade',      description: 'Ödeme iadesi yapabilir' },
    },
  },

  reservations: {
    id: 'reservations',
    label: 'Rezervasyonlar',
    icon: '📅',
    category: 'operations',
    actions: {
      view: { label: 'Görüntüle', description: 'Rezervasyonları görebilir' },
      edit: { label: 'Düzenle',   description: 'Rezervasyon oluşturabilir/düzenleyebilir' },
    },
  },

  customers: {
    id: 'customers',
    label: 'Müşteriler',
    icon: '👤',
    category: 'operations',
    actions: {
      view: { label: 'Görüntüle',   description: 'Müşteri listesini görebilir' },
      pii:  { label: 'Kişisel Veri', description: 'Telefon ve e-posta bilgilerini görebilir' },
    },
  },

  // ═══ CATALOG ══════════════════════════════════════════════════════════════

  products: {
    id: 'products',
    label: 'Ürünler',
    icon: '🍖',
    category: 'catalog',
    actions: {
      view:    { label: 'Görüntüle',  description: 'Ürün listesini görebilir' },
      create:  { label: 'Oluştur',    description: 'Yeni ürün ekleyebilir' },
      edit:    { label: 'Düzenle',    description: 'Ürün bilgilerini değiştirebilir' },
      delete:  { label: 'Sil',       description: 'Ürünleri silebilir' },
      pricing: { label: 'Fiyatlandırma', description: 'Alış/satış fiyatlarını görebilir ve düzenleyebilir' },
    },
  },

  inventory: {
    id: 'inventory',
    label: 'Envanter',
    icon: '📦',
    category: 'catalog',
    actions: {
      view: { label: 'Görüntüle', description: 'Stok durumunu görebilir' },
      edit: { label: 'Düzenle',   description: 'Stok miktarını güncelleyebilir' },
    },
  },

  suppliers: {
    id: 'suppliers',
    label: 'Tedarikçiler',
    icon: '🏭',
    category: 'catalog',
    actions: {
      view:   { label: 'Görüntüle', description: 'Tedarikçi listesini görebilir' },
      create: { label: 'Oluştur',   description: 'Yeni tedarikçi ekleyebilir' },
      edit:   { label: 'Düzenle',   description: 'Tedarikçi bilgilerini düzenleyebilir' },
      delete: { label: 'Sil',       description: 'Tedarikçileri silebilir' },
      orders: { label: 'Sipariş',   description: 'Tedarik siparişlerini yönetebilir' },
    },
  },

  // ═══ FINANCE ══════════════════════════════════════════════════════════════

  revenue: {
    id: 'revenue',
    label: 'Ciro & Gelir',
    icon: '💰',
    category: 'finance',
    actions: {
      view:   { label: 'Görüntüle', description: 'Ciro verilerini görebilir' },
      export: { label: 'Dışa Aktar', description: 'Mali verileri dışa aktarabilir (CSV/PDF)' },
    },
  },

  invoices: {
    id: 'invoices',
    label: 'Faturalar',
    icon: '🧾',
    category: 'finance',
    actions: {
      view:   { label: 'Görüntüle', description: 'Faturaları görebilir' },
      create: { label: 'Oluştur',   description: 'Yeni fatura oluşturabilir' },
      send:   { label: 'Gönder',    description: 'Faturaları e-posta ile gönderebilir' },
    },
  },

  subscriptions: {
    id: 'subscriptions',
    label: 'Abonelik & Plan',
    icon: '📋',
    category: 'finance',
    actions: {
      view: { label: 'Görüntüle', description: 'Mevcut plan ve abonelik bilgilerini görebilir' },
      edit: { label: 'Düzenle',   description: 'Plan değişikliği yapabilir' },
    },
  },

  // ═══ HR (PERSONEL) ════════════════════════════════════════════════════════

  staff: {
    id: 'staff',
    label: 'Personel Yönetimi',
    icon: '👥',
    category: 'hr',
    actions: {
      view:   { label: 'Görüntüle',  description: 'Personel listesini görebilir' },
      create: { label: 'Ekle',       description: 'Yeni personel davet edebilir' },
      edit:   { label: 'Düzenle',    description: 'Personel bilgilerini düzenleyebilir' },
      delete: { label: 'Sil/Arşivle', description: 'Personeli arşivleyebilir veya yetkisini kaldırabilir' },
      permissions: { label: 'Yetki Yönetimi', description: 'Personelin izin grubunu değiştirebilir' },
    },
  },

  shifts: {
    id: 'shifts',
    label: 'Vardiya & Çalışma Saatleri',
    icon: '⏰',
    category: 'hr',
    actions: {
      view:   { label: 'Görüntüle', description: 'Vardiya planını görebilir' },
      edit:   { label: 'Düzenle',   description: 'Vardiya oluşturabilir ve düzenleyebilir' },
      export: { label: 'Dışa Aktar', description: 'Çalışma saatlerini dışa aktarabilir' },
    },
  },

  // ═══ SETTINGS ═════════════════════════════════════════════════════════════

  business_settings: {
    id: 'business_settings',
    label: 'İşletme Ayarları',
    icon: '⚙️',
    category: 'settings',
    actions: {
      view: { label: 'Görüntüle', description: 'İşletme bilgilerini görebilir' },
      edit: { label: 'Düzenle',   description: 'İşletme bilgilerini değiştirebilir' },
    },
  },

  delivery_settings: {
    id: 'delivery_settings',
    label: 'Teslimat Ayarları',
    icon: '🚚',
    category: 'settings',
    actions: {
      view: { label: 'Görüntüle', description: 'Teslimat ayarlarını görebilir' },
      edit: { label: 'Düzenle',   description: 'Teslimat ayarlarını değiştirebilir' },
    },
  },

  // ═══ COMMUNITY ════════════════════════════════════════════════════════════

  kermes: {
    id: 'kermes',
    label: 'Kermes Yönetimi',
    icon: '🎪',
    category: 'community',
    actions: {
      view:         { label: 'Görüntüle',  description: 'Kermes etkinliklerini görebilir' },
      create:       { label: 'Oluştur',    description: 'Yeni kermes etkinliği oluşturabilir' },
      edit:         { label: 'Düzenle',     description: 'Kermes bilgilerini düzenleyebilir' },
      manage_staff: { label: 'Personel',    description: 'Kermes personelini yönetebilir' },
    },
  },

  // ═══ PLATFORM (Super Admin Only) ══════════════════════════════════════════

  platform_users: {
    id: 'platform_users',
    label: 'Platform Kullanıcıları',
    icon: '👑',
    category: 'platform',
    actions: {
      view:    { label: 'Görüntüle', description: 'Tüm kullanıcıları görebilir' },
      create:  { label: 'Oluştur',   description: 'Yeni kullanıcı ekleyebilir' },
      edit:    { label: 'Düzenle',   description: 'Kullanıcı bilgilerini düzenleyebilir' },
      promote: { label: 'Yetkilendir', description: 'Kullanıcıya admin/personel rolü verebilir' },
    },
  },

  platform_businesses: {
    id: 'platform_businesses',
    label: 'Platform İşletmeleri',
    icon: '🏢',
    category: 'platform',
    actions: {
      view:   { label: 'Görüntüle', description: 'Tüm işletmeleri görebilir' },
      create: { label: 'Oluştur',   description: 'Yeni işletme ekleyebilir' },
      edit:   { label: 'Düzenle',   description: 'İşletme bilgilerini düzenleyebilir' },
    },
  },

  platform_analytics: {
    id: 'platform_analytics',
    label: 'Platform Analitiği',
    icon: '📈',
    category: 'platform',
    actions: {
      view:   { label: 'Görüntüle', description: 'Platform geneli istatistikleri görebilir' },
      export: { label: 'Dışa Aktar', description: 'Platform verilerini dışa aktarabilir' },
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
