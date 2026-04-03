export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/crypto';

/**
 * API Key Vault — CRUD for encrypted API keys
 * Stored in Firestore: config/apiKeys
 * Only super admins can access.
 */

const CONFIG_DOC = 'config/apiKeys';

interface ApiKeyEntry {
 encryptedValue: string;
 label: string;
 service: string;
 updatedAt: string;
 updatedBy: string;
}

// ── Auth helper: verify Firebase token + super admin ─────────────────
async function verifySuperAdmin(req: NextRequest): Promise<{ uid: string; email: string } | null> {
 try {
 const authHeader = req.headers.get('Authorization');
 if (!authHeader?.startsWith('Bearer ')) return null;

 const token = authHeader.split('Bearer ')[1];
 const { auth, db } = getFirebaseAdmin();
 const decodedToken = await auth.verifyIdToken(token);

 // Check super admin status in Firestore
 const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
 if (!adminDoc.exists || adminDoc.data()?.adminType !== 'super') return null;

 return { uid: decodedToken.uid, email: decodedToken.email || '' };
 } catch {
 return null;
 }
}

// ── GET: List all keys (masked) ──────────────────────────────────────
export async function GET(req: NextRequest) {
 const admin = await verifySuperAdmin(req);
 if (!admin) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 try {
 const { db } = getFirebaseAdmin();
 const doc = await db.doc(CONFIG_DOC).get();
 const data = doc.data() || {};

 // Return masked keys
 const keys: Record<string, { masked: string; label: string; service: string; updatedAt: string; updatedBy: string }> = {};
 for (const [id, entry] of Object.entries(data)) {
 const e = entry as ApiKeyEntry;
 if (e.encryptedValue) {
 try {
 const decrypted = decryptApiKey(e.encryptedValue);
 keys[id] = {
 masked: maskApiKey(decrypted),
 label: e.label || id,
 service: e.service || 'unknown',
 updatedAt: e.updatedAt || '',
 updatedBy: e.updatedBy || '',
 };
 } catch {
 keys[id] = {
 masked: '****',
 label: e.label || id,
 service: e.service || 'unknown',
 updatedAt: e.updatedAt || '',
 updatedBy: e.updatedBy || '',
 };
 }
 }
 }

 return NextResponse.json({ keys });
 } catch (error: any) {
 console.error('API Keys GET error:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

// ── POST: Add or update a key ────────────────────────────────────────
export async function POST(req: NextRequest) {
 const admin = await verifySuperAdmin(req);
 if (!admin) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 try {
 const { keyId, value, label, service } = await req.json();
 if (!keyId || !value) {
 return NextResponse.json({ error: 'keyId and value are required' }, { status: 400 });
 }

 const encrypted = encryptApiKey(value);
 const { db } = getFirebaseAdmin();

 await db.doc(CONFIG_DOC).set(
 {
 [keyId]: {
 encryptedValue: encrypted,
 label: label || keyId,
 service: service || 'custom',
 updatedAt: new Date().toISOString(),
 updatedBy: admin.email,
 },
 },
 { merge: true }
 );

 return NextResponse.json({ success: true, masked: maskApiKey(value) });
 } catch (error: any) {
 console.error('API Keys POST error:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

// ── DELETE: Remove a key ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
 const admin = await verifySuperAdmin(req);
 if (!admin) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 try {
 const { keyId } = await req.json();
 if (!keyId) {
 return NextResponse.json({ error: 'keyId is required' }, { status: 400 });
 }

 const { db } = getFirebaseAdmin();
 const { FieldValue } = await import('firebase-admin/firestore');
 await db.doc(CONFIG_DOC).update({
 [keyId]: FieldValue.delete(),
 });

 return NextResponse.json({ success: true });
 } catch (error: any) {
 console.error('API Keys DELETE error:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
