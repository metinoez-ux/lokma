'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db, auth } from '@/lib/firebase'
import { isSuperAdmin } from '@/lib/config'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore'

interface ActivityLog {
    id: string
    actorId: string
    actorType: string
    actorName: string
    actorEmail?: string
    actorPhone?: string
    action: string
    actionCategory: string
    targetType: string
    targetId: string
    targetName?: string
    vendorId?: string
    vendorName?: string
    customerId?: string
    customerName?: string
    details?: Record<string, unknown>
    timestamp: Timestamp
    location?: { latitude: number; longitude: number }
}

const ACTION_LABELS: Record<string, string> = {
    'order.created': '🛒 Sipariş Oluşturuldu',
    'order.confirmed': '✅ Sipariş Onaylandı',
    'order.rejected': '❌ Sipariş Reddedildi',
    'order.preparing': '👨‍🍳 Hazırlanıyor',
    'order.ready': '📦 Hazır',
    'order.completed': '🎉 Teslim Edildi',
    'order.cancelled': '🚫 İptal Edildi',
    'order.edited': '✏️ Sipariş Düzenlendi',
    'delivery.claimed': '🛵 Kurye Teslimatı Aldı',
    'delivery.pickedUp': '📤 Ürün Alındı',
    'delivery.inTransit': '🚗 Yolda',
    'delivery.delivered': '🎉 Teslim Edildi',
    'delivery.gps_update': '📍 GPS Güncelleme',
    'delivery.route_started': '🗺️ Rota Başladı',
    'delivery.arrived': '🏁 Varış',
    'carpet.requested': '🧹 Halı Yıkama Talebi',
    'carpet.pickedUp': '📥 Halı Alındı',
    'carpet.delivered': '🏠 Halı Teslim Edildi',
}

const CATEGORY_COLORS: Record<string, string> = {
    order: 'bg-blue-500',
    delivery: 'bg-orange-500',
    carpet: 'bg-purple-500',
    payment: 'bg-green-500',
    auth: 'bg-gray-500',
}

export default function ActivityLogsPage() {
    const [user, setUser] = useState<User | null>(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [limitCount, setLimitCount] = useState(50) // Start with 50
    const [loadingMore, setLoadingMore] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchType, setSearchType] = useState<'phone' | 'uid' | 'order'>('phone')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today')

    // Listen to auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setAuthLoading(false)
        })
        return () => unsubscribe()
    }, [])

    // Check if user is super_admin or hotline
    const isAuthorized = isSuperAdmin(user?.email || null)

    useEffect(() => {
        if (!authLoading && isAuthorized) {
            loadLogs()
        }
    }, [authLoading, isAuthorized, categoryFilter, dateFilter])

    const loadLogs = async () => {
        setLoading(true)
        try {
            let q = query(
                collection(db, 'activity_logs'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            )

            // Date filter
            if (dateFilter !== 'all') {
                const now = new Date()
                let startDate: Date
                switch (dateFilter) {
                    case 'today':
                        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                        break
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                        break
                    case 'month':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                        break
                    default:
                        startDate = new Date(0)
                }
                q = query(
                    collection(db, 'activity_logs'),
                    where('timestamp', '>=', Timestamp.fromDate(startDate)),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                )
            }

            const snapshot = await getDocs(q)
            let fetchedLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ActivityLog[]

            // Category filter (client-side)
            if (categoryFilter !== 'all') {
                fetchedLogs = fetchedLogs.filter(log => log.actionCategory === categoryFilter)
            }

            setLogs(fetchedLogs)
        } catch (error) {
            console.error('Error loading activity logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLoadMore = () => {
        setLoadingMore(true)
        setLimitCount((prev) => prev + 50)
    }

    useEffect(() => {
        if (!loading && limitCount > 50) {
            loadLogs().finally(() => setLoadingMore(false))
        }
    }, [limitCount])

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadLogs()
            return
        }

        setLoading(true)
        try {
            let q

            switch (searchType) {
                case 'phone':
                    q = query(
                        collection(db, 'activity_logs'),
                        where('actorPhone', '==', searchQuery.trim()),
                        orderBy('timestamp', 'desc'),
                        limit(100)
                    )
                    break
                case 'uid':
                    q = query(
                        collection(db, 'activity_logs'),
                        where('actorId', '==', searchQuery.trim()),
                        orderBy('timestamp', 'desc'),
                        limit(100)
                    )
                    break
                case 'order':
                    q = query(
                        collection(db, 'activity_logs'),
                        where('targetId', '==', searchQuery.trim()),
                        orderBy('timestamp', 'desc'),
                        limit(100)
                    )
                    break
            }

            if (q) {
                const snapshot = await getDocs(q)
                const fetchedLogs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as ActivityLog[]
                setLogs(fetchedLogs)
            }
        } catch (error) {
            console.error('Error searching activity logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimestamp = (timestamp: Timestamp) => {
        if (!timestamp) return '-'
        const date = timestamp.toDate()
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        )
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Yetkisiz Erişim</h1>
                    <p className="text-gray-400">Bu sayfaya sadece Super Admin ve Hotline personeli erişebilir.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-900 p-4 md:p-6">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                {/* Back Navigation */}
                <Link
                    href="/admin/dashboard"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                >
                    <span className="text-xl">←</span>
                    <span>Admin Dashboard</span>
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl md:text-3xl">📋</span>
                    <h1 className="text-xl md:text-2xl font-bold text-white">Activity Logs</h1>
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                        Müşteri Hizmetleri
                    </span>
                </div>
                <p className="text-gray-400">Tüm kullanıcı ve işletme aktivitelerini takip edin</p>
            </div>

            {/* Search & Filters */}
            <div className="bg-gray-800 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {/* Search Type */}
                    <div>
                        <label className="block text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Arama Tipi</label>
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value as 'phone' | 'uid' | 'order')}
                            className="w-full bg-gray-700 text-white rounded-lg px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base focus:ring-2 focus:ring-orange-500 outline-none"
                            title="Arama Tipi Seçin"
                        >
                            <option value="phone">📱 Telefon No</option>
                            <option value="uid">🔑 User ID</option>
                            <option value="order">📦 Sipariş ID</option>
                        </select>
                    </div>

                    {/* Search Input */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Arama</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchType === 'phone' ? '+49...' : searchType === 'uid' ? 'UID...' : 'Order ID...'}
                                className="flex-1 bg-gray-700 text-white rounded-lg px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base focus:ring-2 focus:ring-orange-500 outline-none"
                                title="Arama Sorgusu"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                className="px-4 md:px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
                            >
                                🔍 Ara
                            </button>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Kategori</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base focus:ring-2 focus:ring-orange-500 outline-none"
                            title="Kategori Filtresi"
                        >
                            <option value="all">Tümü</option>
                            <option value="order">🛒 Siparişler</option>
                            <option value="delivery">🛵 Teslimatlar</option>
                            <option value="carpet">🧹 Halı Yıkama</option>
                            <option value="payment">💳 Ödemeler</option>
                        </select>
                    </div>
                </div>

                {/* Date Filter Tabs */}
                <div className="flex gap-2 mt-4">
                    {[
                        { key: 'today', label: 'Bugün' },
                        { key: 'week', label: 'Son 7 Gün' },
                        { key: 'month', label: 'Son 30 Gün' },
                        { key: 'all', label: 'Tümü' },
                    ].map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => setDateFilter(opt.key as typeof dateFilter)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === opt.key
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">📜 Aktivite Zaman Çizelgesi</h2>
                    <span className="text-gray-400 text-sm">{logs.length} kayıt</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto"></div>
                        <p className="text-gray-400 mt-4">Yükleniyor...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-5xl mb-4">📭</div>
                        <p className="text-gray-400">Aktivite kaydı bulunamadı</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {logs.map((log) => (
                            <div key={log.id} className="p-4 hover:bg-gray-750 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Category Badge */}
                                    <div className={`w-10 h-10 rounded-full ${CATEGORY_COLORS[log.actionCategory] || 'bg-gray-600'} flex items-center justify-center flex-shrink-0`}>
                                        <span className="text-xl">
                                            {log.actionCategory === 'order' ? '🛒' :
                                                log.actionCategory === 'delivery' ? '🛵' :
                                                    log.actionCategory === 'carpet' ? '🧹' : '📋'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-medium">
                                                {ACTION_LABELS[log.action] || log.action}
                                            </span>
                                            <span className="text-gray-500 text-xs">
                                                {formatTimestamp(log.timestamp)}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-400 space-y-1">
                                            <p>
                                                <span className="text-gray-500">Kim:</span>{' '}
                                                <span className="text-white">{log.actorName}</span>
                                                {log.actorPhone && (
                                                    <span className="text-blue-400 ml-2">{log.actorPhone}</span>
                                                )}
                                                <span className="text-gray-600 ml-2">({log.actorType})</span>
                                            </p>

                                            {log.vendorName && (
                                                <p>
                                                    <span className="text-gray-500">İşletme:</span>{' '}
                                                    <span className="text-orange-400">{log.vendorName}</span>
                                                </p>
                                            )}

                                            {log.targetName && (
                                                <p>
                                                    <span className="text-gray-500">Hedef:</span>{' '}
                                                    <span className="text-green-400">{log.targetName}</span>
                                                </p>
                                            )}

                                            {log.location && (
                                                <p>
                                                    <span className="text-gray-500">📍 Konum:</span>{' '}
                                                    <a
                                                        href={`https://maps.google.com/?q=${log.location.latitude},${log.location.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:underline"
                                                    >
                                                        Haritada Gör
                                                    </a>
                                                </p>
                                            )}

                                            {log.details && Object.keys(log.details).length > 0 && (
                                                <details className="mt-2">
                                                    <summary className="text-gray-500 cursor-pointer hover:text-gray-300">
                                                        Detaylar
                                                    </summary>
                                                    <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                    </div>

                                    {/* Target ID */}
                                    <div className="text-right flex-shrink-0">
                                        <code className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                                            {log.targetId?.substring(0, 8)}...
                                        </code>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {logs.length >= limitCount && (
                <div className="mt-6 text-center">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        {loadingMore ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                                <span>Yükleniyor...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xl">⬇️</span>
                                <span>Daha Fazla Göster</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
