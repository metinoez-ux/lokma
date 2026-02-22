import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim() || '';
        const dateFilter = searchParams.get('dateFilter') || 'all';

        if (query.length < 2 && dateFilter === 'all') {
            return NextResponse.json({ users: [], orders: [] });
        }

        const { db } = getFirebaseAdmin();
        const lowerQuery = query.toLowerCase();
        const isEmail = query.includes('@');
        const isPhone = /^[+\d][\d\s-]{4,15}$/.test(query);
        const isLikelyOrderId = /^[A-Z0-9]{5,8}$/i.test(query) && !/^\d{5}$/.test(query);

        let users = [];
        let orders = [];

        // Date Filtering Logic
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        const now = new Date();

        if (dateFilter !== 'all') {
            if (dateFilter === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
            } else if (dateFilter === 'yesterday') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
            } else if (dateFilter === 'last7days') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                endDate = now;
            } else if (dateFilter === 'thisMonth') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            } else if (dateFilter === 'thisYear') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear() + 1, 0, 1);
            } else if (/^\d{4}$/.test(dateFilter)) { // Specific year like 2026
                const year = parseInt(dateFilter);
                startDate = new Date(year, 0, 1);
                endDate = new Date(year + 1, 0, 1);
            }
        }

        // 1. Search Users
        const userPromises = [];

        if (query.length >= 2) {
            if (isEmail) {
                userPromises.push(db.collection('users').where('email', '==', lowerQuery).limit(5).get());
                userPromises.push(db.collection('users').where('email', '==', query).limit(5).get());
            }

            if (isPhone) {
                let phoneQuery = query.replace(/[^\d+]/g, '');
                userPromises.push(db.collection('users').where('phoneNumber', '==', phoneQuery).limit(5).get());
                if (phoneQuery.startsWith('0')) {
                    const international = '+49' + phoneQuery.substring(1);
                    userPromises.push(db.collection('users').where('phoneNumber', '==', international).limit(5).get());
                } else if (phoneQuery.startsWith('+49')) {
                    const local = '0' + phoneQuery.substring(3);
                    userPromises.push(db.collection('users').where('phoneNumber', '==', local).limit(5).get());
                } else {
                    const deCode = '+49' + phoneQuery;
                    userPromises.push(db.collection('users').where('phoneNumber', '==', deCode).limit(5).get());
                }
            }

            // Text search for users
            if (!isEmail) {
                const titleCased = query.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                const upperCased = query.toUpperCase();

                // Name Search (First Name / Full Name)
                userPromises.push(db.collection('users').where('displayName', '>=', titleCased).where('displayName', '<=', titleCased + '\uf8ff').limit(10).get());
                userPromises.push(db.collection('users').where('displayName', '>=', lowerQuery).where('displayName', '<=', lowerQuery + '\uf8ff').limit(10).get());

                // Last Name Search (Soyisim)
                userPromises.push(db.collection('users').where('lastName', '>=', titleCased).where('lastName', '<=', titleCased + '\uf8ff').limit(10).get());
                userPromises.push(db.collection('users').where('lastName', '>=', lowerQuery).where('lastName', '<=', lowerQuery + '\uf8ff').limit(10).get());

                // City Search for Users (Şehir)
                if (query.length >= 3 && !/^\d+$/.test(query)) {
                    userPromises.push(db.collection('users').where('address.city', '>=', titleCased).where('address.city', '<=', titleCased + '\uf8ff').limit(5).get());
                    userPromises.push(db.collection('users').where('city', '>=', titleCased).where('city', '<=', titleCased + '\uf8ff').limit(5).get());
                }
            }
        }

        // 2. Search Orders (meat_orders)
        const orderPromises = [];

        let orderRef: any = db.collection('meat_orders');

        // If there is NO query but a dateFilter, DO NOT search by specific fields, just fetch recent orders in date range
        if (query.length < 2) {
            if (startDate && endDate) {
                orderPromises.push(
                    db.collection('meat_orders')
                        .where('createdAt', '>=', startDate)
                        .where('createdAt', '<', endDate)
                        .orderBy('createdAt', 'desc')
                        .limit(50)
                        .get()
                );
            } else {
                // Fallback if DateFilter = all and query is empty (should be caught above, but just in case)
                orderPromises.push(db.collection('meat_orders').orderBy('createdAt', 'desc').limit(20).get());
            }
        } else {
            // Apply Date Filters to specific queries if possible, but Firestore limits inequality filters to ONE field.
            // Since we use inequalities for text search (>=, <=), we CANNOT also use inequality for createdAt in the same query.
            // So we will fetch items based on text search, and filter dates later in memory if both exist.

            if (isLikelyOrderId) {
                const upperQuery = query.toUpperCase();
                orderPromises.push(db.collection('meat_orders').doc(upperQuery).get().then(doc => ({ docs: doc.exists ? [doc] : [] })));
                orderPromises.push(db.collection('meat_orders').where('orderNumber', '==', upperQuery).limit(5).get());
            }

            if (isPhone) {
                let phoneQuery = query.replace(/[^\d+]/g, '');
                orderPromises.push(db.collection('meat_orders').where('customerPhone', '==', phoneQuery).limit(10).get());
                orderPromises.push(db.collection('meat_orders').where('userPhone', '==', phoneQuery).limit(10).get());
                if (phoneQuery.startsWith('0')) {
                    const international = '+49' + phoneQuery.substring(1);
                    orderPromises.push(db.collection('meat_orders').where('customerPhone', '==', international).limit(5).get());
                } else if (phoneQuery.startsWith('+49')) {
                    const local = '0' + phoneQuery.substring(3);
                    orderPromises.push(db.collection('meat_orders').where('customerPhone', '==', local).limit(5).get());
                }
            }

            if (!isEmail && !isLikelyOrderId) {
                const titleCased = query.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                orderPromises.push(
                    db.collection('meat_orders')
                        .where('customerName', '>=', titleCased)
                        .where('customerName', '<=', titleCased + '\uf8ff')
                        .limit(10)
                        .get()
                );

                if (/^\d{5}$/.test(query)) {
                    // Query orders by postal code object
                    orderPromises.push(
                        db.collection('meat_orders')
                            .where('deliveryAddress.postalCode', '==', query)
                            .limit(10)
                            .get()
                    );
                    // Query users by address object
                    userPromises.push(
                        db.collection('users')
                            .where('address.postalCode', '==', query)
                            .limit(10)
                            .get()
                    );
                    // Query users by root attribute
                    userPromises.push(
                        db.collection('users')
                            .where('postalCode', '==', query)
                            .limit(10)
                            .get()
                    );
                } else {
                    orderPromises.push(
                        db.collection('meat_orders')
                            .where('deliveryAddress.city', '>=', titleCased)
                            .where('deliveryAddress.city', '<=', titleCased + '\uf8ff')
                            .limit(10)
                            .get()
                    );
                }
            }
        }

        // Await all and map
        const [userSnaps, orderSnaps] = await Promise.all([
            Promise.all(userPromises),
            Promise.all(orderPromises)
        ]);

        const uniqueUsers = new Map();
        userSnaps.forEach((snap: any) => {
            if (!snap || !snap.docs) return;
            snap.docs.forEach((doc: any) => {
                const data = doc.data();
                // Simple sanitize to omit sensitive raw backend data if needed
                uniqueUsers.set(doc.id, {
                    id: doc.id,
                    displayName: data.displayName || '',
                    email: data.email || '',
                    phoneNumber: data.phoneNumber || '',
                    photoURL: data.photoURL || '',
                    createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : (data.createdAt || null),
                    role: data.role || 'user',
                    fcmToken: !!data.fcmToken, // Just a boolean indicator
                    appLanguage: data.appLanguage || 'tr',
                    status: data.status || 'active',
                    recentOrders: []
                });
            });
        });

        // For each unique user, fetch their 5 most recent orders
        const recentOrderPromises: Promise<any>[] = [];
        Array.from(uniqueUsers.keys()).forEach(userId => {
            recentOrderPromises.push(
                db.collection('meat_orders')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(5)
                    .get()
                    .then(snap => ({ userId, docs: snap.docs }))
            );
        });

        try {
            const recentOrdersResults = await Promise.all(recentOrderPromises);
            recentOrdersResults.forEach((result: any) => {
                const user = uniqueUsers.get(result.userId);
                if (user && result.docs && result.docs.length > 0) {
                    user.recentOrders = result.docs.map((doc: any) => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            orderNumber: data.orderNumber || doc.id.substring(0, 6).toUpperCase(),
                            totalPrice: data.totalPrice || data.totalAmount || data.total || 0,
                            status: data.status || 'pending',
                            type: data.orderType || data.deliveryMethod || data.deliveryType || 'pickup',
                            createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : (data.createdAt || null),
                            businessName: data.businessName || data.butcherName || '',
                        };
                    });
                }
            });
        } catch (error) {
            console.error('Error fetching recent orders for users:', error);
            // Optionally proceed without recent orders rather than failing the search
        }

        const uniqueOrders = new Map();
        orderSnaps.forEach((snap: any) => {
            if (!snap || !snap.docs) return;
            snap.docs.forEach((doc: any) => {
                const data = doc.data();
                const orderCreatedAt = typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : (data.createdAt || null);

                // IF we have a dateFilter AND a query, we need to manually filter orders here
                if (query.length >= 2 && startDate && endDate) {
                    if (!orderCreatedAt) return; // Cannot match date
                    if (orderCreatedAt < startDate || orderCreatedAt >= endDate) {
                        return; // Outside date range
                    }
                }

                uniqueOrders.set(doc.id, {
                    id: doc.id,
                    orderNumber: data.orderNumber || doc.id.substring(0, 6).toUpperCase(),
                    totalPrice: data.totalPrice || data.totalAmount || data.total || 0,
                    status: data.status || 'pending',
                    type: data.orderType || data.deliveryMethod || data.deliveryType || 'pickup',
                    createdAt: orderCreatedAt,
                    customerName: data.customerName || data.userDisplayName || '',
                    customerPhone: data.customerPhone || data.userPhone || '',
                    address: data.deliveryAddress || data.address || null,
                    businessName: data.businessName || data.butcherName || '',
                    items: data.items || [],
                });
            });
        });

        return NextResponse.json({
            users: Array.from(uniqueUsers.values()),
            orders: Array.from(uniqueOrders.values()).sort((a: any, b: any) => {
                // Sort orders by createdAt desc locally (since we merged multiple queries)
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.getTime() - a.createdAt.getTime();
            })
        });

    } catch (error: any) {
        console.error('Customer Service Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
