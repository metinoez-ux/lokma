export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { uid } = body;

 if (!uid) {
 return NextResponse.json({ error: 'User ID gerekli.' }, { status: 400 });
 }

 const admin = await getFirebaseAdmin();
 const db = admin.db;

 // Clear the flag from 'users' collection
 await db.collection('users').doc(uid).update({
 requirePasswordChange: false
 }).catch((e: any) => console.log('Notice: users doc flag update skipped', e));

 // Clear the flag from 'admins' collection
 await db.collection('admins').doc(uid).update({
 requirePasswordChange: false
 }).catch((e: any) => console.log('Notice: admins doc flag update skipped', e));

 return NextResponse.json({ success: true });
 } catch (error: any) {
 console.error('Error clearing password flag:', error);
 return NextResponse.json(
 { error: error.message || 'Sunucu hatası' },
 { status: 500 }
 );
 }
}
