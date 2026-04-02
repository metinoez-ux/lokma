import { Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { type Order } from '@/hooks/useOrders';

export function mapFirestoreOrder(doc: QueryDocumentSnapshot<DocumentData>): Order {
 const d = doc.data();
 return {
 id: doc.id,
 orderNumber: d.orderNumber || doc.id.slice(0, 6).toUpperCase(),
 businessId: d.businessId || d.butcherId || '',
 businessName: d.businessName || d.butcherName || '',
 customerId: d.userId || d.customerId || '',
 customerName: d.customerName || d.userDisplayName || d.userName || '',
 customerPhone: d.customerPhone || d.userPhone || '',
 items: d.items || [],
 subtotal: d.subtotal || d.totalPrice || d.totalAmount || 0,
 deliveryFee: d.deliveryFee || 0,
 total: d.totalPrice || d.totalAmount || d.total || 0,
 status: d.status || 'pending',
 type: (() => {
 const raw = d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup';
 if (raw === 'dineIn') return 'dine_in';
 return raw;
 })(),
 createdAt: d.createdAt,
 scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
 isScheduledOrder: !!d.isScheduledOrder,
 address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
 notes: d.notes || d.orderNote || d.customerNote || '',
 // Dine-in fields
 tableNumber: d.tableNumber,
 waiterName: d.waiterName,
 groupSessionId: d.groupSessionId,
 isGroupOrder: !!d.isGroupOrder,
 groupParticipantCount: d.groupParticipantCount,
 paymentStatus: d.paymentStatus,
 paymentMethod: d.paymentMethod,
 stripePaymentIntentId: d.stripePaymentIntentId,
 servedByName: d.servedByName,
 servedAt: d.servedAt,
 _raw: d,
 } as Order;
}
