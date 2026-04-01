import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from './firebase-admin';

export interface VerifiedAdmin {
    uid: string;
    email: string;
    role: string;
    adminType: string | null;
    businessId: string | null;
    isSuperAdmin: boolean;
}

/**
 * Ensures the API request has a valid Bearer token and belongs to an active Admin.
 * Returns either the verified admin details, or a NextResponse (401/403) to return directly.
 */
export async function verifyApiAuth(req: NextRequest): Promise<VerifiedAdmin | NextResponse> {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Yetkisiz erisim: Token eksik veya gecersiz' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const { auth, db } = getFirebaseAdmin();

        const decodedToken = await auth.verifyIdToken(token);
        
        // Fetch admin doc to verify active admin permission
        const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Yetkisiz erisim: Admin yetkisi bulunamadi' }, { status: 403 });
        }
        
        const adminData = adminDoc.data();
        if (adminData?.isActive === false) {
             return NextResponse.json({ error: 'Hesabiniz askiya alinmis' }, { status: 403 });
        }

        return {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
            role: adminData?.role || 'admin',
            adminType: adminData?.adminType || null,
            businessId: adminData?.businessId || adminData?.butcherId || null,
            isSuperAdmin: adminData?.adminType === 'super' || adminData?.role === 'super' || adminData?.role === 'superAdmin' || adminData?.roles?.includes('super') || false
        };
    } catch (error) {
        console.error('API Verification error:', error);
        return NextResponse.json({ error: 'Yetkisiz erisim: Gecersiz token' }, { status: 401 });
    }
}
