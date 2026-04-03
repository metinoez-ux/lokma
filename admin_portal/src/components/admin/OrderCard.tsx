'use client';

import { Timestamp } from 'firebase/firestore';
import { useLocale, useTranslations } from 'next-intl';
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

const TYPE_COLOR_CLASSES: Record<string, string> = {
 green: 'bg-green-100 dark:bg-green-600/30 text-green-700 dark:text-green-400',
 blue: 'bg-blue-100 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400',
 amber: 'bg-amber-100 dark:bg-amber-600/30 text-amber-700 dark:text-amber-400',
 purple: 'bg-purple-100 dark:bg-purple-600/30 text-purple-700 dark:text-purple-400',
 gray: 'bg-muted dark:bg-gray-600/30 text-foreground/80 dark:text-gray-400',
};

// Order interface is now imported from useOrders.tsx
export default function OrderCard({
 order,
 businesses,
 checkedItems,
 onClick,
 t: _parentT,
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
 const t = useTranslations('AdminPortal.Orders');
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
 className={`w-full text-left rounded-xl p-3 transition ${isPreOrder || order.type === 'dine_in_preorder'
 ? 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border-l-4 border-purple-500 shadow-sm'
 : 'bg-card hover:bg-muted border border-border text-foreground shadow-sm'
 }`}
 >
 <div className="flex items-center justify-between mb-2">
 <span className="text-foreground font-medium text-sm">
 #{order.orderNumber || order.id.slice(0, 6).toUpperCase()}
 </span>
 <div className="flex items-center gap-1">
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLOR_CLASSES[typeInfo?.color || 'gray'] || TYPE_COLOR_CLASSES['gray']}`}>
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
 <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
 🕐 {formatScheduledTime()}
 </span>
 </div>
 )}
 {/* Dine-in table badge + source */}
 {(order.type === 'dine_in' || order.type === 'dine_in_preorder') && (
 <div className="mb-1 space-y-0.5">
 <div className="flex items-center gap-2 flex-wrap">
 {order.type === 'dine_in_preorder' ? (
 <div className="flex items-center gap-2">
 <span className="px-2 py-0.5 rounded bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 text-sm font-bold border border-fuchsia-200 dark:border-fuchsia-800/50 shadow-sm">
 {order.tableNumber ? `🍽️ ${t('kanban.table', { defaultValue: 'Masa'})} #${order.tableNumber}` : `🗓️ ${t('kanban.tableWaiting', { defaultValue: 'Masa Bekleniyor'})}`}
 </span>
 {order._raw?.tabStatus === 'seated' && (
 <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs font-black tracking-wide border border-red-300 dark:border-red-700 shadow-sm flex items-center gap-1.5 animate-pulse">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
 </span>
 {t('kanban.customerArrived', { defaultValue: 'MÜŞTERİ GELDİ' })}
 </span>
 )}
 </div>
 ) : (
 <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
 🍽️ {t('kanban.table')} {order.tableNumber ? `#${order.tableNumber}` : ''}
 </span>
 )}
 {order.isGroupOrder && (
 <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
 👥 {t('kanban.group')}{order.groupParticipantCount ? ` (${order.groupParticipantCount} ${t('kanban.person')})` : ''}
 </span>
 )}
 {order.paymentStatus === 'paid' && (
 <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">✓</span>
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
 <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${checkedCount >= itemCount ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
 ✓{checkedCount}/{itemCount}
 </span>
 )}
 <span className="text-muted-foreground text-xs">
 {order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate() : new Date((order.createdAt as any))).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : ''}
 </span>
 </div>
 </div>
 </button>
 );
}
