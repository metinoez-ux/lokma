import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Başlangıç sektör verileri
const INITIAL_SECTORS = [
    {
        id: 'restoran',
        label: 'Restoran',
        icon: '🍽️',
        color: 'amber',
        description: 'Yemek & Rezervasyon',
        category: 'yemek',
        isActive: true,
        sortOrder: 1,
        features: ['menu', 'orders', 'delivery', 'reservation', 'table_capacity'],
    },
    {
        id: 'pastane',
        label: 'Pastane & Tatlıcı',
        icon: '🎂',
        color: 'pink',
        description: 'Pasta & Tatlı',
        category: 'yemek',
        isActive: true,
        sortOrder: 2,
        features: ['products', 'orders', 'custom_orders'],
    },
    {
        id: 'cafe',
        label: 'Kafe',
        icon: '☕',
        color: 'amber',
        description: 'Kahve & İçecek',
        category: 'yemek',
        isActive: true,
        sortOrder: 3,
        features: ['menu', 'orders', 'table_capacity'],
    },
    {
        id: 'cigkofte',
        label: 'Çiğ Köfteci',
        icon: '🥙',
        color: 'emerald',
        description: 'Çiğ Köfte',
        category: 'yemek',
        isActive: true,
        sortOrder: 4,
        features: ['products', 'orders', 'delivery'],
    },
    {
        id: 'firin',
        label: 'Fırın',
        icon: '🥖',
        color: 'amber',
        description: 'Ekmek, Börek & Hamur İşleri',
        category: 'yemek',
        isActive: true,
        sortOrder: 5,
        features: ['products', 'orders', 'delivery'],
    },
    {
        id: 'catering',
        label: 'Catering',
        icon: '🎉',
        color: 'indigo',
        description: 'Toplu Yemek',
        category: 'yemek',
        isActive: true,
        sortOrder: 6,
        features: ['menu', 'custom_orders'],
    },
    {
        id: 'kasap',
        label: 'Kasap',
        icon: '🥩',
        color: 'red',
        description: 'Et & Et Ürünleri',
        category: 'market',
        isActive: true,
        sortOrder: 10,
        features: ['products', 'orders', 'delivery', 'brand_label'],
    },
    {
        id: 'market',
        label: 'Market',
        icon: '🛒',
        color: 'green',
        description: 'Helal Market',
        category: 'market',
        isActive: true,
        sortOrder: 11,
        features: ['products', 'orders', 'delivery'],
    },
    {
        id: 'cicekci',
        label: 'Çiçekçi',
        icon: '🌸',
        color: 'purple',
        description: 'Çiçek Mağazası',
        category: 'market',
        isActive: true,
        sortOrder: 12,
        features: ['products', 'orders', 'delivery'],
    },
    {
        id: 'kermes',
        label: 'Kermes',
        icon: '🎪',
        color: 'violet',
        description: 'Etkinlik & Festival',
        category: 'kermes',
        isActive: true,
        sortOrder: 20,
        features: ['events', 'tickets', 'sponsors'],
    },
    {
        id: 'eticaret',
        label: 'Online Shop',
        icon: '🛍️',
        color: 'cyan',
        description: 'Online Shop / Sanal Magaza',
        category: 'market',
        isActive: true,
        sortOrder: 13,
        features: ['products', 'orders', 'shipping'],
    },
];

// GET - Tüm sektörleri getir
export async function GET() {
    try {
        const { db } = getFirebaseAdmin();
        const snapshot = await db.collection('sectors').orderBy('sortOrder').get();
        const sectors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ sectors });
    } catch (error) {
        console.error('Sectors GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch sectors' }, { status: 500 });
    }
}

// POST - Sektör seed veya oluştur
export async function POST(request: NextRequest) {
    try {
        const { db } = getFirebaseAdmin();
        const body = await request.json();
        const { action, sector } = body;

        if (action === 'seed') {
            const batch = db.batch();

            for (const s of INITIAL_SECTORS) {
                const docRef = db.collection('sectors').doc(s.id);
                batch.set(docRef, {
                    ...s,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            await batch.commit();
            return NextResponse.json({
                success: true,
                message: `${INITIAL_SECTORS.length} sektör oluşturuldu/güncellendi`
            });
        }

        if (action === 'create' && sector) {
            // Validate sector data
            if (!sector.id || !sector.label) {
                return NextResponse.json({ error: 'Sector ID and label are required' }, { status: 400 });
            }

            // Check if sector already exists
            const existing = await db.collection('sectors').doc(sector.id).get();
            if (existing.exists) {
                return NextResponse.json({ error: 'Bu ID zaten kullanılıyor' }, { status: 400 });
            }

            await db.collection('sectors').doc(sector.id).set({
                ...sector,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return NextResponse.json({
                success: true,
                message: 'Yeni sektör oluşturuldu'
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Sectors POST error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

// PATCH - Sektör güncelle
export async function PATCH(request: NextRequest) {
    try {
        const { db } = getFirebaseAdmin();
        const { id, ...updates } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Sector ID required' }, { status: 400 });
        }

        await db.collection('sectors').doc(id).update({
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, message: 'Sektör güncellendi' });
    } catch (error) {
        console.error('Sectors PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update sector' }, { status: 500 });
    }
}

// DELETE - Sektör sil
export async function DELETE(request: NextRequest) {
    try {
        const { db } = getFirebaseAdmin();
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Sector ID required' }, { status: 400 });
        }

        await db.collection('sectors').doc(id).delete();

        return NextResponse.json({ success: true, message: 'Sektör silindi' });
    } catch (error) {
        console.error('Sectors DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete sector' }, { status: 500 });
    }
}

