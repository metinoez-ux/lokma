import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

function getPhoneVariations(query: string): string[] {
    const variations = new Set<string>();
    const phoneQuery = query.replace(/[^\d+]/g, '');
    if (!phoneQuery) return [];

    variations.add(phoneQuery);

    if (phoneQuery.startsWith('00')) {
        variations.add('+' + phoneQuery.substring(2));
    } else if (phoneQuery.startsWith('0')) {
        variations.add('+49' + phoneQuery.substring(1));
    } else if (phoneQuery.startsWith('49') && phoneQuery.length > 8) {
        variations.add('+' + phoneQuery);
        variations.add('00' + phoneQuery);
        variations.add('0' + phoneQuery.substring(2));
    } else if (phoneQuery.startsWith('+')) {
        variations.add('00' + phoneQuery.substring(1));
        if (phoneQuery.startsWith('+49')) {
            variations.add('0' + phoneQuery.substring(3));
            variations.add(phoneQuery.substring(1));
        }
    }
    return Array.from(variations);
}

function getTextVariations(text: string): { titleCased: string[], lowerCased: string[] } {
    const baseTitle = text.toLowerCase().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const baseLower = text.toLowerCase();

    const variationsTitle = new Set<string>();
    const variationsLower = new Set<string>();

    variationsTitle.add(baseTitle);
    variationsLower.add(baseLower);

    const charMapLower: Record<string, string> = { 's': 'ş', 'c': 'ç', 'o': 'ö', 'u': 'ü', 'g': 'ğ', 'i': 'ı', 'e': 'é' };
    const charMapUpper: Record<string, string> = { 'S': 'Ş', 'C': 'Ç', 'O': 'Ö', 'U': 'Ü', 'G': 'Ğ', 'I': 'İ', 'E': 'É' };

    let mappedLower = '';
    let mappedTitle = '';
    for (let i = 0; i < text.length; i++) {
        mappedLower += charMapLower[baseLower[i]] || baseLower[i];
        mappedTitle += charMapUpper[baseTitle[i]] || charMapLower[baseTitle[i]] || baseTitle[i];
    }

    if (mappedTitle !== baseTitle) variationsTitle.add(mappedTitle);
    if (mappedLower !== baseLower) variationsLower.add(mappedLower);

    if (baseTitle.length > 0 && charMapUpper[baseTitle.charAt(0)]) {
        variationsTitle.add(charMapUpper[baseTitle.charAt(0)] + baseTitle.slice(1));
    }
    if (baseLower.length > 0 && charMapLower[baseLower.charAt(0)]) {
        variationsLower.add(charMapLower[baseLower.charAt(0)] + baseLower.slice(1));
    }
    return { titleCased: Array.from(variationsTitle), lowerCased: Array.from(variationsLower) };
}

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
        let businesses = [];

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
                const phoneVars = getPhoneVariations(query);
                phoneVars.forEach(v => {
                    userPromises.push(db.collection('users').where('phoneNumber', '==', v).limit(5).get());
                });
            }

            // Text search for users
            if (!isEmail) {
                const { titleCased: titles, lowerCased: lowers } = getTextVariations(query);

                titles.forEach(tc => {
                    userPromises.push(db.collection('users').where('displayName', '>=', tc).where('displayName', '<=', tc + '\uf8ff').limit(10).get());
                    userPromises.push(db.collection('users').where('lastName', '>=', tc).where('lastName', '<=', tc + '\uf8ff').limit(10).get());
                    if (query.length >= 3 && !/^\d+$/.test(query)) {
                        userPromises.push(db.collection('users').where('address.city', '>=', tc).where('address.city', '<=', tc + '\uf8ff').limit(5).get());
                        userPromises.push(db.collection('users').where('city', '>=', tc).where('city', '<=', tc + '\uf8ff').limit(5).get());
                    }
                });

                lowers.forEach(lc => {
                    userPromises.push(db.collection('users').where('displayName', '>=', lc).where('displayName', '<=', lc + '\uf8ff').limit(10).get());
                    userPromises.push(db.collection('users').where('lastName', '>=', lc).where('lastName', '<=', lc + '\uf8ff').limit(10).get());
                });
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
                const phoneVars = getPhoneVariations(query);
                phoneVars.forEach(v => {
                    orderPromises.push(db.collection('meat_orders').where('customerPhone', '==', v).limit(10).get());
                    orderPromises.push(db.collection('meat_orders').where('userPhone', '==', v).limit(10).get());
                });
            }

            if (!isEmail && !isLikelyOrderId) {
                const { titleCased: titles } = getTextVariations(query);

                titles.forEach(tc => {
                    orderPromises.push(
                        db.collection('meat_orders')
                            .where('customerName', '>=', tc)
                            .where('customerName', '<=', tc + '\uf8ff')
                            .limit(10)
                            .get()
                    );
                });

                if (/^\d{5}$/.test(query)) {
                    // Query orders by postal code object
                    orderPromises.push(db.collection('meat_orders').where('deliveryAddress.postalCode', '==', query).limit(10).get());
                    orderPromises.push(db.collection('meat_orders').where('address.postalCode', '==', query).limit(10).get());

                    // Query users by address object
                    userPromises.push(db.collection('users').where('address.postalCode', '==', query).limit(10).get());
                    // Query users by root attribute
                    userPromises.push(db.collection('users').where('postalCode', '==', query).limit(10).get());
                } else if (query.length >= 3 && !/^\d+$/.test(query)) {
                    titles.forEach(tc => {
                        // City search
                        orderPromises.push(db.collection('meat_orders').where('deliveryAddress.city', '>=', tc).where('deliveryAddress.city', '<=', tc + '\uf8ff').limit(10).get());
                        orderPromises.push(db.collection('meat_orders').where('address.city', '>=', tc).where('address.city', '<=', tc + '\uf8ff').limit(10).get());

                        // Street search
                        orderPromises.push(db.collection('meat_orders').where('deliveryAddress.street', '>=', tc).where('deliveryAddress.street', '<=', tc + '\uf8ff').limit(10).get());
                        orderPromises.push(db.collection('meat_orders').where('address.street', '>=', tc).where('address.street', '<=', tc + '\uf8ff').limit(10).get());
                    });
                }
            }
        }

        // 3. Search Businesses
        const businessPromises = [];

        if (query.length >= 2) {
            if (isEmail) {
                businessPromises.push(db.collection('businesses').where('shopEmail', '==', lowerQuery).limit(5).get());
                businessPromises.push(db.collection('businesses').where('contactPerson.email', '==', lowerQuery).limit(5).get());
            }

            if (isPhone) {
                const phoneVars = getPhoneVariations(query);
                phoneVars.forEach(v => {
                    businessPromises.push(db.collection('businesses').where('shopPhone', '==', v).limit(5).get());
                    businessPromises.push(db.collection('businesses').where('contactPerson.phone', '==', v).limit(5).get());
                });
            }

            if (!isEmail) {
                const zipMatch = query.match(/\b\d{5}\b/);
                const textPart = query.replace(/\b\d{5}\b/, '').trim();

                if (zipMatch && textPart.length >= 2) {
                    // Query has both postal code and text (e.g., "don 41836")
                    const zipCode = zipMatch[0];
                    const textLower = textPart.toLowerCase();

                    // Fetch by postal code and filter by text in-memory to avoid composite index requirement
                    businessPromises.push(
                        db.collection('businesses')
                            .where('address.postalCode', '==', zipCode)
                            .limit(50)
                            .get()
                            .then((snap: any) => {
                                const filteredDocs = snap.docs.filter((doc: any) => {
                                    const data = doc.data();
                                    const name = (data.companyName || '').toLowerCase();
                                    return name.includes(textLower);
                                });
                                return { docs: filteredDocs };
                            })
                    );
                } else {
                    // Standard text search
                    const { titleCased: titles, lowerCased: lowers } = getTextVariations(query);

                    titles.forEach(tc => {
                        businessPromises.push(db.collection('businesses').where('companyName', '>=', tc).where('companyName', '<=', tc + '\uf8ff').limit(10).get());
                    });

                    lowers.forEach(lc => {
                        businessPromises.push(db.collection('businesses').where('companyName', '>=', lc).where('companyName', '<=', lc + '\uf8ff').limit(10).get());
                    });

                    if (/^\d{5}$/.test(query)) {
                        businessPromises.push(db.collection('businesses').where('address.postalCode', '==', query).limit(10).get());
                    } else if (query.length >= 3 && !/^\d+$/.test(query)) {
                        titles.forEach(tc => {
                            businessPromises.push(db.collection('businesses').where('address.city', '>=', tc).where('address.city', '<=', tc + '\uf8ff').limit(10).get());
                        });
                    }
                }
            }
        }

        // Await all and map
        const [userSnaps, orderSnaps, businessSnaps] = await Promise.all([
            Promise.all(userPromises),
            Promise.all(orderPromises),
            Promise.all(businessPromises)
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
                    adminType: data.adminType || null,
                    isVirtualKermesUser: !!data.isVirtualKermesUser,
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
                        const orderData = { ...data, id: doc.id };

                        // Hydrate chronological timestamps from statusHistory if missing from root
                        if (orderData.statusHistory) {
                            orderData.acceptedAt = orderData.acceptedAt || orderData.statusHistory.accepted;
                            orderData.preparingAt = orderData.preparingAt || orderData.statusHistory.preparing;
                            orderData.readyAt = orderData.readyAt || orderData.statusHistory.ready;
                            orderData.assignedAt = orderData.assignedAt || orderData.statusHistory.assigned || orderData.statusHistory.in_transit;
                            orderData.pickedUpAt = orderData.pickedUpAt || orderData.statusHistory.picked_up;
                            orderData.deliveredAt = orderData.deliveredAt || orderData.statusHistory.delivered || orderData.statusHistory.served || orderData.servedAt;
                        }

                        const dateFields = ['createdAt', 'acceptedAt', 'preparingAt', 'readyAt', 'assignedAt', 'pickedUpAt', 'deliveredAt'];
                        dateFields.forEach(field => {
                            if (orderData[field]) {
                                if (typeof orderData[field].toDate === 'function') {
                                    orderData[field] = orderData[field].toDate();
                                } else {
                                    const parsed = new Date(orderData[field]);
                                    if (!isNaN(parsed.getTime())) {
                                        orderData[field] = parsed;
                                    }
                                }
                            }
                        });

                        return {
                            ...orderData,
                            orderNumber: data.orderNumber || doc.id.substring(0, 6).toUpperCase(),
                            totalPrice: data.totalPrice || data.totalAmount || data.total || 0,
                            status: data.status || 'pending',
                            type: data.orderType || data.deliveryMethod || data.deliveryType || 'pickup',
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
                const orderData = { ...data, id: doc.id };

                // Hydrate chronological timestamps from statusHistory if missing from root
                if (orderData.statusHistory) {
                    orderData.acceptedAt = orderData.acceptedAt || orderData.statusHistory.accepted;
                    orderData.preparingAt = orderData.preparingAt || orderData.statusHistory.preparing;
                    orderData.readyAt = orderData.readyAt || orderData.statusHistory.ready;
                    orderData.assignedAt = orderData.assignedAt || orderData.statusHistory.assigned || orderData.statusHistory.in_transit;
                    orderData.pickedUpAt = orderData.pickedUpAt || orderData.statusHistory.picked_up;
                    orderData.deliveredAt = orderData.deliveredAt || orderData.statusHistory.delivered || orderData.statusHistory.served || orderData.servedAt;
                }

                const dateFields = ['createdAt', 'acceptedAt', 'preparingAt', 'readyAt', 'assignedAt', 'pickedUpAt', 'deliveredAt'];
                dateFields.forEach(field => {
                    if (orderData[field]) {
                        if (typeof orderData[field].toDate === 'function') {
                            orderData[field] = orderData[field].toDate();
                        } else {
                            const parsed = new Date(orderData[field]);
                            if (!isNaN(parsed.getTime())) {
                                orderData[field] = parsed;
                            }
                        }
                    }
                });

                // IF we have a dateFilter AND a query, we need to manually filter orders here
                if (query.length >= 2 && startDate && endDate) {
                    if (!orderData.createdAt) return; // Cannot match date
                    if (orderData.createdAt.getTime() < startDate.getTime() || orderData.createdAt.getTime() >= endDate.getTime()) {
                        return; // Outside date range
                    }
                }

                uniqueOrders.set(doc.id, {
                    ...orderData,
                    orderNumber: data.orderNumber || doc.id.substring(0, 6).toUpperCase(),
                    totalPrice: data.totalPrice || data.totalAmount || data.total || 0,
                    status: data.status || 'pending',
                    type: data.orderType || data.deliveryMethod || data.deliveryType || 'pickup',
                    customerName: data.customerName || data.userDisplayName || '',
                    customerPhone: data.customerPhone || data.userPhone || '',
                    address: data.deliveryAddress || data.address || null,
                    businessName: data.businessName || data.butcherName || '',
                    items: data.items || [],
                });
            });
        });

        const uniqueBusinesses = new Map();
        if (businessSnaps) {
            businessSnaps.forEach((snap: any) => {
                if (!snap || !snap.docs) return;
                snap.docs.forEach((doc: any) => {
                    const data = doc.data();
                    uniqueBusinesses.set(doc.id, {
                        id: doc.id,
                        companyName: data.companyName || '',
                        email: data.shopEmail || data.contactPerson?.email || '',
                        phoneNumber: data.shopPhone || data.contactPerson?.phone || '',
                        address: data.address || null,
                        isActive: data.isActive ?? true,
                        subscriptionPlan: data.subscriptionPlan || 'free',
                        createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : (data.createdAt || null),
                    });
                });
            });
        }

        return NextResponse.json({
            users: Array.from(uniqueUsers.values()),
            orders: Array.from(uniqueOrders.values()).sort((a: any, b: any) => {
                // Sort orders by createdAt desc locally (since we merged multiple queries)
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.getTime() - a.createdAt.getTime();
            }),
            businesses: Array.from(uniqueBusinesses.values())
        });

    } catch (error: any) {
        console.error('Customer Service Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
