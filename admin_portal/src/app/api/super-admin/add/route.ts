export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    // Verify caller is super admin
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const callerDoc = await adminDb.collection('admins').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.adminType !== 'super') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    try {
        // Try to find existing Firebase Auth user by email
        let uid: string;
        let isNew = false;
        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            uid = userRecord.uid;
        } catch {
            // User doesn't exist in Auth — we'll create an invite instead
            isNew = true;
            uid = '';
        }

        if (!isNew && uid) {
            // Promote existing user to super admin
            const adminRef = adminDb.collection('admins').doc(uid);
            const existing = await adminRef.get();
            await adminRef.set(
                {
                    adminType: 'super',
                    email: email.toLowerCase(),
                    displayName: existing.data()?.displayName || email.split('@')[0],
                    promotedAt: Timestamp.now(),
                },
                { merge: true }
            );
            return NextResponse.json({ success: true, mode: 'promoted', uid });
        } else {
            // Create invite for unregistered user
            const inviteRef = adminDb.collection('admin_invitations').doc();
            const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 72);
            await inviteRef.set({
                email: email.toLowerCase(),
                role: 'super_admin',
                adminType: 'super',
                status: 'pending',
                token,
                expiresAt: Timestamp.fromDate(expiresAt),
                createdAt: Timestamp.now(),
            });
            const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lokma.web.app'}/register?token=${token}`;
            return NextResponse.json({ success: true, mode: 'invited', inviteLink });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
