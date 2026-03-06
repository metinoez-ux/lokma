'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';

export default function SettingsPage() {
    const t = useTranslations('AdminSettings');
    const { admin } = useAdmin();

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">{admin?.adminType === 'super' ? t('platform_ayarlari') : t('settings') || 'Ayarlar'}</h1>

                {/* 📋 AYARLAR MENÜSÜ - Only for non-super admins */}
                {admin?.adminType !== 'super' && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">📋</span>
                            <div>
                                <h2 className="text-xl font-bold">{t('i_sletme_yonetimi')}</h2>
                                <p className="text-gray-400 text-sm">{t('i_sletme_ayarlari_personel_masa_ve_hesap')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Menü ve Ürünler */}
                            <Link
                                href="/admin/products"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-900/50 flex items-center justify-center text-2xl group-hover:bg-emerald-800/50 transition">
                                    🍔
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-emerald-300 transition">{t('menu_ve_urunler')}</h3>
                                    <p className="text-xs text-gray-500">{t('urun_ve_kategori_yonetimi')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-emerald-400 transition text-xl">→</span>
                            </Link>

                            {/* Personel */}
                            <Link
                                href="/admin/staff-dashboard"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-slate-500 hover:bg-slate-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-slate-600/50 transition">
                                    👥
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-slate-300 transition">{t('personel') || 'Personel'}</h3>
                                    <p className="text-xs text-gray-500">{t('personel_listesi_ve_yonetimi')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-slate-400 transition text-xl">→</span>
                            </Link>

                            {/* Masa */}
                            <Link
                                href={`/admin/table-orders${admin?.butcherId ? `?businessId=${admin.butcherId}` : ''}`}
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-teal-600 hover:bg-teal-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-teal-900/50 flex items-center justify-center text-2xl group-hover:bg-teal-800/50 transition">
                                    🪑
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-teal-300 transition">{t('masa') || 'Masa'}</h3>
                                    <p className="text-xs text-gray-500">{t('masa_oturumlari_ve_gruplari')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-teal-400 transition text-xl">→</span>
                            </Link>

                            {/* Teslimat */}
                            <Link
                                href="/admin/delivery-settings"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-900/50 flex items-center justify-center text-2xl group-hover:bg-amber-800/50 transition">
                                    🚚
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-amber-300 transition">{t('teslimat') || 'Teslimat'}</h3>
                                    <p className="text-xs text-gray-500">{t('kurye_teslimat_ucreti_ve_siparis_saatler')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition text-xl">→</span>
                            </Link>

                            {/* Abonelik & Plan */}
                            <Link
                                href="/admin/subscription"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-violet-600 hover:bg-violet-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-violet-900/50 flex items-center justify-center text-2xl group-hover:bg-violet-800/50 transition">
                                    💳
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-violet-300 transition">{t('abonelik_plan') || 'Abonelik & Plan'}</h3>
                                    <p className="text-xs text-gray-500">{t('abonelik_plani_ve_ozellikler')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-violet-400 transition text-xl">→</span>
                            </Link>
                        </div>

                        {/* Hesabım - Alt bölümler */}
                        <div className="mt-6 bg-gray-900 rounded-xl border border-gray-700 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl">💼</span>
                                <h3 className="text-lg font-bold">{t('hesabim')}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Link
                                    href="/admin/invoices"
                                    className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-amber-900/50 flex items-center justify-center text-xl group-hover:bg-amber-800/50 transition">
                                        📄
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition">{t('faturalarim') || 'Faturalarım'}</h3>
                                        <p className="text-xs text-gray-500">{t('platform_faturalari_ve_abonelik_odemeler') || 'Platform faturaları'}</p>
                                    </div>
                                    <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition">→</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔧 SUPER ADMIN AYARLARI */}
                {admin?.adminType === 'super' && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">🔧</span>
                            <div>
                                <h2 className="text-xl font-bold">{t('platform_yonetimi') || 'Platform Yönetimi'}</h2>
                                <p className="text-gray-400 text-sm">{t('platform_genelindeki_ayarlari_buradan_yo') || 'Platform genelindeki ayarları buradan yönetin'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* IoT Gateway */}
                            <Link
                                href="/admin/settings/iot"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-purple-600 hover:bg-purple-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-purple-900/50 flex items-center justify-center text-2xl group-hover:bg-purple-800/50 transition">
                                    🔔
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-purple-300 transition">{t('akilli_bildirimler_iot_gateway')}</h3>
                                    <p className="text-xs text-gray-500">{t('alexa_led_tarayici_sesi_ayarlari') || 'Alexa, LED, tarayıcı sesi ayarları'}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-purple-400 transition text-xl">→</span>
                            </Link>

                            {/* Sponsored Products */}
                            <Link
                                href="/admin/settings/sponsored"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-900/50 flex items-center justify-center text-2xl group-hover:bg-amber-800/50 transition">
                                    ⭐
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-amber-300 transition">{t('one_cikan_urunler_sponsored')}</h3>
                                    <p className="text-xs text-gray-500">{t('ucretler_limitler_ve_platform_ayarlari') || 'Ücretler, limitler ve platform ayarları'}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition text-xl">→</span>
                            </Link>

                            {/* API Schlüssel */}
                            <Link
                                href="/admin/settings/api-keys"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-orange-600 hover:bg-orange-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-orange-900/50 flex items-center justify-center text-2xl group-hover:bg-orange-800/50 transition">
                                    🔑
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-orange-300 transition">API-Schlüssel</h3>
                                    <p className="text-xs text-gray-500">Verschlüsselte API-Schlüsselverwaltung</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-orange-400 transition text-xl">→</span>
                            </Link>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
