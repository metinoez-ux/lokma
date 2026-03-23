'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db, storage } from '@/lib/firebase';
import { getLocalizedText } from '@/lib/utils';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/* -- Types -- */
interface MasterProductItem {
  id: string;
  name: any; // localized or string
  imageUrl?: string;
  images?: string[];
  sellingPrice?: number;
  appSellingPrice?: number;
  inStorePrice?: number;
  defaultPrice?: number;
  category?: string;
}

interface SponsoredAd {
  id: string;
  advertiserName: string;
  advertiserLogo?: string;
  bannerImageUrl: string;
  title: string;
  subtitle?: string;
  productPrice?: number | null;
  selectedProductId?: string;
  selectedProductName?: string;
  selectedProductImage?: string;
  originalPrice?: number | null;
  discountPrice?: number | null;
  discountPercent?: number | null;
  productKeywords: string[];
  targetCategories: string[];
  targetRadius: number;
  targetCity?: string;
  targetBusinessTypes: string[];
  targetCountries: string[];
  pricingModel: string;
  bidAmount: number;
  dailyBudget: number;
  totalBudget: number;
  spentAmount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  priority: number;
  createdAt?: Date;
}

const AVAILABLE_COUNTRIES = [
  { code: 'DE', label: 'Deutschland', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'AT', label: '\u00D6sterreich', flag: '\uD83C\uDDE6\uD83C\uDDF9' },
  { code: 'NL', label: 'Niederlande', flag: '\uD83C\uDDF3\uD83C\uDDF1' },
  { code: 'BE', label: 'Belgien', flag: '\uD83C\uDDE7\uD83C\uDDEA' },
  { code: 'FR', label: 'Frankreich', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'IT', label: 'Italien', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
  { code: 'ES', label: 'Spanien', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'TR', label: 'T\u00FCrkiye', flag: '\uD83C\uDDF9\uD83C\uDDF7' },
  { code: 'CH', label: 'Schweiz', flag: '\uD83C\uDDE8\uD83C\uDDED' },
];

const DEFAULT_FORM = {
  advertiserName: '',
  title: '',
  subtitle: '',
  productKeywords: '',
  targetCategories: '',
  targetRadius: 0,
  targetCity: '',
  targetBusinessTypes: 'market',
  targetCountries: ['DE'] as string[],
  productPrice: '' as string | number,
  selectedProductId: '',
  selectedProductImage: '',
  originalPrice: '' as string | number,
  discountPrice: '' as string | number,
  pricingModel: 'fixed_daily',
  bidAmount: 5,
  dailyBudget: 50,
  totalBudget: 500,
  priority: 1,
  startDate: '',
  endDate: '',
};

/* -- Component -- */
export default function SponsoredAdsPage() {
  const t = useTranslations('AdminSponsoredAds');
  const { admin, loading } = useAdmin();

  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Product picker state
  const [masterProducts, setMasterProducts] = useState<MasterProductItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');

  /* -- Load ads -- */
  useEffect(() => {
    if (!admin) return;
    loadAds();
    loadMasterProducts();
  }, [admin]);

  const loadMasterProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'master_products'));
      const list: MasterProductItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MasterProductItem[];
      list.sort((a, b) => getLocalizedText(a.name).localeCompare(getLocalizedText(b.name)));
      setMasterProducts(list);
    } catch (e) {
      console.error('Error loading master products:', e);
    }
  };

  const loadAds = async () => {
    setLoadingAds(true);
    try {
      const q = query(collection(db, 'sponsoredAds'), orderBy('priority', 'desc'));
      const snap = await getDocs(q);
      const list: SponsoredAd[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        startDate: d.data().startDate?.toDate?.() || new Date(),
        endDate: d.data().endDate?.toDate?.() || new Date(),
        createdAt: d.data().createdAt?.toDate?.(),
        productKeywords: d.data().productKeywords || [],
        productPrice: d.data().productPrice || null,
        selectedProductId: d.data().selectedProductId || '',
        selectedProductName: d.data().selectedProductName || '',
        selectedProductImage: d.data().selectedProductImage || '',
        originalPrice: d.data().originalPrice ?? null,
        discountPrice: d.data().discountPrice ?? null,
        discountPercent: d.data().discountPercent ?? null,
        targetCategories: d.data().targetCategories || [],
        targetBusinessTypes: d.data().targetBusinessTypes || ['market'],
        targetCountries: d.data().targetCountries || ['DE'],
      })) as SponsoredAd[];
      setAds(list);
    } catch (e) {
      console.error('Error loading sponsored ads:', e);
    }
    setLoadingAds(false);
  };

  /* -- Form handlers -- */
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setBannerFile(null);
    setBannerPreview('');
    setLogoFile(null);
    setLogoPreview('');
    setSelectedProductName('');
    setProductSearch('');
    setShowProductPicker(false);
    setShowForm(true);
  };

  const openEdit = (ad: SponsoredAd) => {
    setEditingId(ad.id);
    setForm({
      advertiserName: ad.advertiserName,
      title: ad.title,
      subtitle: ad.subtitle || '',
      productPrice: ad.productPrice ?? '',
      selectedProductId: ad.selectedProductId || '',
      selectedProductImage: ad.selectedProductImage || '',
      originalPrice: ad.originalPrice ?? '',
      discountPrice: ad.discountPrice ?? '',
      productKeywords: ad.productKeywords.join(', '),
      targetCategories: (ad.targetCategories || []).join(', '),
      targetRadius: ad.targetRadius,
      targetCity: (ad as any).targetCity || '',
      targetBusinessTypes: ad.targetBusinessTypes.join(', '),
      targetCountries: ad.targetCountries || ['DE'],
      pricingModel: ad.pricingModel,
      bidAmount: ad.bidAmount,
      dailyBudget: ad.dailyBudget,
      totalBudget: ad.totalBudget,
      priority: ad.priority,
      startDate: ad.startDate.toISOString().split('T')[0],
      endDate: ad.endDate.toISOString().split('T')[0],
    });
    setSelectedProductName(ad.selectedProductName || '');
    setBannerPreview(ad.bannerImageUrl);
    setLogoPreview(ad.advertiserLogo || '');
    setBannerFile(null);
    setLogoFile(null);
    setProductSearch('');
    setShowProductPicker(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.advertiserName) return;
    setSaving(true);
    try {
      let bannerImageUrl = bannerPreview;
      let advertiserLogo = logoPreview;

      // Upload banner if new file
      if (bannerFile) {
        const fname = `sponsored-ads/banners/${Date.now()}_${bannerFile.name}`;
        const imgRef = storageRef(storage, fname);
        await uploadBytes(imgRef, bannerFile);
        bannerImageUrl = await getDownloadURL(imgRef);
      }

      // Upload logo if new file
      if (logoFile) {
        const fname = `sponsored-ads/logos/${Date.now()}_${logoFile.name}`;
        const imgRef = storageRef(storage, fname);
        await uploadBytes(imgRef, logoFile);
        advertiserLogo = await getDownloadURL(imgRef);
      }

      // Compute discount percent
      const origP = form.originalPrice !== '' ? Number(form.originalPrice) : null;
      const discP = form.discountPrice !== '' ? Number(form.discountPrice) : null;
      let discountPercent: number | null = null;
      if (origP && discP && discP < origP) {
        discountPercent = Math.round(((origP - discP) / origP) * 100);
      }

      const data = {
        advertiserName: form.advertiserName,
        advertiserLogo: advertiserLogo || null,
        bannerImageUrl,
        title: form.title,
        subtitle: form.subtitle || null,
        productPrice: form.productPrice !== '' ? Number(form.productPrice) : null,
        selectedProductId: form.selectedProductId || null,
        selectedProductName: selectedProductName || null,
        selectedProductImage: form.selectedProductImage || null,
        originalPrice: origP,
        discountPrice: discP,
        discountPercent,
        productKeywords: form.productKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        targetCategories: form.targetCategories
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        targetRadius: Number(form.targetRadius),
        targetCity: form.targetCity || null,
        targetBusinessTypes: form.targetBusinessTypes
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        targetCountries: form.targetCountries,
        pricingModel: form.pricingModel,
        bidAmount: Number(form.bidAmount),
        dailyBudget: Number(form.dailyBudget),
        totalBudget: Number(form.totalBudget),
        priority: Number(form.priority),
        startDate: Timestamp.fromDate(new Date(form.startDate)),
        endDate: Timestamp.fromDate(new Date(form.endDate)),
        updatedAt: Timestamp.now(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'sponsoredAds', editingId), data);
      } else {
        await addDoc(collection(db, 'sponsoredAds'), {
          ...data,
          isActive: true,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spentAmount: 0,
          createdAt: Timestamp.now(),
          createdBy: admin?.id || '',
        });
      }

      setShowForm(false);
      await loadAds();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (ad: SponsoredAd) => {
    try {
      await updateDoc(doc(db, 'sponsoredAds', ad.id), {
        isActive: !ad.isActive,
        updatedAt: Timestamp.now(),
      });
      await loadAds();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleDelete = async (ad: SponsoredAd) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteDoc(doc(db, 'sponsoredAds', ad.id));
      await loadAds();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  /* -- Helpers -- */
  const getStatusBadge = (ad: SponsoredAd) => {
    const now = new Date();
    if (!ad.isActive) return { text: t('inactive'), color: 'bg-gray-600' };
    if (ad.spentAmount >= ad.totalBudget) return { text: t('budgetExhausted'), color: 'bg-red-600' };
    if (now > ad.endDate) return { text: t('expired'), color: 'bg-yellow-600' };
    return { text: t('active'), color: 'bg-green-600' };
  };

  const ctr = (ad: SponsoredAd) => {
    if (ad.impressions === 0) return '0%';
    return ((ad.clicks / ad.impressions) * 100).toFixed(1) + '%';
  };

  /* -- Guards -- */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-500" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-400">{t('accessDenied')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* -- Header -- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-medium rounded-lg text-sm transition"
          >
            + {t('createCampaign')}
          </button>
        </div>

        {/* -- Stats Summary -- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('totalCampaigns'), value: ads.length },
            { label: t('activeCampaigns'), value: ads.filter((a) => a.isActive).length },
            {
              label: t('totalImpressions'),
              value: ads.reduce((s, a) => s + a.impressions, 0).toLocaleString(),
            },
            { label: t('totalClicks'), value: ads.reduce((s, a) => s + a.clicks, 0).toLocaleString() },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-xl font-bold mt-1">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* -- Campaigns List -- */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('campaigns')}
          </h2>

          {loadingAds ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-28 bg-card rounded-xl" />
              ))}
            </div>
          ) : ads.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">📢</div>
              <p className="text-muted-foreground">{t('noCampaigns')}</p>
              <button
                onClick={openCreate}
                className="mt-4 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm transition"
              >
                {t('createFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ads.map((ad) => {
                const badge = getStatusBadge(ad);
                return (
                  <div key={ad.id} className="bg-card rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      {/* Banner preview */}
                      {ad.bannerImageUrl && (
                        <div className="relative shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-700">
                          <img
                            src={ad.bannerImageUrl}
                            alt={ad.title}
                            className="w-full h-full object-cover"
                          />
                          {/* Discount badge on card */}
                          {ad.discountPercent && ad.discountPercent > 0 && (
                            <div className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                              %{ad.discountPercent}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white truncate">{ad.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                            {badge.text}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{ad.advertiserName}</div>
                        {/* Product + pricing row */}
                        {ad.selectedProductName && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs">
                            <span className="text-foreground">{ad.selectedProductName}</span>
                            {ad.originalPrice && ad.discountPrice && ad.discountPrice < ad.originalPrice ? (
                              <>
                                <span className="text-gray-500 line-through">{ad.originalPrice.toFixed(2)} EUR</span>
                                <span className="text-green-400 font-semibold">{ad.discountPrice.toFixed(2)} EUR</span>
                              </>
                            ) : ad.originalPrice ? (
                              <span className="text-muted-foreground">{ad.originalPrice.toFixed(2)} EUR</span>
                            ) : null}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {ad.startDate.toLocaleDateString()} - {ad.endDate.toLocaleDateString()}
                        </div>

                        {/* Metrics row */}
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            {t('impressionsLabel')}: <span className="text-white font-medium">{ad.impressions.toLocaleString()}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {t('clicksLabel')}: <span className="text-white font-medium">{ad.clicks.toLocaleString()}</span>
                          </span>
                          <span className="text-muted-foreground">
                            CTR: <span className="text-white font-medium">{ctr(ad)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {t('conversionsLabel')}: <span className="text-green-400 font-medium">{ad.conversions}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {t('spent')}: <span className="text-yellow-400 font-medium">{ad.spentAmount.toFixed(2)}/{ad.totalBudget.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(ad)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition ${
                            ad.isActive
                              ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          }`}
                        >
                          {ad.isActive ? t('pause') : t('activate')}
                        </button>
                        <button
                          onClick={() => openEdit(ad)}
                          className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(ad)}
                          className="px-3 py-1.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* -- Create/Edit Modal -- */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 overflow-y-auto py-8">
            <div className="bg-card rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 my-auto">
              <h3 className="text-lg font-bold">
                {editingId ? t('editCampaign') : t('createCampaign')}
              </h3>

              {/* Banner upload */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('bannerImage')} *</label>
                <div
                  className="w-full h-32 rounded-xl overflow-hidden bg-gray-700 cursor-pointer border-2 border-dashed border-gray-600 hover:border-gray-400 transition flex items-center justify-center"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="banner" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-muted-foreground text-sm">{t('uploadBanner')}</span>
                  )}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBannerFile(file);
                      setBannerPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>

              {/* Logo upload */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('advertiserLogo')}</label>
                  <div
                    className="w-14 h-14 rounded-lg overflow-hidden bg-gray-700 cursor-pointer border border-gray-600 hover:border-gray-400 transition flex items-center justify-center"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-500 text-xs">Logo</span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">{t('advertiserName')} *</label>
                  <input
                    type="text"
                    value={form.advertiserName}
                    onChange={(e) => setForm((f) => ({ ...f, advertiserName: e.target.value }))}
                    placeholder="YAYLA, Gazi, Ozyorem..."
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Headline & Subtitle with char limits */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">{t('adTitle')} * (Reklam Satiri)</label>
                    <span className={`text-[10px] font-mono ${form.title.length > 35 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {form.title.length}/40
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={40}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="z.B. YAYLA Basmati Reis - Jetzt im Angebot!"
                    className="w-full px-3 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">{t('adSubtitle')} (Alt Yazi)</label>
                    <span className={`text-[10px] font-mono ${(form.subtitle?.length || 0) > 80 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {form.subtitle?.length || 0}/90
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={90}
                    value={form.subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    placeholder="z.B. Premium Qualitaet aus der Tuerkei. In ueber 500 Maerkten erhaeltlich."
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-xs font-light text-foreground"
                  />
                </div>
              </div>

              {/* Product Selection + Pricing */}
              <div className="space-y-3 border border-border rounded-xl p-4">
                <label className="block text-xs text-muted-foreground font-semibold">Urun Verknuepfung (optional)</label>

                {/* Selected product preview */}
                {form.selectedProductId && selectedProductName ? (
                  <div className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-3">
                    <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-600">
                      {form.selectedProductImage ? (
                        <img src={form.selectedProductImage} alt={selectedProductName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">📦</div>
                      )}
                      {/* Discount badge overlay */}
                      {(() => {
                        const origP = form.originalPrice !== '' ? Number(form.originalPrice) : null;
                        const discP = form.discountPrice !== '' ? Number(form.discountPrice) : null;
                        if (origP && discP && discP < origP) {
                          const pct = Math.round(((origP - discP) / origP) * 100);
                          return (
                            <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg" style={{ transform: 'translate(25%, -25%)' }}>
                              %{pct}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{selectedProductName}</div>
                      {/* Price display */}
                      <div className="flex items-center gap-2 mt-1">
                        {(() => {
                          const origP = form.originalPrice !== '' ? Number(form.originalPrice) : null;
                          const discP = form.discountPrice !== '' ? Number(form.discountPrice) : null;
                          if (origP && discP && discP < origP) {
                            return (
                              <>
                                <span className="text-muted-foreground line-through text-xs">{Number(origP).toFixed(2)} EUR</span>
                                <span className="text-green-400 font-bold text-sm">{Number(discP).toFixed(2)} EUR</span>
                              </>
                            );
                          } else if (origP) {
                            return <span className="text-white text-sm font-medium">{Number(origP).toFixed(2)} EUR</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, selectedProductId: '', selectedProductImage: '', originalPrice: '', discountPrice: '' }));
                        setSelectedProductName('');
                      }}
                      className="shrink-0 text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/20 rounded-lg transition"
                    >
                      Entfernen
                    </button>
                  </div>
                ) : (
                  /* Product picker button + dropdown */
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowProductPicker(!showProductPicker); setProductSearch(''); }}
                      className="w-full px-3 py-2.5 bg-gray-700 text-foreground rounded-lg border border-dashed border-gray-500 hover:border-gray-400 text-sm text-left transition"
                    >
                      Urun auswaehlen...
                    </button>

                    {showProductPicker && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-xl shadow-2xl z-20 max-h-72 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-gray-600">
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Urun suchen..."
                            autoFocus
                            className="w-full px-3 py-2 bg-card text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                          />
                        </div>
                        <div className="overflow-y-auto flex-1">
                          {masterProducts
                            .filter(p => {
                              if (!productSearch.trim()) return true;
                              const search = productSearch.toLowerCase();
                              const name = getLocalizedText(p.name).toLowerCase();
                              return name.includes(search);
                            })
                            .slice(0, 30)
                            .map(p => {
                              const img = p.imageUrl || (p.images || [])[0] || '';
                              const pName = getLocalizedText(p.name);
                              const pPrice = p.sellingPrice || p.appSellingPrice || p.inStorePrice || p.defaultPrice || 0;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setForm(f => ({
                                      ...f,
                                      selectedProductId: p.id,
                                      selectedProductImage: img,
                                      originalPrice: pPrice > 0 ? pPrice : '',
                                    }));
                                    setSelectedProductName(pName);
                                    setShowProductPicker(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-600/50 text-left transition"
                                >
                                  <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-card">
                                    {img ? (
                                      <img src={img} alt={pName} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">📦</div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{pName}</div>
                                    {pPrice > 0 && <div className="text-[10px] text-muted-foreground">{pPrice.toFixed(2)} EUR</div>}
                                  </div>
                                </button>
                              );
                            })}
                          {masterProducts.filter(p => {
                            if (!productSearch.trim()) return true;
                            const name = getLocalizedText(p.name).toLowerCase();
                            return name.includes(productSearch.toLowerCase());
                          }).length === 0 && (
                            <div className="px-3 py-4 text-center text-muted-foreground text-sm">Kein Produkt gefunden</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Price fields -- show when product is selected */}
                {form.selectedProductId && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Originalpreis (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.originalPrice}
                        onChange={(e) => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                        placeholder="z.B. 6.99"
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Aktionspreis (EUR) -- optional</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.discountPrice}
                        onChange={(e) => setForm(f => ({ ...f, discountPrice: e.target.value }))}
                        placeholder="z.B. 4.99"
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                      />
                    </div>
                    {/* Auto-calculated discount info */}
                    {(() => {
                      const origP = form.originalPrice !== '' ? Number(form.originalPrice) : null;
                      const discP = form.discountPrice !== '' ? Number(form.discountPrice) : null;
                      if (origP && discP && discP < origP) {
                        const pct = Math.round(((origP - discP) / origP) * 100);
                        return (
                          <div className="col-span-2 flex items-center gap-2 text-xs">
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">%{pct} Rabatt</span>
                            <span className="text-muted-foreground">Originalpreis: <span className="line-through">{origP.toFixed(2)} EUR</span> &rarr; <span className="text-green-400 font-semibold">{discP.toFixed(2)} EUR</span></span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* Keywords & Categories */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('productKeywords')}</label>
                  <input
                    type="text"
                    value={form.productKeywords}
                    onChange={(e) => setForm((f) => ({ ...f, productKeywords: e.target.value }))}
                    placeholder="basmati, pirinc, yayla"
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('targetBusinessTypes')}</label>
                  <input
                    type="text"
                    value={form.targetBusinessTypes}
                    onChange={(e) => setForm((f) => ({ ...f, targetBusinessTypes: e.target.value }))}
                    placeholder="market, bakkal, kasap"
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Hedefleme: Ulkeler + Opsiyonel Bolge */}
              <div className="space-y-3">
                <label className="block text-xs text-muted-foreground mb-2">Hedefleme</label>

                {/* Ulke secimi */}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1.5">Hangi ulkelerde goesterilecek?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allCodes = AVAILABLE_COUNTRIES.map(c => c.code);
                        const allSelected = allCodes.every(c => form.targetCountries.includes(c));
                        setForm(f => ({ ...f, targetCountries: allSelected ? ['DE'] : allCodes }));
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${AVAILABLE_COUNTRIES.every(c => form.targetCountries.includes(c.code)) ? 'bg-pink-600 border-pink-500 text-white' : 'bg-gray-700 border-gray-600 text-foreground hover:border-gray-400'}`}
                    >
                      Ganz Europa
                    </button>
                    {AVAILABLE_COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setForm(f => {
                            const has = f.targetCountries.includes(country.code);
                            const next = has
                              ? f.targetCountries.filter(c => c !== country.code)
                              : [...f.targetCountries, country.code];
                            return { ...f, targetCountries: next.length === 0 ? ['DE'] : next };
                          });
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition ${form.targetCountries.includes(country.code) ? 'bg-blue-600/30 border-blue-500/50 text-blue-300' : 'bg-gray-700 border-gray-600 text-muted-foreground hover:border-gray-400'}`}
                      >
                        <span>{country.flag}</span>
                        <span>{country.code}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opsiyonel bolge daraltma */}
                <div className="border border-border rounded-lg p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.targetRadius > 0}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setForm(f => ({ ...f, targetRadius: 0, targetCity: '' }));
                        } else {
                          setForm(f => ({ ...f, targetRadius: 25 }));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-xs text-foreground">Regionale Eingrenzung (optional)</span>
                  </label>
                  {form.targetRadius > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Stadt / Region</label>
                        <input
                          type="text"
                          value={form.targetCity || ''}
                          onChange={(e) => setForm(f => ({ ...f, targetCity: e.target.value }))}
                          placeholder="z.B. Duesseldorf, Koeln..."
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Umkreis (km)</label>
                        <input
                          type="number"
                          value={form.targetRadius}
                          onChange={(e) => setForm(f => ({ ...f, targetRadius: Number(e.target.value) }))}
                          placeholder="25"
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                        />
                      </div>
                      <p className="col-span-2 text-[10px] text-gray-500 -mt-1">Reklam sadece bu sehir/bolge cevresindeki kullanicilara gosterilir</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('pricingModel')}</label>
                  <select
                    value={form.pricingModel}
                    onChange={(e) => setForm((f) => ({ ...f, pricingModel: e.target.value }))}
                    title={t('pricingModel')}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  >
                    <option value="fixed_daily">{t('fixedDaily')}</option>
                    <option value="cpc">{t('cpc')}</option>
                    <option value="cpm">{t('cpm')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('bidAmount')} (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.bidAmount}
                    onChange={(e) => setForm((f) => ({ ...f, bidAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('dailyBudget')} (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.dailyBudget}
                    onChange={(e) => setForm((f) => ({ ...f, dailyBudget: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('totalBudget')} (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalBudget}
                    onChange={(e) => setForm((f) => ({ ...f, totalBudget: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('priority')}</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('startDate')}</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('endDate')}</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.advertiserName}
                  className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-medium rounded-lg text-sm disabled:opacity-50 transition"
                >
                  {saving ? t('saving') : editingId ? t('save') : t('create')}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
