'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, updateDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isSuperAdmin, SUPER_ADMIN_EMAILS } from '@/lib/config';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface Invitation {
 id: string;
 email: string;
 role: 'super_admin' | 'admin';
 adminType?: string;
 invitedBy: string;
 invitedByEmail: string;
 status: 'pending' | 'registered' | 'approved' | 'rejected';
 token: string;
 expiresAt: Date;
 createdAt: Date;
 registrationData?: {
 firstName: string;
 lastName: string;
 phone: string;
 dateOfBirth: string;
 address: {
 street: string;
 houseNumber: string;
 postalCode: string;
 city: string;
 state: string;
 country: string;
 };
 };
}

interface PendingAdmin {
 id: string;
 email: string;
 isActive: boolean;
 role: string;
}

export default function InvitationsPage() {

 const t = useTranslations('AdminInvitations');
 const [loading, setLoading] = useState(true);
 const [invitations, setInvitations] = useState<Invitation[]>([]);
 const [pendingApprovals, setPendingApprovals] = useState<Invitation[]>([]);
 const [newEmail, setNewEmail] = useState('');
 const [inviteRole, setInviteRole] = useState<'super_admin' | 'admin'>('super_admin');
 const [sending, setSending] = useState(false);
 const [activeTab, setActiveTab] = useState<'invite' | 'pending' | 'superadmins'>('invite');
 const [superAdmins, setSuperAdmins] = useState<string[]>([]);
 const router = useRouter();
 const [confirmApprove, setConfirmApprove] = useState<Invitation | null>(null);
 const [confirmReject, setConfirmReject] = useState<Invitation | null>(null);

 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
 if (!user) {
 router.push('/login');
 return;
 }

 // Only super admins can access this page
 if (!isSuperAdmin(user.email)) {
 router.push('/dashboard');
 return;
 }

 // Load current super admins
 setSuperAdmins([...SUPER_ADMIN_EMAILS]);

 // Load invitations
 await loadInvitations();
 setLoading(false);
 });

 return () => unsubscribe();
 }, [router]);

 const loadInvitations = async () => {
 try {
 const invitationsQuery = query(
 collection(db, 'admin_invitations'),
 orderBy('createdAt', 'desc')
 );
 const snapshot = await getDocs(invitationsQuery);
 const allInvitations = snapshot.docs.map(d => ({
 id: d.id,
 ...d.data(),
 expiresAt: d.data().expiresAt?.toDate(),
 createdAt: d.data().createdAt?.toDate(),
 })) as Invitation[];

 setInvitations(allInvitations);
 setPendingApprovals(allInvitations.filter(i => i.status === 'registered'));
 } catch (error) {
 console.error('Load invitations error:', error);
 }
 };

 const generateToken = () => {
 return Math.random().toString(36).substring(2, 15) +
 Math.random().toString(36).substring(2, 15) +
 Date.now().toString(36);
 };

 const handleInvite = async () => {
 if (!newEmail.trim() || !auth.currentUser) return;

 setSending(true);
 try {
 const token = generateToken();
 const expiresAt = new Date();
 expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours

 await addDoc(collection(db, 'admin_invitations'), {
 email: newEmail.toLowerCase().trim(),
 role: inviteRole,
 invitedBy: auth.currentUser.uid,
 invitedByEmail: auth.currentUser.email,
 status: 'pending',
 token,
 expiresAt: Timestamp.fromDate(expiresAt),
 createdAt: Timestamp.now(),
 });

 // In production, send email via Firebase Functions or similar
 // For now, show the invite link
 const inviteLink = `${window.location.origin}/register?token=${token}`;
 alert(`${t('davetiye_olusturuldu')}\n\nLink:\n${inviteLink}\n\n(${t('davetiye_link_aciklama')})`);

 setNewEmail('');
 await loadInvitations();
 } catch (error) {
 console.error(t('invite_error'), error);
 alert(t('davetiye_gonderilemedi'));
 }
 setSending(false);
 };

 const handleApprove = async (invitation: Invitation) => {
 setConfirmApprove(invitation);
 };
 const handleApproveConfirm = async () => {
 const invitation = confirmApprove;
 if (!invitation) return;

 try {
 // Update invitation status
 await updateDoc(doc(db, 'admin_invitations', invitation.id), {
 status: 'approved',
 approvedAt: Timestamp.now(),
 approvedBy: auth.currentUser?.uid,
 });

 // Create admin record
 const adminQuery = query(collection(db, 'users'), where('email', '==', invitation.email));
 const userSnapshot = await getDocs(adminQuery);

 if (userSnapshot.docs.length > 0) {
 const userId = userSnapshot.docs[0].id;
 await updateDoc(doc(db, 'admins', userId), {
 email: invitation.email,
 role: invitation.role,
 isActive: true,
 ...invitation.registrationData,
 approvedAt: Timestamp.now(),
 approvedBy: auth.currentUser?.uid,
 });
 }

 await loadInvitations();
 setConfirmApprove(null);
 alert(t('onaylandi_kullanici_artik_super_admin_ye'));
 } catch (error) {
 console.error('Approve error:', error);
 alert(t('onaylama_sirasinda_hata_olustu'));
 }
 };

 const handleReject = async (invitation: Invitation) => {
 setConfirmReject(invitation);
 };
 const handleRejectConfirm = async () => {
 const invitation = confirmReject;
 if (!invitation) return;

 try {
 await updateDoc(doc(db, 'admin_invitations', invitation.id), {
 status: 'rejected',
 rejectedAt: Timestamp.now(),
 rejectedBy: auth.currentUser?.uid,
 });

 await loadInvitations();
 setConfirmReject(null);
 alert(t('basvuru_reddedildi'));
 } catch (error) {
 console.error('Reject error:', error);
 }
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="bg-red-700 text-white">
 <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
 <div className="flex items-center space-x-3">
 <Link href="/admin/dashboard" className="text-red-200 hover:text-white">
 ← Dashboard
 </Link>
 </div>
 <h1 className="font-bold">{t('super_admin_yonetimi')}</h1>
 <div></div>
 </div>
 </header>

 {/* Tabs */}
 <div className="max-w-4xl mx-auto px-4 pt-6">
 <div className="flex space-x-2 mb-6">
 <button
 onClick={() => setActiveTab('invite')}
 className={`px-6 py-3 rounded-lg font-medium transition ${activeTab === 'invite' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-gray-700'
 }`}
 >
 {t('yeni_davet')}
 </button>
 <button
 onClick={() => setActiveTab('pending')}
 className={`px-6 py-3 rounded-lg font-medium transition relative ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-gray-700'
 }`}
 >
 {t('onay_bekleyenler')}
 {pendingApprovals.length > 0 && (
 <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
 {pendingApprovals.length}
 </span>
 )}
 </button>
 <button
 onClick={() => setActiveTab('superadmins')}
 className={`px-6 py-3 rounded-lg font-medium transition ${activeTab === 'superadmins' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-gray-700'
 }`}
 >
 {t('mevcut_super_adminler')}
 </button>
 </div>
 </div>

 <main className="max-w-4xl mx-auto px-4 pb-8">
 {/* Invite Tab */}
 {activeTab === 'invite' && (
 <div className="bg-card rounded-xl p-6">
 <h2 className="text-xl font-bold text-foreground mb-4">{t('yeni_super_admin_davet_et')}</h2>
 <p className="text-muted-foreground mb-6">
 {t('davet_edilen_kisi_48_saat_icinde_linke_t')}
 </p>

 <div className="space-y-4">
 <div>
 <label className="block text-foreground text-sm mb-2">{t('eposta_adresi')}</label>
 <input
 type="email"
 value={newEmail}
 onChange={(e) => setNewEmail(e.target.value)}
 placeholder="ornek@email.com"
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
 />
 </div>

 <div>
 <label className="block text-foreground text-sm mb-2">{t('role_label')}</label>
 <select
 value={inviteRole}
 onChange={(e) => setInviteRole(e.target.value as 'super_admin' | 'admin')}
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
 >
 <option value="super_admin">👑 Super Admin</option>
 <option value="admin">👤 Normal Admin</option>
 </select>
 </div>

 <button
 onClick={handleInvite}
 disabled={sending || !newEmail.trim()}
 className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
 >
 {sending ? t('gonderiliyor') : t('davetiye_gonder')}
 </button>
 </div>

 {/* Recent Invitations */}
 {invitations.length > 0 && (
 <div className="mt-8">
 <h3 className="text-foreground font-semibold mb-3">{t('recent_invitations')}</h3>
 <div className="space-y-2">
 {invitations.slice(0, 5).map((inv) => (
 <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
 <div>
 <p className="text-foreground">{inv.email}</p>
 <p className="text-muted-foreground text-xs">
 {inv.createdAt?.toLocaleDateString('de-DE')} • {inv.role}
 </p>
 </div>
 <span className={`px-2 py-1 rounded text-xs ${inv.status === 'approved' ? 'bg-green-600' :
 inv.status === 'rejected' ? 'bg-red-600' :
 inv.status === 'registered' ? 'bg-yellow-600' :
 'bg-gray-600'
 } text-white`}>
 {inv.status === 'pending' ? t('bekliyor') :
 inv.status === 'registered' ? t('kayit_oldu') :
 inv.status === 'approved' ? t('onaylandi') : t('reddedildi')}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Pending Approvals Tab */}
 {activeTab === 'pending' && (
 <div className="bg-card rounded-xl p-6">
 <h2 className="text-xl font-bold text-foreground mb-4">{t('onay_bekleyen_basvurular')}</h2>

 {pendingApprovals.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <p className="text-4xl mb-4">✓</p>
 <p>{t('onay_bekleyen_basvuru_yok')}</p>
 </div>
 ) : (
 <div className="space-y-4">
 {pendingApprovals.map((inv) => (
 <div key={inv.id} className="bg-gray-700 rounded-xl p-4">
 <div className="flex items-start justify-between mb-4">
 <div>
 <p className="text-foreground font-semibold text-lg">{inv.email}</p>
 <p className="text-muted-foreground text-sm">
 {t('davet_eden')}: {inv.invitedByEmail} • {inv.createdAt?.toLocaleDateString('de-DE')}
 </p>
 </div>
 <span className="px-3 py-1 bg-yellow-600 text-white rounded text-sm">
 {t('onay_bekliyor')}
 </span>
 </div>

 {inv.registrationData && (
 <div className="bg-card rounded-lg p-4 mb-4">
 <h4 className="text-foreground font-medium mb-3">{t('kayit_bilgileri')}</h4>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <span className="text-muted-foreground">{t('full_name')}</span>
 <span className="text-white ml-2">
 {inv.registrationData.firstName} {inv.registrationData.lastName}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground">{t('phone')}</span>
 <span className="text-white ml-2">{inv.registrationData.phone}</span>
 </div>
 <div>
 <span className="text-muted-foreground">{t('dogum_tarihi')}</span>
 <span className="text-white ml-2">{inv.registrationData.dateOfBirth}</span>
 </div>
 <div className="col-span-2">
 <span className="text-muted-foreground">{t('address')}</span>
 <span className="text-white ml-2">
 {inv.registrationData.address.street} {inv.registrationData.address.houseNumber},
 {inv.registrationData.address.postalCode} {inv.registrationData.address.city}
 </span>
 </div>
 </div>
 </div>
 )}

 <div className="flex space-x-3">
 <button
 onClick={() => handleApprove(inv)}
 className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
 >
 {t('onayla')}
 </button>
 <button
 onClick={() => handleReject(inv)}
 className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700"
 >
 {t('reddet')}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Super Admins Tab */}
 {activeTab === 'superadmins' && (
 <div className="bg-card rounded-xl p-6">
 <h2 className="text-xl font-bold text-foreground mb-4">{t('existing_super_admins')}</h2>
 <div className="space-y-2">
 {superAdmins.map((email, index) => (
 <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
 <div className="flex items-center space-x-3">
 <span className="text-2xl">👑</span>
 <span className="text-foreground">{email}</span>
 </div>
 <span className="px-3 py-1 bg-green-600 text-white rounded text-sm">{t('aktif')}</span>
 </div>
 ))}
 </div>
 <p className="text-muted-foreground text-sm mt-4">
 {t('not_super_admin_listesi_config_ts_dosyas')}
 </p>
 </div>
 )}
 </main>

 {/* Approve Confirmation Modal */}
 <ConfirmModal
 isOpen={!!confirmApprove}
 onClose={() => setConfirmApprove(null)}
 onConfirm={handleApproveConfirm}
 title={t('admin_onayla')}
 message={t('bu_kisiyi_super_admin_olarak_onaylamak_i')}
 itemName={confirmApprove?.email}
 variant="warning"
 confirmText={t('evet_onayla')}
 loadingText={t('onaylaniyor')}
 />

 {/* Reject Confirmation Modal */}
 <ConfirmModal
 isOpen={!!confirmReject}
 onClose={() => setConfirmReject(null)}
 onConfirm={handleRejectConfirm}
 title={t('basvuruyu_reddet')}
 message={t('bu_kisinin_basvurusunu_reddetmek_istedig')}
 itemName={confirmReject?.email}
 variant="danger"
 confirmText={t('evet_reddet')}
 loadingText={t('reddediliyor')}
 />
 </div>
 );
}
