'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export default function CustomerServicePage() {
    const t = useTranslations('AdminCustomerService')
    const [query, setQuery] = useState('')
    const [dateFilter, setDateFilter] = useState('all')
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<{ users: any[], orders: any[] } | null>(null)
    const [error, setError] = useState('')

    // Generate years dynamically starting from 2026 up to current year
    const currentYear = new Date().getFullYear();
    const availableYears = [];
    for (let y = 2026; y <= currentYear; y++) {
        availableYears.push(y);
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (query.length < 2 && dateFilter === 'all') return

        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/admin/customer-service?q=${encodeURIComponent(query)}&dateFilter=${dateFilter}`)
            if (!res.ok) throw new Error('Search failed')
            const data = await res.json()
            setResults(data)
        } catch (err: any) {
            setError(err.message)
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-indigo-900/50 p-6 rounded-2xl border border-indigo-500/30 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">🎧</span>
                        {t('title')}
                    </h1>
                    <p className="text-indigo-200 mt-2 text-sm md:text-base">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Search Section */}
            <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700 shadow-xl space-y-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-gray-400 text-xl">🔍</span>
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('search_placeholder')}
                            className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-all"
                        />
                    </div>

                    <div className="md:w-48 shrink-0">
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                            }}
                            className="w-full h-full min-h-[56px] px-4 py-4 bg-gray-900 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">{t('date_filter_all')}</option>
                            <option value="today">{t('date_filter_today')}</option>
                            <option value="yesterday">{t('date_filter_yesterday')}</option>
                            <option value="last7days">{t('date_filter_last7days')}</option>
                            <option value="thisMonth">{t('date_filter_thisMonth')}</option>
                            <option value="thisYear">{t('date_filter_thisYear')} ({currentYear})</option>
                            <optgroup label={t('date_filter_years')}>
                                {availableYears.map(year => (
                                    <option key={year} value={year.toString()}>{year}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || (query.length < 2 && dateFilter === 'all')}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium text-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-500/20"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            t('search_button')
                        )}
                    </button>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 flex items-center gap-3">
                    <span className="text-xl">⚠️</span> {error}
                </div>
            )}

            {/* Results Section */}
            {!loading && results && (
                <div className="space-y-8 animate-fade-in">
                    {results.users.length === 0 && results.orders.length === 0 ? (
                        <div className="text-center py-16 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                            <span className="text-5xl opacity-50 block mb-4">📭</span>
                            <h3 className="text-xl text-gray-300 font-medium">{t('no_results')}</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Users Column */}
                            <div className="space-y-4 text-left">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                                    <span>👤</span> {t('users_found')} ({results.users.length})
                                </h2>
                                {results.users.map(user => (
                                    <div key={user.id} className="bg-gray-800 rounded-xl p-5 md:p-6 border border-gray-700 hover:border-indigo-500/50 transition-all shadow-lg group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xl border border-indigo-500/30">
                                                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                        {user.displayName || 'No Name'}
                                                    </h3>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 uppercase tracking-wider">
                                                        {t('id')} {user.id.substring(0, 8)}...
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${user.role === 'admin' ? 'bg-purple-900/50 text-purple-300 border-purple-500/30' :
                                                user.role === 'business_admin' ? 'bg-orange-900/50 text-orange-300 border-orange-500/30' :
                                                    'bg-indigo-900/50 text-indigo-300 border-indigo-500/30'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 bg-gray-900/50 p-4 rounded-lg">
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.email')}</p>
                                                <p className="text-gray-200 font-medium truncate" title={user.email}>{user.email || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.phone')}</p>
                                                <p className="text-gray-200 font-medium">{user.phoneNumber || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.registered')}</p>
                                                <p className="text-gray-300">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.app_lang')}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-200 uppercase font-medium">{user.appLanguage || 'TR'}</span>
                                                    {user.fcmToken && <span title="Push Enabled" className="text-green-400">📱</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Orders Accordion */}
                                        {
                                            user.recentOrders && user.recentOrders.length > 0 && (
                                                <div className="mt-4 border-t border-gray-700/50 pt-4">
                                                    <details className="group/details">
                                                        <summary className="text-sm font-medium text-blue-400 cursor-pointer list-none select-none flex items-center justify-between hover:text-blue-300 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-900/30 group-open/details:bg-blue-900/50">
                                                                    <svg className="w-4 h-4 transform transition-transform group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </span>
                                                                <span className="font-semibold">{t('last_orders')} ({user.recentOrders.length})</span>
                                                            </div>
                                                        </summary>
                                                        <div className="mt-3 space-y-2 pl-2 border-l border-gray-700/50">
                                                            {user.recentOrders.map((ro: any) => (
                                                                <div key={ro.id} className="bg-gray-800/80 p-3 rounded flex flex-col gap-1 text-sm border border-gray-700/30">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-gray-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis mr-2">#{ro.orderNumber}</span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0 ${ro.status === 'completed' || ro.status === 'delivered' ? 'bg-green-900/40 text-green-300' :
                                                                            ro.status === 'cancelled' || ro.status === 'rejected' ? 'bg-red-900/40 text-red-300' :
                                                                                ro.status === 'preparing' || ro.status === 'accepted' ? 'bg-blue-900/40 text-blue-300' :
                                                                                    'bg-yellow-900/40 text-yellow-500'}`}>
                                                                            {ro.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1">
                                                                        <span className="text-gray-400 font-medium truncate shrink" title={ro.businessName}>{ro.businessName}</span>
                                                                        <span className="text-gray-500 shrink-0 ml-2">{ro.createdAt ? new Date(ro.createdAt).toLocaleDateString() : '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-gray-700/30">
                                                                        <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 uppercase shrink-0 text-[10px]">{ro.type}</span>
                                                                        <span className="text-emerald-400 font-bold shrink-0">€{ro.totalPrice?.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            )
                                        }
                                    </div>
                                ))}
                                {results.users.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-xl">
                                        No users match
                                    </div>
                                )}
                            </div>

                            {/* Orders Column */}
                            <div className="space-y-4 text-left">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                                    <span>📦</span> {t('orders_found')} ({results.orders.length})
                                </h2>
                                {results.orders.map((order: any) => (
                                    <div key={order.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-blue-500/50 transition-all shadow-lg group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                                    #{order.orderNumber}
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-normal">
                                                        {order.id.substring(0, 6)}...
                                                    </span>
                                                </h3>
                                                <p className="text-sm text-gray-400 mt-1">{order.businessName}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${order.status === 'completed' || order.status === 'delivered' ? 'bg-green-900/50 text-green-300 border-green-500/30' :
                                                    order.status === 'cancelled' || order.status === 'rejected' ? 'bg-red-900/50 text-red-300 border-red-500/30' :
                                                        order.status === 'preparing' || order.status === 'accepted' ? 'bg-blue-900/50 text-blue-300 border-blue-500/30' :
                                                            'bg-yellow-900/50 text-yellow-300 border-yellow-500/30'
                                                    }`}>
                                                    {order.status.toUpperCase()}
                                                </span>
                                                <p className="text-lg font-bold text-emerald-400">€{order.totalPrice?.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 bg-gray-900/50 p-4 rounded-lg border-l-2 border-l-blue-500/50">
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('order_card.customer')}</p>
                                                <p className="text-gray-200 font-medium">{order.customerName || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.phone')}</p>
                                                <p className="text-gray-200 font-medium">{order.customerPhone || '-'}</p>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <p className="text-gray-500 text-xs uppercase">{t('order_card.address')}</p>
                                                <p className="text-gray-300 leading-snug">
                                                    {order.address
                                                        ? `${order.address.street || order.address}, ${order.address.postalCode || ''} ${order.address.city || ''}`.trim()
                                                        : '-'}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between sm:col-span-2 pt-2 mt-1 border-t border-gray-700/50">
                                                <span className="text-sm text-gray-400">
                                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-600">
                                                    {order.type.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {results.orders.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-xl">
                                        No orders match
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            )
            }

            {
                !loading && !results && !error && (
                    <div className="text-center py-20 text-gray-500">
                        <span className="text-5xl opacity-30 block mb-4">🔎</span>
                        <p>{t('search_to_start')}</p>
                    </div>
                )
            }

            <style jsx global>{`
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div >
    )
}
