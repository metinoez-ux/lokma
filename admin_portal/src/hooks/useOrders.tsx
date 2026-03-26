'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { collection, collectionGroup, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================================
// CANONICAL ORDER TYPE
// Single source of truth for order field mapping
// ============================================================

export interface Order {
  id: string;
  orderNumber: string;
  businessId: string;
  businessName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  type: string; // 'pickup' | 'delivery' | 'dine_in'
  createdAt: any;
  scheduledAt: any;
  isScheduledOrder: boolean;
  address: any;
  notes: string;
  tableNumber?: string;
  waiterName?: string;
  groupSessionId?: string;
  isGroupOrder: boolean;
  groupParticipantCount: number;
  paymentStatus: string;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  currency?: string;
  servedByName?: string;
  servedAt?: any;
  // Keep raw doc data accessible
  _raw: any;
}

// ============================================================
// CANONICAL FIELD MAPPING
// This is the SINGLE place where Firestore doc -> Order happens
// ============================================================

function mapDocToOrder(docId: string, d: any): Order {
  // Type normalization: Dart stores 'dineIn', admin expects 'dine_in'
  const rawType = d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup';
  const normalizedType = rawType === 'dineIn' ? 'dine_in' : rawType;

  return {
    id: docId,
    orderNumber: d.orderNumber || docId.slice(0, 6).toUpperCase(),
    // BusinessId: use businessId first, fallback to butcherId
    businessId: d.businessId || d.butcherId || '',
    businessName: d.businessName || d.butcherName || '',
    customerId: d.userId || d.customerId || '',
    customerName: d.customerName || d.userDisplayName || d.userName || '',
    customerPhone: d.customerPhone || d.userPhone || '',
    items: d.items || [],
    subtotal: d.subtotal || d.totalPrice || d.totalAmount || 0,
    deliveryFee: d.deliveryFee || 0,
    total: d.totalPrice || d.totalAmount || d.total || 0,
    // Status: use raw status, fallback to 'pending'
    status: d.status || 'pending',
    type: normalizedType,
    createdAt: d.createdAt,
    scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
    isScheduledOrder: !!d.isScheduledOrder,
    address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
    notes: d.notes || d.orderNote || d.customerNote || '',
    tableNumber: d.tableNumber,
    waiterName: d.waiterName,
    groupSessionId: d.groupSessionId,
    isGroupOrder: !!d.isGroupOrder,
    groupParticipantCount: d.groupParticipantCount || 0,
    paymentStatus: d.paymentStatus || 'unpaid',
    paymentMethod: d.paymentMethod,
    stripePaymentIntentId: d.stripePaymentIntentId,
    currency: d.currency,
    _raw: d,
  };
}

// ============================================================
// CONTINUOUS TAB RESERVATION MAPPING
// Normalizes active reservations into the Order interface
// ============================================================

export function mapReservationToOrder(docId: string, d: any): Order {
  // Map tabStatus to standard order status for Kanban rendering
  let status = 'pending';
  // If seated, we want kitchen to see it as preparing/ready to serve
  if (d.tabStatus === 'seated') status = 'preparing'; 
  else if (d.tabStatus === 'closed') status = 'completed';
  else if (d.tabStatus === 'pre_ordered') status = 'pending';
  else if (d.status === 'confirmed') status = 'accepted';
  else status = d.status || 'pending';

  return {
    id: docId,
    orderNumber: `R-${docId.slice(0, 5).toUpperCase()}`,
    businessId: d.businessId || '',
    businessName: d.businessName || '',
    customerId: d.userId || '',
    customerName: d.userName || '',
    customerPhone: d.userPhone || '',
    items: (d.tabItems || d.preOrderItems || []).map((item: any) => ({
      ...item,
      name: item.name || item.productName || item.product?.nameTr || item.product?.name || 'Masa Siparişi',
      price: item.price || item.product?.price || 0,
      productId: item.productId || item.product?.id || '',
    })), // The active continuous tab ledger
    subtotal: d.pendingBalance || d.preOrderTotal || 0,
    deliveryFee: 0,
    total: d.pendingBalance || d.preOrderTotal || 0,
    status: status,
    type: 'dine_in_preorder', 
    createdAt: d.createdAt || d.reservationDate,
    scheduledAt: d.reservationDate,
    isScheduledOrder: true,
    address: null,
    notes: d.notes || '',
    tableNumber: d.tableNumber,
    waiterName: '',
    groupSessionId: '',
    isGroupOrder: false,
    groupParticipantCount: d.partySize || 0,
    paymentStatus: (d.prePaidAmount && d.pendingBalance && d.prePaidAmount >= d.pendingBalance) ? 'paid' : 'unpaid',
    _raw: d,
  };
}

// ============================================================
// DATE FILTER HELPER
// ============================================================

export type DateFilter = 'today' | 'week' | 'month' | 'all';

function getStartDateForFilter(filter: DateFilter): Date {
  if (filter === 'all') return new Date(2020, 0, 1);
  
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  
  if (filter === 'week') date.setDate(date.getDate() - 7);
  else if (filter === 'month') date.setDate(date.getDate() - 30);
  // 'today' = start of today, already set
  
  return date;
}

// ============================================================
// ORDER STATUS CONSTANTS
// labelKey = i18n key, use t(labelKey) in consumer components
// ============================================================

export type OrderStatus = keyof typeof ORDER_STATUSES;

export const ORDER_STATUSES: Record<string, { labelKey: string; color: string }> = {
  pending:   { labelKey: 'status_pending',    color: 'yellow' },
  accepted:  { labelKey: 'status_accepted',   color: 'blue' },
  preparing: { labelKey: 'status_preparing',  color: 'amber' },
  ready:     { labelKey: 'status_ready',      color: 'green' },
  served:    { labelKey: 'status_served',     color: 'teal' },
  onTheWay:  { labelKey: 'status_onTheWay',   color: 'indigo' },
  delivered: { labelKey: 'status_delivered',  color: 'emerald' },
  completed: { labelKey: 'status_completed',  color: 'emerald' },
  cancelled: { labelKey: 'status_cancelled',  color: 'red' },
};

export const ORDER_TYPES: Record<string, { labelKey: string; color: string }> = {
  pickup:   { labelKey: 'type_pickup',    color: 'green' },
  delivery: { labelKey: 'type_delivery',  color: 'blue' },
  dine_in:  { labelKey: 'type_dineIn',    color: 'amber' },
  dine_in_preorder: { labelKey: 'type_dineInPreorder', color: 'purple' },
};

// ============================================================
// ORDERS CONTEXT - Shared state across components
// ============================================================

interface OrdersContextValue {
  /** All orders from Firestore for current date range and business */
  orders: Order[];
  /** Loading state */
  loading: boolean;
  /** Date filter - controls Firestore query range */
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  /** Status filter - client-side filtering */
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  /** Type filter - client-side filtering */
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  /** Business filter - for super admin to filter by business */
  businessFilter: string;
  setBusinessFilter: (b: string) => void;
  /** Orders after applying status/type/business filters */
  filteredOrders: Order[];
  /** Quick stats from filteredOrders */
  stats: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    onTheWay: number;
    completed: number;
    cancelled: number;
    revenue: number;
  };
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

// ============================================================
// ORDERS PROVIDER
// ============================================================

interface OrdersProviderProps {
  children: ReactNode;
  /** If provided, only show orders for this business (partner view) */
  businessId?: string | null;
  /** Initial date filter, default 'all' */
  initialDateFilter?: DateFilter;
}

export function OrdersProvider({ 
  children, 
  businessId: fixedBusinessId,
  initialDateFilter = 'all',
}: OrdersProviderProps) {
  const [meatOrders, setMeatOrders] = useState<Order[]>([]);
  const [resOrders, setResOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [businessFilter, setBusinessFilter] = useState('all');

  const orders = useMemo(() => {
    return [...meatOrders, ...resOrders].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  }, [meatOrders, resOrders]);

  // Dual Firestore listeners
  useEffect(() => {
    setLoading(true);
    
    const startDate = getStartDateForFilter(dateFilter);
    
    // 1. Standard Orders Stream
    const constraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    ];
    if (fixedBusinessId) {
      constraints.unshift(where('businessId', '==', fixedBusinessId));
    }
    const qOrders = query(collection(db, 'meat_orders'), ...constraints);

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      let mapped = snapshot.docs.map(doc => mapDocToOrder(doc.id, doc.data()));
      // Secondary fallback filter for legacy butcherId documents that bypassed query
      if (fixedBusinessId) {
        mapped = mapped.filter(o => 
          o.businessId === fixedBusinessId || o._raw.butcherId === fixedBusinessId
        );
      }
      setMeatOrders(mapped);
      setLoading(false);
    }, (error) => {
      console.error('[useOrders] Error loading orders:', error);
      setLoading(false);
    });

    // 2. Continuous Tab Reservations Stream
    const resConstraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    ];
    if (fixedBusinessId) {
      resConstraints.unshift(where('businessId', '==', fixedBusinessId));
    }
    const qReservations = query(collectionGroup(db, 'reservations'), ...resConstraints);

    const unsubReservations = onSnapshot(qReservations, (snapshot) => {
      // Include pre-order/tab reservations AND plain pending/confirmed reservations
      const relevantDocs = snapshot.docs.filter(d => {
        const data = d.data();
        if (data.tabStatus === 'pre_ordered' || data.tabStatus === 'seated' || data.tabStatus === 'closed') return true;
        if (!data.tabStatus && (data.status === 'pending' || data.status === 'confirmed')) return true;
        return false;
      });

      let mapped = relevantDocs.map(doc => mapReservationToOrder(doc.id, doc.data()));
      
      // Keep safety filter
      if (fixedBusinessId) {
        mapped = mapped.filter(o => o.businessId === fixedBusinessId);
      }
      setResOrders(mapped);
    }, (error) => {
      console.error('[useOrders] Error loading reservations:', error);
    });

    return () => {
      unsubOrders();
      unsubReservations();
    };
  }, [dateFilter, fixedBusinessId]);

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (typeFilter !== 'all' && order.type !== typeFilter) return false;
      if (businessFilter !== 'all' && order.businessId !== businessFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter, businessFilter]);

  // Stats from filtered orders
  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status)).length,
    preparing: filteredOrders.filter(o => o.status === 'preparing').length,
    ready: filteredOrders.filter(o => o.status === 'ready').length,
    onTheWay: filteredOrders.filter(o => o.status === 'onTheWay').length,
    completed: filteredOrders.filter(o => ['delivered', 'served'].includes(o.status)).length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    revenue: filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }), [filteredOrders]);

  const value = useMemo<OrdersContextValue>(() => ({
    orders,
    loading,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    businessFilter,
    setBusinessFilter,
    filteredOrders,
    stats,
  }), [orders, loading, dateFilter, statusFilter, typeFilter, businessFilter, filteredOrders, stats]);

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  );
}

// ============================================================
// useOrders HOOK
// ============================================================

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return ctx;
}

// ============================================================
// STANDALONE useOrders (no provider required)
// For pages that don't share state with other components
// ============================================================

export interface UseOrdersStandaloneOptions {
  businessId?: string | null;
  initialDateFilter?: DateFilter;
}

export function useOrdersStandalone(options: UseOrdersStandaloneOptions = {}) {
  const { businessId, initialDateFilter = 'all' } = options;
  const [meatOrders, setMeatOrders] = useState<Order[]>([]);
  const [resOrders, setResOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const orders = useMemo(() => {
    return [...meatOrders, ...resOrders].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  }, [meatOrders, resOrders]);

  useEffect(() => {
    setLoading(true);
    const startDate = getStartDateForFilter(dateFilter);
    
    // 1. Orders
    const constraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    ];
    if (businessId) {
      constraints.unshift(where('businessId', '==', businessId));
    }
    const qOrders = query(collection(db, 'meat_orders'), ...constraints);

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      let mapped = snapshot.docs.map(doc => mapDocToOrder(doc.id, doc.data()));
      if (businessId) {
        mapped = mapped.filter(o => o.businessId === businessId || o._raw.butcherId === businessId);
      }
      setMeatOrders(mapped);
      setLoading(false);
    }, (error) => {
      console.error('[useOrdersStandalone] Error:', error);
      setLoading(false);
    });

    // 2. Reservations
    const resConstraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    ];
    if (businessId) {
      resConstraints.unshift(where('businessId', '==', businessId));
    }
    const qReservations = query(collectionGroup(db, 'reservations'), ...resConstraints);

    const unsubReservations = onSnapshot(qReservations, (snapshot) => {
      // Include pre-order/tab reservations AND plain pending/confirmed reservations
      const relevantDocs = snapshot.docs.filter(d => {
        const data = d.data();
        if (data.tabStatus === 'pre_ordered' || data.tabStatus === 'seated' || data.tabStatus === 'closed') return true;
        if (!data.tabStatus && (data.status === 'pending' || data.status === 'confirmed')) return true;
        return false;
      });

      let mapped = relevantDocs.map(doc => mapReservationToOrder(doc.id, doc.data()));
      if (businessId) {
        mapped = mapped.filter(o => o.businessId === businessId);
      }
      setResOrders(mapped);
    }, (error) => {
      console.error('[useOrdersStandalone] Error loading reservations:', error);
    });

    return () => {
      unsubOrders();
      unsubReservations();
    };
  }, [dateFilter, businessId]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (typeFilter !== 'all' && order.type !== typeFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status)).length,
    preparing: filteredOrders.filter(o => o.status === 'preparing').length,
    ready: filteredOrders.filter(o => o.status === 'ready').length,
    onTheWay: filteredOrders.filter(o => o.status === 'onTheWay').length,
    completed: filteredOrders.filter(o => ['delivered', 'served'].includes(o.status)).length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    revenue: filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }), [filteredOrders]);

  return {
    orders,
    loading,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    filteredOrders,
    stats,
  };
}
