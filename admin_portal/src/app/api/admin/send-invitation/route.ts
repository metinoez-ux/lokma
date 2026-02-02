import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Generate a random token for invitation link
function generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, role, businessId, businessName, businessType, invitedBy, invitedByName, invitedByEmail } = body;

        // Validate required fields
        if (!phone) {
            return NextResponse.json(
                { error: 'Telefon numarası zorunludur' },
                { status: 400 }
            );
        }

        if (!role || role === 'user') {
            return NextResponse.json(
                { error: 'Geçerli bir rol seçmelisiniz' },
                { status: 400 }
            );
        }

        // For kasap roles, require business selection
        if ((role === 'kasap' || role === 'kasap_staff') && !businessId) {
            return NextResponse.json(
                { error: 'İşletme seçimi zorunludur' },
                { status: 400 }
            );
        }

        const { db } = getFirebaseAdmin();

        // Generate unique token
        const token = generateToken();

        // Create invitation document
        const invitationData = {
            phone: phone.replace(/\s/g, ''), // Remove spaces
            token,
            role,
            businessId: businessId || null,
            businessName: businessName || null,
            businessType: businessType || null,
            invitedBy: invitedBy || null,
            invitedByName: invitedByName || 'Admin',
            invitedByEmail: invitedByEmail || null,
            status: 'pending',
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
            createdAt: Timestamp.now(),
        };

        await db.collection('admin_invitations').add(invitationData);

        // TODO: Send SMS via Twilio (for now, just log)
        console.log('=== INVITATION SMS ===');
        console.log(`To: ${phone}`);
        console.log(`Message: ${invitedByName} sizi MIRA Admin olarak davet etti.`);
        if (businessName) {
            console.log(`İşletme: ${businessName}`);
        }
        console.log(`Rol: ${role}`);
        console.log(`Link: https://miraportal.com/invite/${token}`);
        console.log('======================');

        // In test mode, SMS is logged but not sent
        // When Twilio is verified, uncomment this:
        /*
        const { sendWhatsAppMessage } = await import('@/lib/whatsapp');
        await sendWhatsAppMessage(
            phone,
            `${invitedByName} sizi MIRA Admin olarak davet etti.\n` +
            (businessName ? `İşletme: ${businessName}\n` : '') +
            `Rol: ${role}\n` +
            `Profilinizi tamamlamak için: https://miraportal.com/invite/${token}`
        );
        */

        return NextResponse.json({
            success: true,
            message: 'Davetiye oluşturuldu',
            token, // Return token for testing purposes
            // In production, we won't return the token
        });

    } catch (error) {
        console.error('Send invitation error:', error);
        return NextResponse.json(
            { error: 'Davetiye gönderilirken bir hata oluştu' },
            { status: 500 }
        );
    }
}
