'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LocalizedString {
  [key: string]: string;
}

interface MasterProduct {
  id: string;
  name: LocalizedString | string;
  category: string;
  categories?: string[];
  defaultUnit: string;
  isActive: boolean;
  isArchived?: boolean;
}

interface Organization {
  id: string;
  name: string;
  shortName?: string;
  city?: string;
  postalCode?: string;
}

export default function KermesMenuBuilderPage() {
  const { admin, loading: adminLoading } = useAdmin();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);

  // States from original component
  const [kermesOrgSearch, setKermesOrgSearch] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [kermesMenuProducts, setKermesMenuProducts] = useState<MasterProduct[]>([]);
  const [savingKermesMenu, setSavingKermesMenu] = useState(false);

  useEffect(() => {
    if (!adminLoading && admin?.role !== 'super_admin') {
      router.push('/admin/kermes');
    }
  }, [admin, adminLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setLoadingOrganizations(true);
    try {
      // 1. Load Master Products
      const productsSnapshot = await getDocs(collection(db, "master_products"));
      const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterProduct));
      setProducts(allProducts.filter(p => !p.isArchived));

      // 2. Load Organizations
      const orgsSnapshot = await getDocs(collection(db, "organizations"));
      setOrganizations(orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setLoadingOrganizations(false);
    }
  };

  useEffect(() => {
    if (!adminLoading && admin?.role === 'super_admin') {
      loadData();
    }
  }, [admin, adminLoading]);

  // Helper for localization
  const getLocalizedText = (textObj: any, locale: string = 'tr'): string => {
    if (!textObj) return '';
    if (typeof textObj === 'string') return textObj;
    if (typeof textObj === 'object') {
      return textObj[locale] || textObj['tr'] || textObj['de'] || textObj['en'] || Object.values(textObj)[0] || '';
    }
    return String(textObj);
  };

  // Filter Kermes Products
  const kermesProducts = products.filter(p =>
    p.category?.startsWith('kermes_') ||
    (p.categories || []).some(c => c.startsWith('kermes_'))
  );

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!admin || admin.role !== 'super_admin') return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
          ← Kermes Yönetimi
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Kermes Menü Oluşturucu</h1>
          <p className="text-muted-foreground mt-1">Eski mimari - Organizasyonlar için belirli ürünleri kullanarak menü hazırlayın.</p>
        </div>

        <div className="bg-card rounded-xl border border-pink-500/30 p-6">
          {/* Organizasyon Seçimi */}
          <div className="mb-6">
            <label className="block text-muted-foreground text-sm mb-2">
              Organizasyon Seçin (Kermes Yapılacak Cami/Dernek)
            </label>
            {selectedOrganization ? (
              <div className="flex items-center gap-3 p-4 bg-pink-900/30 border border-pink-500 rounded-xl">
                <div className="text-3xl">🕌</div>
                <div className="flex-1">
                  <p className="text-foreground font-bold">{selectedOrganization.shortName || selectedOrganization.name}</p>
                  <p className="text-muted-foreground text-sm">📍 {selectedOrganization.city} • {selectedOrganization.postalCode}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrganization(null);
                    setKermesMenuProducts([]);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                >
                  Değiştir
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={kermesOrgSearch}
                  onChange={(e) => setKermesOrgSearch(e.target.value)}
                  placeholder="Cami adı, şehir veya posta kodu..."
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-pink-500 mb-3"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {loadingOrganizations ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Organizasyonlar Yükleniyor...
                    </div>
                  ) : (
                    organizations
                      .filter(o => {
                        const search = kermesOrgSearch.toLowerCase();
                        return !search ||
                          o.name?.toLowerCase().includes(search) ||
                          o.shortName?.toLowerCase().includes(search) ||
                          o.city?.toLowerCase().includes(search) ||
                          o.postalCode?.includes(search);
                      })
                      .slice(0, 12)
                      .map(org => (
                        <button
                          key={org.id}
                          onClick={() => {
                            setSelectedOrganization(org);
                            setKermesOrgSearch('');
                          }}
                          className="p-3 bg-gray-700 hover:bg-pink-900/30 border border-gray-600 hover:border-pink-500 rounded-xl text-left transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🕌</span>
                            <div>
                              <p className="text-foreground font-medium text-sm">{org.shortName || org.name}</p>
                              <p className="text-muted-foreground text-xs">📍 {org.city}</p>
                            </div>
                          </div>
                        </button>
                      ))
                  )}
                </div>
                {organizations.length === 0 && !loadingOrganizations && (
                  <div className="text-center py-8 text-muted-foreground/80">
                    <p className="text-3xl mb-2">🕌</p>
                    <p>Henüz organizasyon yok</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kermes Ürünleri Seçimi */}
          {selectedOrganization && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                Kermes Menüsü Hazırla
                <span className="text-sm font-normal text-muted-foreground">
                  Mevcut kermes ürünlerinden seçin
                </span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                {kermesProducts.length === 0 ? (
                  <div className="col-span-full text-center py-8 bg-gray-700/50 rounded-xl">
                    <p className="text-2xl mb-2">🍲</p>
                    <p className="text-muted-foreground">Henüz Kermes Menüsü için ürün yok.</p>
                  </div>
                ) : (
                  kermesProducts.map(product => {
                    const isSelected = kermesMenuProducts.some(p => p.id === product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => {
                          if (isSelected) {
                            setKermesMenuProducts(prev => prev.filter(p => p.id !== product.id));
                          } else {
                            setKermesMenuProducts(prev => [...prev, product]);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all text-left ${isSelected
                          ? 'bg-pink-900/50 border-pink-500 ring-2 ring-pink-500'
                          : 'bg-gray-700 border-gray-600 hover:border-pink-400'
                          }`}
                      >
                        <p className="text-foreground text-sm font-medium line-clamp-2">{getLocalizedText(product.name)}</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {product.defaultUnit === 'adet' ? '🔢' : '⚖️'} {product.defaultUnit}
                        </p>
                        {isSelected && (
                          <span className="inline-block mt-2 px-2 py-0.5 bg-pink-600 text-white text-xs rounded-full">
                            Seçildi
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {kermesMenuProducts.length > 0 && (
                <div className="bg-pink-900/30 border border-pink-500/50 rounded-xl p-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-foreground font-bold">
                      🎪 {selectedOrganization.shortName || selectedOrganization.name} Menüsü
                    </h4>
                    <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-sm">
                      {kermesMenuProducts.length} Ürün
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {kermesMenuProducts.map(product => (
                      <span
                        key={product.id}
                        className="px-3 py-1.5 bg-pink-800/50 text-pink-200 rounded-lg text-sm flex items-center gap-2"
                      >
                        {getLocalizedText(product.name)}
                        <button
                          onClick={() => setKermesMenuProducts(prev => prev.filter(p => p.id !== product.id))}
                          className="text-pink-800 dark:text-pink-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      setSavingKermesMenu(true);
                      try {
                        const menuData = {
                          organizationId: selectedOrganization.id,
                          organizationName: selectedOrganization.shortName || selectedOrganization.name,
                          products: kermesMenuProducts.map(p => ({
                            id: p.id,
                            name: getLocalizedText(p.name),
                            category: p.category,
                            defaultUnit: p.defaultUnit,
                          })),
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        };
                        await setDoc(doc(db, 'kermes_menus', selectedOrganization.id), menuData);
                        alert('Kermes menüsü başarıyla kaydedildi!');
                      } catch (error) {
                        console.error('Error saving kermes menu:', error);
                        alert('Kermes menüsü kaydedilirken hata oluştu.');
                      } finally {
                        setSavingKermesMenu(false);
                      }
                    }}
                    disabled={savingKermesMenu}
                    className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-bold hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-all"
                  >
                    {savingKermesMenu ? '⏳ Kaydediliyor...' : 'Kermes Menüsünü Kaydet'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
