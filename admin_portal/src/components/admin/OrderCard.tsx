'use client';

import { Timestamp } from 'firebase/firestore';
import { useLocale } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';
import { ORDER_STATUSES, ORDER_TYPES, type Order } from '@/hooks/useOrders';

const orderStatuses = ORDER_STATUSES;
const orderTypes = ORDER_TYPES;

export type OrderStatus = keyof typeof orderStatuses;
export type OrderType = keyof typeof orderTypes;

export interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    unit?: string;
    options?: { name: string; selectedVariations: { name: string; priceAdjustment: number }[] }[];
    notes?: string;
}

// Order interface is now imported from useOrders.tsx
export default function OrderCard({
    order,
    businesses,
    checkedItems,
    onClick,
    t,
    isPreOrder = false,
}: {
    order: Order;
    businesses: Record<string, string>;
    checkedItems: Record<string, Record<number, boolean>>;
    onClick: () => void;
    t: any;
    isPreOrder?: boolean;
}) {
    const locale = useLocale();
    const dateLocale = locale === 'de' ? 'de-DE' : locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : locale === 'nl' ? 'nl-NL' : 'de-DE';
    const statusInfo = orderStatuses[order.status];
    const typeInfo = orderTypes[order.type];
    const itemCount = order.items?.length || 0;
    const checked = checkedItems[order.id] || {};
    const checkedCount = Object.values(checked).filter(Boolean).length;

    // Format scheduled time for pre-orders
    const formatScheduledTime = () => {
        if (!order.scheduledAt) return '';

        try {
            const d = typeof order.scheduledAt.toDate === 'function' ? order.scheduledAt.toDate() : new Date((order.scheduledAt as any));
            if (isNaN(d.getTime())) return '';

            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = d.toDateString() === tomorrow.toDateString();

            const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
            if (isToday) return `${t('today')} ${time}`;
            if (isTomorrow) return `${t('tomorrow')} ${time}`;
            return d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' }) + ` · ${time}`;
        } catch (e) {
            return '';
        }
    };

    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl p-3 transition ${isPreOrder
                ? 'bg-purple-900/20 hover:bg-purple-900/30 border-l-3 border-purple-500'
                : 'bg-gray-700 hover:bg-gray-600'
                }`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium text-sm">
                    #{order.orderNumber || order.id.slice(0, 6).toUpperCase()}
                </span>
                <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs bg-${typeInfo?.color || 'gray'}-600/30 text-${typeInfo?.color || 'gray'}-400`}>
                        {t(typeInfo?.labelKey || 'type_pickup')}
                    </span>
                </div>
            </div>
            <p className="text-muted-foreground text-xs mb-1">
                {businesses[order.businessId] || t('modal.business')}
            </p>
            {/* Pre-order scheduled time badge */}
            {isPreOrder && order.scheduledAt && (
                <div className="mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 text-xs font-medium">
                        🕐 {formatScheduledTime()}
                    </span>
                </div>
            )}
            {/* Dine-in table badge + source */}
            {order.type === 'dine_in' && (
                <div className="mb-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-xs font-medium">
                            🍽️ {t('kanban.table')} {order.tableNumber ? `#${order.tableNumber}` : ''}
                        </span>
                        {order.isGroupOrder && (
                            <span className="px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 text-xs font-medium">
                                👥 {t('kanban.group')}{order.groupParticipantCount ? ` (${order.groupParticipantCount} ${t('kanban.person')})` : ''}
                            </span>
                        )}
                        {order.paymentStatus === 'paid' && (
                            <span className="px-1.5 py-0.5 rounded bg-green-600/30 text-green-800 dark:text-green-400 text-xs">✓</span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs pl-0.5">
                        {order.waiterName ? `👤 ${order.waiterName}` : `📱 ${t('kanban.customerApp')}`}
                    </p>
                    {order.servedByName && (order.status === 'served' || order.status === 'delivered' || order.status === 'completed') && (
                        <p className="text-teal-400 text-xs pl-0.5">
                            🍽️ {order.servedByName} {t('kanban.servedBy')}
                        </p>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className="text-green-800 dark:text-green-400 font-bold">{globalFormatCurrency(order.total || 0, order.currency)}</span>
                <div className="flex items-center gap-2">
                    {itemCount > 0 && (order.status === 'preparing' || order.status === 'accepted') && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${checkedCount >= itemCount ? 'bg-green-600/30 text-green-800 dark:text-green-400' : 'bg-gray-600 text-muted-foreground'}`}>
                            ✓{checkedCount}/{itemCount}
                        </span>
                    )}
                    <span className="text-gray-500 text-xs">
                        {order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate() : new Date((order.createdAt as any))).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            </div>
        </button>
    );
}
