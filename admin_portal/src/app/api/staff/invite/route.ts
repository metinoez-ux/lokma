import { NextRequest, NextResponse } from 'next/server';
import { sendStaffInvitationSMS, generateTempPassword } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { staffPhone, staffName, inviterName, businessName, role } = body;

        // Validate required fields
        if (!staffPhone || !staffName || !businessName || !role) {
            return NextResponse.json(
                { error: 'Eksik bilgi: Telefon, isim, işletme ve rol gerekli' },
                { status: 400 }
            );
        }

        // Generate temporary password
        const tempPassword = generateTempPassword();

        // Send SMS
        const result = await sendStaffInvitationSMS({
            staffPhone,
            staffName,
            inviterName: inviterName || 'MIRA Admin',
            businessName,
            role,
            tempPassword,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                tempPassword, // Return to store in DB
                messageId: result.messageId,
            });
        } else {
            return NextResponse.json(
                { error: result.error || 'SMS gönderilemedi' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Staff invitation SMS error:', error);
        return NextResponse.json(
            { error: 'SMS gönderim hatası' },
            { status: 500 }
        );
    }
}
