import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CreateKermesInput, KermesStatus } from '@/lib/kermes-types';

// POST - Yeni Kermes Oluştur
export async function POST(request: NextRequest) {
    try {
        const body: CreateKermesInput = await request.json();

        // Validation
        if (!body.name || !body.organizationId || !body.startDate || !body.endDate) {
            return NextResponse.json(
                { error: 'Kermes adı, organizasyon, başlangıç ve bitiş tarihi zorunludur' },
                { status: 400 }
            );
        }

        const { db } = getFirebaseAdmin();
        const kermesRef = db.collection('kermes').doc();

        const kermes = {
            id: kermesRef.id,
            name: body.name,
            description: body.description || '',
            organizationId: body.organizationId,
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            dailyHours: body.dailyHours || { open: '09:00', close: '18:00' },
            contact: body.contact || { name: '', phone: '' },
            address: body.address || {
                fullAddress: '',
                street: '',
                city: '',
                postalCode: '',
                country: 'DE',
            },
            parking: body.parking || {
                hasParking: false,
                hasNearbyParking: false,
            },
            features: body.features || [],
            hasMenu: false,
            status: 'draft' as KermesStatus,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'admin', // TODO: get from session
        };

        await kermesRef.set(kermes);

        return NextResponse.json({
            success: true,
            message: 'Kermes başarıyla oluşturuldu',
            kermes: {
                id: kermesRef.id,
                name: kermes.name,
            }
        });

    } catch (error) {
        console.error('❌ Create kermes error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Kermes oluşturulamadı' },
            { status: 500 }
        );
    }
}

// GET - Kermesleri Listele
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('orgId');
        const status = searchParams.get('status');
        const search = searchParams.get('search') || '';
        const limit = parseInt(searchParams.get('limit') || '50');

        const { db } = getFirebaseAdmin();
        let query = db.collection('kermes').limit(200);

        // Organization filter (server-side)
        if (orgId) {
            query = query.where('organizationId', '==', orgId);
        }

        const snapshot = await query.get();

        let kermesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Timestamps to ISO strings for JSON
            startDate: doc.data().startDate?.toDate?.()?.toISOString() || doc.data().startDate,
            endDate: doc.data().endDate?.toDate?.()?.toISOString() || doc.data().endDate,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        }));

        // Client-side filters
        if (status) {
            kermesList = kermesList.filter((k: any) => k.status === status);
        }

        if (search && search.length >= 2) {
            const searchLower = search.toLowerCase();
            kermesList = kermesList.filter((k: any) =>
                k.name?.toLowerCase().includes(searchLower) ||
                k.address?.city?.toLowerCase().includes(searchLower) ||
                k.address?.postalCode?.includes(search)
            );
        }

        // Sort by start date (newest first)
        kermesList.sort((a: any, b: any) => {
            const dateA = new Date(a.startDate || 0).getTime();
            const dateB = new Date(b.startDate || 0).getTime();
            return dateB - dateA;
        });

        return NextResponse.json({
            success: true,
            kermes: kermesList.slice(0, limit),
            count: kermesList.length,
        });

    } catch (error) {
        console.error('❌ List kermes error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Kermesler listelenemedi' },
            { status: 500 }
        );
    }
}
