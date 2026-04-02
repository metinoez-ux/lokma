'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isSuperAdmin } from '@/lib/config';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface UserData {
 email: string | null;
 displayName: string | null;
 createdAt?: string;
 provider?: string;
}

type ExportFormat = 'json' | 'excel' | 'pdf';

export default function ProfilePage() {
 const [user, setUser] = useState<UserData | null>(null);
 const [loading, setLoading] = useState(true);
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showExportModal, setShowExportModal] = useState(false);
 const [deletePassword, setDeletePassword] = useState('');
 const [deleteError, setDeleteError] = useState('');
 const [deleting, setDeleting] = useState(false);
 const [exporting, setExporting] = useState(false);
 const router = useRouter();

 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
 if (!firebaseUser) {
 router.push('/login');
 return;
 }

 // Check if super admin - redirect to admin dashboard
 const isSuperAdminCheck = isSuperAdmin(firebaseUser.email);
 console.log('Profile page - Email:', firebaseUser.email, 'isSuperAdmin:', isSuperAdminCheck);
 if (isSuperAdminCheck) {
 router.push('/admin/dashboard');
 return;
 }

 // STRATEGY 1: Check if user is an admin by UID (document ID)
 const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
 if (adminDoc.exists() && adminDoc.data().isActive) {
 router.push('/admin/dashboard');
 return;
 }

 // STRATEGY 2: Check by firebaseUid field
 const { updateDoc } = await import('firebase/firestore');
 const uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', firebaseUser.uid));
 const uidSnapshot = await getDocs(uidQuery);
 if (!uidSnapshot.empty && uidSnapshot.docs[0].data().isActive) {
 router.push('/admin/dashboard');
 return;
 }

 // STRATEGY 3: Check by email
 if (firebaseUser.email) {
 const emailQuery = query(collection(db, 'admins'), where('email', '==', firebaseUser.email));
 const emailSnapshot = await getDocs(emailQuery);
 if (!emailSnapshot.empty) {
 const matchedAdmin = emailSnapshot.docs[0];
 // Link UID to admin record
 await updateDoc(doc(db, 'admins', matchedAdmin.id), {
 firebaseUid: firebaseUser.uid,
 lastLoginAt: new Date(),
 linkedVia: 'email_profile'
 });
 router.push('/admin/dashboard');
 return;
 }
 }

 // STRATEGY 4: Check by phone number
 if (firebaseUser.phoneNumber) {
 const normalizedPhone = firebaseUser.phoneNumber.replace(/[\s\-()]/g, '');
 const phoneVariations = [normalizedPhone, normalizedPhone.replace(/^\+/, ''), firebaseUser.phoneNumber];

 for (const phoneVar of phoneVariations) {
 const phoneQuery = query(collection(db, 'admins'), where('phoneNumber', '==', phoneVar));
 const phoneSnapshot = await getDocs(phoneQuery);
 if (!phoneSnapshot.empty) {
 const matchedAdmin = phoneSnapshot.docs[0];
 // Link UID to admin record
 await updateDoc(doc(db, 'admins', matchedAdmin.id), {
 firebaseUid: firebaseUser.uid,
 lastLoginAt: new Date(),
 linkedVia: 'phone_profile'
 });
 router.push('/admin/dashboard');
 return;
 }
 }
 }

 // SYNC USER TO USERS COLLECTION - ensure user is visible in admin panel
 const { setDoc } = await import('firebase/firestore');
 const userDocRef = doc(db, 'users', firebaseUser.uid);
 const existingUserDoc = await getDoc(userDocRef);

 if (!existingUserDoc.exists()) {
 // Create new user record
 await setDoc(userDocRef, {
 email: firebaseUser.email || null,
 phoneNumber: firebaseUser.phoneNumber || null,
 displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'MIRA Benutzer',
 createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
 createdVia: 'profile_sync',
 isAdmin: false,
 lastLoginAt: new Date().toISOString(),
 provider: firebaseUser.providerData[0]?.providerId,
 });
 console.log('Created user record from profile page:', firebaseUser.uid);
 } else {
 // Update last login time
 await updateDoc(doc(db, 'users', firebaseUser.uid), {
 lastLoginAt: new Date().toISOString(),
 });
 }

 setUser({
 email: firebaseUser.email,
 displayName: firebaseUser.displayName,
 createdAt: firebaseUser.metadata.creationTime,
 provider: firebaseUser.providerData[0]?.providerId,
 });
 setLoading(false);
 });

 return () => unsubscribe();
 }, [router]);

 const gatherExportData = async () => {
 if (!auth.currentUser) return null;

 const userId = auth.currentUser.uid;
 const exportData = {
 profile: {
 email: auth.currentUser.email || '',
 displayName: auth.currentUser.displayName || '',
 createdAt: auth.currentUser.metadata.creationTime || '',
 },
 exportedAt: new Date().toISOString(),
 collections: {} as Record<string, Array<Record<string, unknown>>>,
 };

 const collectionsToExport = ['prayers', 'notes', 'favorites', 'history', 'settings'];

 for (const collectionName of collectionsToExport) {
 try {
 const q = query(collection(db, collectionName), where('userId', '==', userId));
 const snapshot = await getDocs(q);
 exportData.collections[collectionName] = snapshot.docs.map(d => ({
 id: d.id,
 ...d.data()
 }));
 } catch {
 // Collection might not exist
 }
 }

 return exportData;
 };

 const handleExport = async (format: ExportFormat) => {
 setExporting(true);
 try {
 const data = await gatherExportData();
 if (!data) throw new Error('No data');

 const dateStr = new Date().toISOString().split('T')[0];

 if (format === 'json') {
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 downloadBlob(blob, `mira-verilerim-${dateStr}.json`);
 } else if (format === 'excel') {
 const wb = XLSX.utils.book_new();

 // Profile sheet
 const profileData = [
 ['E-posta', data.profile.email],
 ['Ad', data.profile.displayName],
 ['Erstellt am', data.profile.createdAt],
 ['Export-Datum', data.exportedAt],
 ];
 const profileSheet = XLSX.utils.aoa_to_sheet(profileData);
 XLSX.utils.book_append_sheet(wb, profileSheet, 'Profil');

 // Each collection as separate sheet
 for (const [name, items] of Object.entries(data.collections)) {
 if (Array.isArray(items) && items.length > 0) {
 const ws = XLSX.utils.json_to_sheet(items);
 XLSX.utils.book_append_sheet(wb, ws, name.charAt(0).toUpperCase() + name.slice(1));
 }
 }

 XLSX.writeFile(wb, `mira-verilerim-${dateStr}.xlsx`);
 } else if (format === 'pdf') {
 const pdf = new jsPDF();

 pdf.setFontSize(20);
 pdf.text('MIRA - Meine Daten', 20, 20);

 pdf.setFontSize(12);
 pdf.text(`Export-Datum: ${data.exportedAt}`, 20, 35);

 pdf.setFontSize(14);
 pdf.text('Profilinformationen', 20, 50);

 pdf.setFontSize(11);
 pdf.text(`E-posta: ${data.profile.email || '-'}`, 25, 60);
 pdf.text(`Name: ${data.profile.displayName || '-'}`, 25, 68);
 pdf.text(`Konto erstellt: ${data.profile.createdAt || '-'}`, 25, 76);

 let yPos = 95;

 for (const [name, items] of Object.entries(data.collections)) {
 if (Array.isArray(items) && items.length > 0) {
 if (yPos > 250) {
 pdf.addPage();
 yPos = 20;
 }
 pdf.setFontSize(14);
 pdf.text(`${name.charAt(0).toUpperCase() + name.slice(1)} (${items.length} Einträge)`, 20, yPos);
 yPos += 10;
 }
 }

 pdf.save(`mira-verilerim-${dateStr}.pdf`);
 }

 setShowExportModal(false);
 } catch (error) {
 console.error('Export error:', error);
 alert('Fehler beim Exportieren der Daten.');
 }
 setExporting(false);
 };

 const downloadBlob = (blob: Blob, filename: string) => {
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 const handleDeleteAccount = async () => {
 if (!auth.currentUser) return;

 setDeleting(true);
 setDeleteError('');

 try {
 const userId = auth.currentUser.uid;
 const userEmail = auth.currentUser.email;
 const userPhone = auth.currentUser.phoneNumber;

 // STRATEGY 1: Try Admin API first (bypasses reauthentication requirement)
 try {
 const response = await fetch('/api/admin/delete-user', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userId: userId,
 email: userEmail,
 phoneNumber: userPhone,
 }),
 });

 if (response.ok) {
 // User deleted via Admin API - sign out and redirect
 await auth.signOut();
 router.push('/?deleted=true');
 return;
 }
 // If API fails, fall through to client-side deletion
 console.log('Admin API failed, trying client-side deletion');
 } catch (apiError) {
 console.log('Admin API not available, trying client-side:', apiError);
 }

 // STRATEGY 2: Client-side deletion (requires reauthentication for some providers)
 if (user?.provider === 'password' && deletePassword) {
 const credential = EmailAuthProvider.credential(auth.currentUser.email!, deletePassword);
 await reauthenticateWithCredential(auth.currentUser, credential);
 }

 // Delete user data from Firestore
 const collectionsToDelete = ['prayers', 'notes', 'favorites', 'history', 'settings'];
 for (const collectionName of collectionsToDelete) {
 try {
 const q = query(collection(db, collectionName), where('userId', '==', userId));
 const snapshot = await getDocs(q);
 for (const docSnap of snapshot.docs) {
 await deleteDoc(doc(db, collectionName, docSnap.id));
 }
 } catch {
 // Continue
 }
 }

 // Also delete from users collection
 try {
 await deleteDoc(doc(db, 'users', userId));
 } catch {
 // Continue
 }

 await deleteUser(auth.currentUser);
 router.push('/?deleted=true');
 } catch (error) {
 console.error('Delete error:', error);
 if (error instanceof Error) {
 if (error.message.includes('requires-recent-login')) {
 setDeleteError('Aus Sicherheitsgründen müssen Sie sich erneut anmelden. Bitte melden Sie sich ab und wieder an und löschen Sie dann Ihr Konto.');
 } else if (error.message.includes('wrong-password')) {
 setDeleteError('Falsches Passwort.');
 } else {
 setDeleteError('Fehler beim Löschen des Kontos.');
 }
 }
 setDeleting(false);
 }
 };

 const handleLogout = async () => {
 await auth.signOut();
 router.push('/');
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-muted/30 flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-muted/30">
 {/* Header */}
 <header className="bg-background border-b">
 <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
 <Link href="/" className="flex items-center space-x-2">
 <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
 <span className="text-white font-bold text-sm">M</span>
 </div>
 <span className="font-bold text-foreground">MIRA</span>
 </Link>
 <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground text-sm">
 Abmelden
 </button>
 </div>
 </header>

 <main className="max-w-3xl mx-auto px-4 py-8">
 <h1 className="text-2xl font-bold text-foreground mb-8">Mein Konto</h1>

 {/* Profile Card */}
 <div className="bg-background rounded-xl shadow-sm p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-foreground">Profilinformationen</h2>
 <Link href="/profile/edit" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
 ✏️ Bearbeiten
 </Link>
 </div>
 <div className="space-y-3">
 <div className="flex justify-between">
 <span className="text-muted-foreground/80">E-posta</span>
 <span className="font-medium text-foreground">{user?.email || '-'}</span>
 </div>
 {user?.displayName && (
 <div className="flex justify-between">
 <span className="text-muted-foreground/80">Name</span>
 <span className="font-medium text-foreground">{user.displayName}</span>
 </div>
 )}
 <div className="flex justify-between">
 <span className="text-muted-foreground/80">Anmeldemethode</span>
 <span className="font-medium text-foreground">
 {user?.provider === 'apple.com' ? '🍎 Apple' :
 user?.provider === 'google.com' ? '🔵 Google' : '📧 E-posta'}
 </span>
 </div>
 {user?.createdAt && (
 <div className="flex justify-between">
 <span className="text-muted-foreground/80">Konto erstellt</span>
 <span className="font-medium text-foreground">{new Date(user.createdAt).toLocaleDateString('de-DE')}</span>
 </div>
 )}
 </div>
 </div>

 {/* Quick Links */}
 <div className="grid grid-cols-2 gap-4 mb-6">
 <Link href="/support" className="bg-background rounded-xl shadow-sm p-4 hover:shadow-md transition text-center">
 <span className="text-2xl">❓</span>
 <p className="font-medium text-foreground mt-2">Hilfe</p>
 </Link>
 <Link href="/feedback" className="bg-background rounded-xl shadow-sm p-4 hover:shadow-md transition text-center">
 <span className="text-2xl">💡</span>
 <p className="font-medium text-foreground mt-2">Vorschlag / Beschwerde</p>
 </Link>
 </div>

 {/* Data Export Card */}
 <div className="bg-background rounded-xl shadow-sm p-6 mb-6">
 <h2 className="text-lg font-semibold text-foreground mb-2">Meine Daten herunterladen</h2>
 <p className="text-muted-foreground/80 text-sm mb-4">
 Laden Sie alle Ihre bei MIRA gespeicherten Daten herunter.
 </p>
 <button
 onClick={() => setShowExportModal(true)}
 className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
 >
 📥 Meine Daten herunterladen
 </button>
 </div>

 {/* Delete Account Card */}
 <div className="bg-background rounded-xl shadow-sm p-6 border border-red-100">
 <h2 className="text-lg font-semibold text-red-600 mb-2">Mein Konto löschen</h2>
 <p className="text-muted-foreground/80 text-sm mb-4">
 Löschen Sie Ihr Konto dauerhaft. Dieser Vorgang kann nicht rückgängig gemacht werden.
 </p>
 <button
 onClick={() => setShowDeleteModal(true)}
 className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition"
 >
 🗑️ Mein Konto löschen
 </button>
 </div>
 </main>

 {/* Export Modal */}
 {showExportModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
 <div className="bg-background rounded-xl p-6 w-full max-w-sm">
 <h3 className="text-xl font-bold text-foreground mb-4">Format wählen</h3>
 <div className="space-y-3">
 <button
 onClick={() => handleExport('json')}
 disabled={exporting}
 className="w-full flex items-center justify-between p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
 >
 <div className="flex items-center space-x-3">
 <span className="text-2xl">📄</span>
 <div className="text-left">
 <p className="font-medium">JSON</p>
 <p className="text-xs text-muted-foreground/80">Technisches Format</p>
 </div>
 </div>
 </button>
 <button
 onClick={() => handleExport('excel')}
 disabled={exporting}
 className="w-full flex items-center justify-between p-4 border rounded-xl hover:border-green-500 hover:bg-green-50 transition disabled:opacity-50"
 >
 <div className="flex items-center space-x-3">
 <span className="text-2xl">📊</span>
 <div className="text-left">
 <p className="font-medium">Excel</p>
 <p className="text-xs text-muted-foreground/80">Tabellenformat (.xlsx)</p>
 </div>
 </div>
 </button>
 <button
 onClick={() => handleExport('pdf')}
 disabled={exporting}
 className="w-full flex items-center justify-between p-4 border rounded-xl hover:border-red-500 hover:bg-red-50 transition disabled:opacity-50"
 >
 <div className="flex items-center space-x-3">
 <span className="text-2xl">📕</span>
 <div className="text-left">
 <p className="font-medium">PDF</p>
 <p className="text-xs text-muted-foreground/80">Dokumentformat</p>
 </div>
 </div>
 </button>
 </div>
 <button
 onClick={() => setShowExportModal(false)}
 className="w-full mt-4 py-2 text-muted-foreground hover:text-foreground"
 >
 Abbrechen
 </button>
 </div>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 {showDeleteModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
 <div className="bg-background rounded-xl p-6 w-full max-w-md">
 <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Konto löschen</h3>
 <p className="text-muted-foreground mb-4">
 Dieser Vorgang kann nicht rückgängig gemacht werden. Alle Ihre Daten werden dauerhaft gelöscht.
 </p>

 {deleteError && (
 <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
 {deleteError}
 </div>
 )}

 {user?.provider === 'password' && (
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground/80 dark:text-gray-300 mb-1">
 Passwort eingeben
 </label>
 <input
 type="password"
 value={deletePassword}
 onChange={(e) => setDeletePassword(e.target.value)}
 className="w-full px-4 py-2 border rounded-lg"
 placeholder="Ihr aktuelles Passwort"
 />
 </div>
 )}

 <div className="flex space-x-3">
 <button
 onClick={() => {
 setShowDeleteModal(false);
 setDeleteError('');
 setDeletePassword('');
 }}
 className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted/30"
 disabled={deleting}
 >
 Abbrechen
 </button>
 <button
 onClick={handleDeleteAccount}
 disabled={deleting || (user?.provider === 'password' && !deletePassword)}
 className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
 >
 {deleting ? 'Wird gelöscht...' : 'Ja, löschen'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
