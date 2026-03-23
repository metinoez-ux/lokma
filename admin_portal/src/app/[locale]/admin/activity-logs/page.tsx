'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { auth } from '@/lib/firebase'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/currency'

export default function CustomerServicePage() {
    const t = useTranslations('AdminCustomerService')
    const locale = useLocale()
    const [query, setQuery] = useState('')
    const [dateFilter, setDateFilter] = useState('last7days')
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<{ users: any[], orders: any[], businesses?: any[] } | null>(null)
    const [error, setError] = useState('')

    // Modal state
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)
    const [cancelReason, setCancelReason] = useState('')

    const handleCancelOrder = async () => {
        if (!cancelReason) {
            alert(t('cancel_reason_prompt'))
            return
        }

        const confirmCancel = window.confirm(t('cancel_order_confirm'))
        if (!confirmCancel) return

        setIsCancelling(true)
        try {
            const token = await auth.currentUser?.getIdToken()
            const res = await fetch('/api/admin/orders/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ orderId: selectedOrder.id, cancelReason })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to cancel order')

            // Update local state to reflect cancellation
            const updatedOrders = results?.orders.map(o => o.id === selectedOrder.id ? { ...o, status: 'cancelled' } : o) || []
            setResults(prev => prev ? { ...prev, orders: updatedOrders } : null)
            setSelectedOrder(null)

            // Wait slightly for setState to clear
            setTimeout(() => {
                alert(t('cancel_success'))
            }, 100);

        } catch (err: any) {
            console.error(err)
            alert(t('cancel_error') + ': ' + err.message)
        } finally {
            setIsCancelling(false)
            setCancelReason('')
        }
    }

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <span className="text-3xl">🎧</span>
                        {t('title')}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm md:text-base">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Search Section */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-muted-foreground text-xl">🔍</span>
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('search_placeholder')}
                            className="w-full pl-12 pr-4 py-4 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent text-lg transition-all"
                        />
                    </div>

                    <div className="md:w-48 shrink-0">
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                            }}
                            className="w-full h-full min-h-[56px] px-4 py-4 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all appearance-none cursor-pointer"
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
                        className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium text-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shadow-sm shadow-primary/20"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
                    {results.users.length === 0 && results.orders.length === 0 && (!results.businesses || results.businesses.length === 0) ? (
                        <div className="text-center py-16 bg-card/50 rounded-2xl border border-border/50">
                            <span className="text-5xl opacity-50 block mb-4">📭</span>
                            <h3 className="text-xl text-foreground font-medium">{t('no_results')}</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Businesses Row (Full Width) */}
                            {results.businesses && results.businesses.length > 0 && (
                                <div className="col-span-1 lg:col-span-2 space-y-4 text-left">
                                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
                                        <span>🏢</span> {t('businesses_found')} ({results.businesses.length})
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {results.businesses.map((business: any) => (
                                            <Link href={`/${locale}/admin/business/${business.id}`} key={business.id} className="block">
                                                <div className="bg-card rounded-xl p-5 border border-border hover:border-amber-500/50 transition-all shadow-lg group h-full">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-full bg-amber-900/50 flex items-center justify-center text-amber-300 font-bold text-xl border border-amber-500/30 shrink-0">
                                                                {business.companyName?.charAt(0) || '?'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="text-lg font-bold text-foreground group-hover:text-amber-800 dark:text-amber-400 transition-colors truncate">
                                                                    {business.companyName}
                                                                </h3>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-muted-foreground font-mono tracking-wider shrink-0">
                                                                        ID: {business.id.substring(0, 8)}...
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 ${business.isActive ? 'bg-green-900/50 text-green-300 border-green-500/30' : 'bg-red-900/50 text-red-300 border-red-500/30'}`}>
                                                            {business.isActive ? t('aktif_buyuk') : t('inaktif_buyuk')}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 bg-background/50 p-4 rounded-lg border-l-2 border-l-amber-500/50">
                                                        <div>
                                                            <p className="text-gray-500 text-xs uppercase hover:text-muted-foreground transition-colors">{t('user_card.email')}</p>
                                                            <p className="text-gray-200 font-medium truncate" title={business.email}>{business.email || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 text-xs uppercase hover:text-muted-foreground transition-colors">{t('user_card.phone')}</p>
                                                            <p className="text-gray-200 font-medium">{business.phoneNumber || '-'}</p>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <p className="text-gray-500 text-xs uppercase hover:text-muted-foreground transition-colors">{t('order_card.address')}</p>
                                                            <p className="text-foreground leading-snug">
                                                                {business.address
                                                                    ? `${business.address.street || ''}, ${business.address.postalCode || ''} ${business.address.city || ''}`.trim()
                                                                    : '-'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center justify-between sm:col-span-2 pt-2 mt-1 border-t border-border/50">
                                                            <span className="text-sm text-muted-foreground font-medium">
                                                                {business.createdAt ? new Date(business.createdAt).toLocaleString(locale) : '-'}
                                                            </span>
                                                            <span className="text-xs px-2 py-1 rounded bg-card text-foreground border border-gray-600 uppercase font-mono tracking-wider shadow-sm">
                                                                {business.subscriptionPlan || 'FREE'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Users Column */}
                            <div className="space-y-4 text-left">
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
                                    <span>👤</span> {t('users_found')} ({results.users.length})
                                </h2>
                                {results.users.map(user => (
                                    <div key={user.id} className="bg-card rounded-xl p-5 md:p-6 border border-border hover:border-indigo-500/50 transition-all shadow-lg group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xl border border-indigo-500/30">
                                                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-800 dark:text-indigo-400 transition-colors">
                                                        {user.displayName || 'No Name'}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {(user.adminType === 'restoran_admin' || user.adminType === 'market_admin') ? (
                                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest font-semibold flex items-center gap-1">
                                                                <span className="text-[10px]">🏢</span> {t('b2b_unternehmen')}
                                                            </span>
                                                        ) : user.adminType === 'restoran_staff' ? (
                                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-widest font-semibold flex items-center gap-1">
                                                                <span className="text-[10px]">🧑‍🍳</span> {t('personel')}
                                                            </span>
                                                        ) : user.isVirtualKermesUser ? (
                                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-widest font-semibold flex items-center gap-1">
                                                                <span className="text-[10px]">🏕️</span> Community User
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 uppercase tracking-wider">
                                                                <span className="text-[10px]">👤</span> {t('b2c_kunde')}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-muted-foreground font-mono tracking-wider ml-1">
                                                            ID: {user.id.substring(0, 8)}...
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${user.role === 'admin' ? 'bg-purple-900/50 text-purple-300 border-purple-500/30' :
                                                user.role === 'business_admin' ? 'bg-orange-900/50 text-orange-300 border-orange-500/30' :
                                                    'bg-indigo-900/50 text-indigo-300 border-indigo-500/30'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 bg-background/50 p-4 rounded-lg">
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
                                                <p className="text-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">{t('user_card.app_lang')}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-200 uppercase font-medium">{user.appLanguage || 'TR'}</span>
                                                    {user.fcmToken && <span title="Push Enabled" className="text-green-800 dark:text-green-400">📱</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Orders Accordion */}
                                        {
                                            user.recentOrders && user.recentOrders.length > 0 && (
                                                <div className="mt-4 border-t border-border/50 pt-4">
                                                    <details className="group/details">
                                                        <summary className="text-sm font-medium text-blue-800 dark:text-blue-400 cursor-pointer list-none select-none flex items-center justify-between hover:text-blue-300 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-900/30 group-open/details:bg-blue-900/50">
                                                                    <svg className="w-4 h-4 transform transition-transform group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </span>
                                                                <span className="font-semibold">{t('last_orders')} ({user.recentOrders.length})</span>
                                                            </div>
                                                        </summary>
                                                        <div className="mt-3 space-y-2 pl-2 border-l border-border/50">
                                                            {user.recentOrders.map((ro: any) => (
                                                                <div key={ro.id} className="bg-card/80 p-3 rounded flex flex-col gap-1 text-sm border border-border/30">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis mr-2">#{ro.orderNumber}</span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0 ${ro.status === 'completed' || ro.status === 'delivered' ? 'bg-green-900/40 text-green-300' :
                                                                            ro.status === 'cancelled' || ro.status === 'rejected' ? 'bg-red-900/40 text-red-300' :
                                                                                ro.status === 'preparing' || ro.status === 'accepted' ? 'bg-blue-900/40 text-blue-300' :
                                                                                    'bg-yellow-900/40 text-yellow-500'}`}>
                                                                            {ro.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1">
                                                                        <span className="text-muted-foreground font-medium truncate shrink" title={ro.businessName}>{ro.businessName}</span>
                                                                        <span className="text-gray-500 shrink-0 ml-2">{ro.createdAt ? new Date(ro.createdAt).toLocaleDateString() : '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-border/30">
                                                                        <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 uppercase shrink-0 text-[10px]">{ro.type}</span>
                                                                        <span className="text-emerald-800 dark:text-emerald-400 font-bold shrink-0">{formatCurrency(ro.totalPrice, ro.currency)}</span>
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
                                    <div className="text-center py-8 text-gray-500 border border-dashed border-border rounded-xl">
                                        No users match
                                    </div>
                                )}
                            </div>

                            {/* Orders Column */}
                            <div className="space-y-4 text-left">
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
                                    <span>📦</span> {t('orders_found')} ({results.orders.length})
                                </h2>
                                {results.orders.map((order: any) => (
                                    <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-card rounded-xl p-5 border border-border hover:border-blue-500/50 transition-all shadow-lg group cursor-pointer relative">
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xl">🔍</span>
                                        </div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground group-hover:text-blue-800 dark:text-blue-400 transition-colors flex items-center gap-2">
                                                    #{order.orderNumber}
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 font-normal">
                                                        {order.id.substring(0, 6)}...
                                                    </span>
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">{order.businessName}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${order.status === 'completed' || order.status === 'delivered' ? 'bg-green-900/50 text-green-300 border-green-500/30' :
                                                    order.status === 'cancelled' || order.status === 'rejected' ? 'bg-red-900/50 text-red-300 border-red-500/30' :
                                                        order.status === 'preparing' || order.status === 'accepted' ? 'bg-blue-900/50 text-blue-300 border-blue-500/30' :
                                                            'bg-yellow-900/50 text-yellow-300 border-yellow-500/30'
                                                    }`}>
                                                    {order.status.toUpperCase()}
                                                </span>
                                                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-400">{formatCurrency(order.totalPrice, order.currency)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 bg-background/50 p-4 rounded-lg border-l-2 border-l-blue-500/50">
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
                                                <p className="text-foreground leading-snug">
                                                    {order.address
                                                        ? `${order.address.street || order.address}, ${order.address.postalCode || ''} ${order.address.city || ''}`.trim()
                                                        : '-'}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between sm:col-span-2 pt-2 mt-1 border-t border-border/50">
                                                <span className="text-sm text-muted-foreground">
                                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded bg-card text-foreground border border-gray-600">
                                                    {order.type.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {results.orders.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 border border-dashed border-border rounded-xl">
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

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-2xl w-full max-w-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border bg-background">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                                    {t('order_details')} <span className="text-muted-foreground font-mono text-lg">#{selectedOrder.orderNumber}</span>
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">ID: {selectedOrder.id}</p>
                            </div>
                            <button
                                onClick={() => { setSelectedOrder(null); setCancelReason(''); }}
                                className="w-10 h-10 rounded-full bg-card hover:bg-gray-700 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {/* Basics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-card/50 p-4 rounded-xl border border-border/50">
                                    <p className="text-xs text-gray-500 uppercase">{t('order_card.customer')}</p>
                                    <p className="text-lg text-foreground font-medium">{selectedOrder.customerName || selectedOrder.userDisplayName || '-'}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{selectedOrder.customerPhone || selectedOrder.userPhone || '-'}</p>
                                </div>
                                <div className="bg-card/50 p-4 rounded-xl border border-border/50">
                                    <p className="text-xs text-gray-500 uppercase">{t('order_card.business')}</p>
                                    <p className="text-lg text-foreground font-medium">{selectedOrder.businessName || '-'}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-sm text-muted-foreground">{selectedOrder.type.toUpperCase()}</p>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedOrder.status === 'completed' || selectedOrder.status === 'delivered' ? 'bg-green-900/40 text-green-800 dark:text-green-400' :
                                            selectedOrder.status === 'cancelled' || selectedOrder.status === 'rejected' ? 'bg-red-900/40 text-red-800 dark:text-red-400' :
                                                'bg-blue-900/40 text-blue-800 dark:text-blue-400'
                                            }`}>
                                            {selectedOrder.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div className="bg-card/30 p-5 rounded-xl border border-border/50">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                    <span>💳</span> {t('payment')}
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">{t('order_card.total')}</p>
                                        <p className="text-xl font-bold text-emerald-800 dark:text-emerald-400">{formatCurrency(selectedOrder.totalPrice, selectedOrder.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">{t('payment_method')}</p>
                                        <p className="text-white capitalize">{selectedOrder.paymentMethod || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">{t('payment_status')}</p>
                                        <p className="text-white capitalize">{selectedOrder.paymentStatus || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="bg-card/30 p-5 rounded-xl border border-border/50">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                    <span>⏱️</span> {t('timeline')}
                                </h3>
                                <div className="space-y-3">
                                    {['createdAt', 'acceptedAt', 'preparingAt', 'readyAt', 'assignedAt', 'pickedUpAt', 'deliveredAt'].map((fieldKey) => (
                                        selectedOrder[fieldKey] && (
                                            <div key={fieldKey} className="flex justify-between items-center text-sm border-b border-border/30 pb-2 last:border-0 last:pb-0">
                                                <span className="text-foreground">{t(`fields.${fieldKey}`)}</span>
                                                <span className="text-muted-foreground font-mono">
                                                    {new Date(selectedOrder[fieldKey]).toLocaleString()}
                                                </span>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            {/* Courier & PoD */}
                            {(selectedOrder.courierName || selectedOrder.photoUrl) && (
                                <div className="bg-card/30 p-5 rounded-xl border border-border/50">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                        <span>🛵</span> {t('courier')} & {t('pod_photo')}
                                    </h3>
                                    {selectedOrder.courierName && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 mb-1">{t('kurier_name')}</p>
                                            <p className="text-foreground">{selectedOrder.courierName}</p>
                                        </div>
                                    )}
                                    {selectedOrder.photoUrl && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">{t('pod_photo')}</p>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={selectedOrder.photoUrl} alt="PoD" className="w-full h-auto rounded-lg border border-border max-h-64 object-cover" />
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Footer (Admin Cancel Actions) */}
                        <div className="p-6 border-t border-border bg-background flex justify-between items-center">
                            {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'rejected' && (
                                <div className="flex-1 flex flex-col gap-3 mr-4">
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            t('cancelModal.reasons.outOfStock'),
                                            t('cancelModal.reasons.closed'),
                                            t('cancelModal.reasons.noDelivery'),
                                            t('cancelModal.reasons.duplicate'),
                                            t('cancelModal.reasons.customerRequest'),
                                        ].map((reason) => (
                                            <button
                                                key={reason}
                                                onClick={() => setCancelReason(reason)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${cancelReason === reason
                                                    ? 'bg-red-900/50 text-red-200 border-red-500/50'
                                                    : 'bg-card text-muted-foreground border-border hover:bg-gray-700 hover:text-foreground'
                                                    }`}
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <input
                                            type="text"
                                            placeholder={t('cancelModal.customReason')}
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            className="bg-card border border-red-900/50 rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-red-500 flex-1 placeholder:text-gray-600"
                                        />
                                        <button
                                            onClick={handleCancelOrder}
                                            disabled={isCancelling || !cancelReason.trim()}
                                            className="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap border border-red-500/30 hover:border-red-500"
                                        >
                                            {isCancelling ? t('wird_verarbeitet') : t('cancelModal.confirm')}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => { setSelectedOrder(null); setCancelReason(''); }}
                                className="px-6 py-2 bg-card hover:bg-gray-700 text-white rounded-lg font-medium transition-colors ml-auto"
                            >
                                {t('schliessen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
