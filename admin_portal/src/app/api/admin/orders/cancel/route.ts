import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const { auth: adminAuth, db } = getFirebaseAdmin();

export async function POST(request: Request) {
    try {
        // Authenticate admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Verify admin role via Firestore since custom claims might not be consistently set
        const adminDoc = await db.collection('adminUsers').doc(decodedToken.uid).get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Admins only (No admin record)' }, { status: 403 });
        }

        const adminData = adminDoc.data();
        if (adminData?.role !== 'admin' && adminData?.role !== 'lokma_admin') {
            return NextResponse.json({ error: 'Admins only (Insufficient role)' }, { status: 403 });
        }

        const { orderId, cancelReason } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const orderRef = db.collection('meat_orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Update the order status and append cancellation details
        await orderRef.update({
            status: 'cancelled',
            cancelReason: cancelReason || 'Cancelled by System Admin',
            cancelledBy: decodedToken.uid,
            cancelledAt: new Date(),
            // We zero out the commission to prevent the business from being billed for this order
            commissionAmount: 0,
            perOrderFee: 0,
            totalCommission: 0,
            updatedAt: new Date(),
        });

        // Optionally, if the payment was made online (e.g. Stripe), we might trigger a refund here.
        // However, for resolving purely commission disputes, setting status to 'cancelled' is sufficient
        // as the billing logic filters out 'cancelled' orders.

        return NextResponse.json({ success: true, message: 'Order has been cancelled and commission revoked.' });

    } catch (error: any) {
        console.error('Admin Order Cancellation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
