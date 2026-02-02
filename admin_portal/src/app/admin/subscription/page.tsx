'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

export default function SubscriptionPage() {
    const { admin, loading } = useAdmin();

    if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

    if (!admin?.butcherId) {
        return <div className="p-8 text-white">Bu sayfaya erişim yetkiniz yok.</div>;
    }

    // Mock Data (In production, fetch from /api/subscription/status)
    const currentPlan = (admin.adminType as string) === 'super_admin' ? 'ULTRA' : 'PRO'; // Mock
    const nextBillingDate = '01 Şubat 2026';
    const monthlyFee = currentPlan === 'ULTRA' ? 99 : 49;

    // ESL Mock Data (Rent-to-Own)
    const eslEnabled = true;
    const eslCount = 150;
    const eslUnitCost = 0.50;
    const eslTotal = eslCount * eslUnitCost;
    const ownershipMonth = 4; // Month 4 of 24

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Abonelik ve Ödemeler</h1>
                <p className="text-gray-400 mb-8">Planınızı ve faturalarınızı buradan yönetin.</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* CURRENT PLAN CARD */}
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-sm text-gray-400 uppercase font-bold tracking-wider">MEVCUT PLAN</p>
                                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mt-2">
                                    {currentPlan}
                                </h2>
                            </div>
                            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">AKTİF</span>
                        </div>

                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-bold">€{monthlyFee}</span>
                            <span className="text-gray-400">/ay</span>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <span className="text-green-400">✓</span> Sınırsız Sipariş
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <span className="text-green-400">✓</span> B2B Toptancı Modülü
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <span className="text-green-400">✓</span> 7/24 Destek
                            </div>
                            {currentPlan === 'ULTRA' && (
                                <div className="flex items-center gap-3 text-sm text-gray-300">
                                    <span className="text-purple-400">★</span> AI Tahminleme
                                </div>
                            )}
                        </div>

                        <button className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white py-3 rounded-xl font-bold transition">
                            Planı Değiştir
                        </button>
                    </div>

                    {/* ESL HARDWARE RENTAL CARD */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute -right-8 -top-8 text-9xl text-gray-700/20 rotate-12">🏷️</div>

                        <div className="relative z-10">
                            <p className="text-sm text-gray-400 uppercase font-bold tracking-wider mb-2">DONANIM KİRALAMA (ESL)</p>
                            <h3 className="text-2xl font-bold mb-6">Elektronik Etiketler</h3>

                            {eslEnabled ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                                            <p className="text-xs text-gray-500 mb-1">ADET</p>
                                            <p className="text-2xl font-bold">{eslCount}</p>
                                        </div>
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                                            <p className="text-xs text-gray-500 mb-1">AYLIK</p>
                                            <p className="text-2xl font-bold">€{eslTotal}</p>
                                        </div>
                                    </div>

                                    {/* Rent-to-Own Progress */}
                                    <div className="mb-6">
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-gray-400">Sahiplik İlerlemesi ({ownershipMonth}/24 Ay)</span>
                                            <span className="text-green-400 font-bold">%16</span>
                                        </div>
                                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[16%] relative">
                                                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/50"></div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            20 ay sonra bu cihazlar tamamen sizin olacak ve aylık kira ücreti alınmayacak.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 mb-4">Henüz elektronik etiket kullanmıyorsunuz.</p>
                                    <button className="text-green-400 underline">ESL Paketlerini İncele</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BILLING & INVOICES */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-xl flex flex-col">
                        <p className="text-sm text-gray-400 uppercase font-bold tracking-wider mb-2">ÖDEME YÖNTEMİ</p>
                        <div className="flex items-center gap-4 mb-8 bg-gray-900 p-4 rounded-xl border border-gray-700">
                            <div className="bg-white p-2 rounded w-12 h-8 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-orange-500 translate-x-2 opacity-80"></div>
                                <div className="w-8 h-8 rounded-full bg-red-500 -translate-x-2 opacity-80"></div>
                            </div>
                            <div>
                                <p className="font-bold">Mastercard •••• 4242</p>
                                <p className="text-xs text-gray-400">Son kullanma: 12/28</p>
                            </div>
                            <button className="ml-auto text-sm text-gray-400 hover:text-white">Değiştir</button>
                        </div>

                        <div className="flex-1">
                            <h3 className="font-bold mb-4">Son Faturalar</h3>
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-700 rounded-lg transition cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-gray-700 group-hover:bg-gray-600 p-2 rounded text-gray-300">📄</div>
                                            <div>
                                                <p className="font-bold text-sm">Ocak 2026</p>
                                                <p className="text-xs text-gray-500">MIRA-2026-00{i}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm">€{monthlyFee + eslTotal}</p>
                                            <p className="text-xs text-green-400">Ödendi</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="w-full text-center text-sm text-gray-500 hover:text-white mt-4">Tümünü Gör</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
