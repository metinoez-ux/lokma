import { NextRequest, NextResponse } from 'next/server';
import { createConnectedAccount, createAccountLink } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Stripe Connect Express onboarding başlat
 * Business'ı Stripe'a kaydet ve banka hesabı ekleme sayfasına yönlendir
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { businessId, email, businessName, returnUrl, refreshUrl } = body;

        if (!businessId || !email || !businessName) {
            return NextResponse.json(
                { error: 'businessId, email ve businessName gerekli' },
                { status: 400 }
            );
        }

        // İşletme bilgisini al
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return NextResponse.json(
                { error: 'İşletme bulunamadı' },
                { status: 404 }
            );
        }

        const businessData = businessDoc.data();
        let stripeAccountId = businessData.stripeAccountId;

        // Eğer zaten Stripe hesabı varsa, Account Link oluştur
        if (!stripeAccountId) {
            // Yeni Connected Account oluştur
            const account = await createConnectedAccount({
                email,
                butcherId: businessId,
                businessName,
                country: 'DE', // Almanya
            });

            stripeAccountId = account.id;

            // Firestore'a kaydet
            await updateDoc(doc(db, 'businesses', businessId), {
                stripeAccountId: account.id,
                stripeAccountStatus: 'pending',
                stripeAccountCreatedAt: new Date(),
            });
        }

        // Account Link oluştur (onboarding URL)
        const accountLink = await createAccountLink({
            accountId: stripeAccountId,
            refreshUrl: refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL}/account?refresh=true`,
            returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/account?onboarding=complete`,
        });

        return NextResponse.json({
            success: true,
            onboardingUrl: accountLink.url,
            stripeAccountId,
        });
    } catch (error: any) {
        console.error('Stripe Connect onboarding error:', error);
        return NextResponse.json(
            { error: error.message || 'Stripe bağlantısı başarısız' },
            { status: 500 }
        );
    }
}

/**
 * Stripe Connect hesap durumunu kontrol et
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const businessId = searchParams.get('businessId');

        if (!businessId) {
            return NextResponse.json(
                { error: 'businessId gerekli' },
                { status: 400 }
            );
        }

        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return NextResponse.json(
                { error: 'İşletme bulunamadı' },
                { status: 404 }
            );
        }

        const data = businessDoc.data();

        return NextResponse.json({
            hasStripeAccount: !!data.stripeAccountId,
            stripeAccountId: data.stripeAccountId || null,
            stripeAccountStatus: data.stripeAccountStatus || 'none',
            bankInfo: data.bankInfo || null,
        });
    } catch (error: any) {
        console.error('Stripe Connect status error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
