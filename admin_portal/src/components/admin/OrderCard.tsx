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
  {/* PrepZone Progress Badges */}
  {itemCount > 0 && (order.status === 'preparing' || order.status === 'accepted' || order.status === 'ready') && (
    <div className="flex items-center flex-wrap gap-1.5 mt-2 mb-2 pb-2 pt-1 border-t border-border/50">
      {(() => {
        const prepZoneGroups: Record<string, { total: number; checked: number }> = {};
        
        order.items?.forEach((item: any, idx) => {
          const isChecked = checked[idx] || false;
          const zones = Array.isArray(item.prepZone) 
            ? item.prepZone 
            : (item.prepZone ? [item.prepZone] : ['Standart']);
          
          if (zones.length === 0) zones.push('Standart');
          
          zones.forEach((z: string) => {
            const zoneStr = z || 'Standart';
            if (!prepZoneGroups[zoneStr]) {
              prepZoneGroups[zoneStr] = { total: 0, checked: 0 };
            }
            prepZoneGroups[zoneStr].total += 1;
            if (isChecked) {
              prepZoneGroups[zoneStr].checked += 1;
            }
          });
        });

        const numZones = Object.keys(prepZoneGroups).length;

        return Object.entries(prepZoneGroups).map(([zone, stats]) => {
          const isCompleted = stats.total > 0 && stats.checked >= stats.total;
          const badgeClass = isCompleted 
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50' 
            : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50';
          
          return (
            <span key={zone} title={zone} className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap shadow-sm ${badgeClass}`}>
               {numZones > 1 ? `${zone.substring(0, 10)}${zone.length > 10 ? '.' : ''}: ` : ''}✓{stats.checked}/{stats.total}
            </span>
          );
        });
      })()}
    </div>
  )}

  {/* Cancellation Details */}
  {order.status === 'cancelled' && (
    <div className="mt-2 pt-2 border-t border-red-200/50 dark:border-red-900/30 text-xs space-y-1.5 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-2">
      <div className="flex justify-between items-center text-muted-foreground">
        <span className="font-medium">{t('kanban.receivedAt', { defaultValue: 'Geliş:' })}</span>
        <span>{order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate() : new Date((order.createdAt as any))).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
      </div>
      {order._raw?.cancelledAt && (
        <div className="flex justify-between items-center text-red-600 dark:text-red-400">
          <span className="font-medium">{t('kanban.cancelledAt', { defaultValue: 'İptal Zamanı:' })}</span>
          <span>{(typeof order._raw.cancelledAt.toDate === 'function' ? order._raw.cancelledAt.toDate() : new Date(order._raw.cancelledAt)).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
      {order._raw?.cancelReason && (
        <div className="text-red-700 dark:text-red-300 font-medium bg-red-100 dark:bg-red-900/40 p-1.5 rounded text-[11px]">
          {t('kanban.cancelReason', { defaultValue: 'Sebep:' })} {order._raw.cancelReason}
        </div>
      )}
      {(order._raw?.cancelledByName || order._raw?.cancelledBy) && (
        <div className="text-muted-foreground flex justify-between items-center">
          <span className="font-medium">{t('kanban.cancelledBy', { defaultValue: 'Personel:' })}</span>
          <span>{order._raw.cancelledByName || order._raw.cancelledBy}</span>
        </div>
      )}
    </div>
  )}

  <div className="flex items-center justify-between mt-2">
  <span className="text-green-800 dark:text-green-400 font-bold">{globalFormatCurrency(order.total || 0, order.currency)}</span>
  <div className="flex items-center gap-2">
  <span className="text-muted-foreground text-xs">
  {order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate() : new Date((order.createdAt as any))).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : ''}
  </span>
  </div>
  </div>
 </button>
 );
}
