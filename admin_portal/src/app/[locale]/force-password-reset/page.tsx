'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { useAdmin } from '@/components/providers/AdminProvider';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForcePasswordResetPage() {
 const router = useRouter();
 const { admin, refreshAdmin } = useAdmin();

 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 // If suddenly the user loses admin status (e.g. logs out), redirect to login
 useEffect(() => {
 if (admin === null && !loading) {
 router.push('/login');
 }
 }, [admin, router, loading]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);

 if (newPassword.length < 6) {
 setError('Şifre en az 6 karakter olmalıdır.');
 return;
 }

 if (newPassword !== confirmPassword) {
 setError('Şifreler eşleşmiyor.');
 return;
 }

 if (!auth.currentUser) {
 setError('Geçerli oturum bulunamadı. Lütfen tekrar giriş yapın.');
 return;
 }

 setLoading(true);

 try {
 // 1. Update password via Firebase Auth SDK
 await updatePassword(auth.currentUser, newPassword);

 // 2. Clear the requirePasswordChange flag from Firestore via API
 const response = await fetch('/api/admin/clear-password-flag', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ uid: auth.currentUser.uid }),
 });

 if (!response.ok) {
 const data = await response.json();
 throw new Error(data.error || 'Şifre güncellendi ancak bayrak silinemedi.');
 }

 // 3. Success state
 setSuccess(true);
 
 // 4. Force context refresh to load new permissions/flags
 await refreshAdmin();

 // 5. Redirect to Dashboard
 setTimeout(() => {
 router.push('/admin/dashboard');
 }, 2000);

 } catch (err: any) {
 console.error('Password reset error:', err);
 if (err.code === 'auth/requires-recent-login') {
 setError('Güvenlik nedeniyle tekrar giriş yapmanız gerekiyor. Lütfen çıkış yapıp mevcut geçici şifrenizle giriş yapın.');
 } else {
 setError(err.message || 'Şifreniz güncellenemedi.');
 }
 } finally {
 setLoading(false);
 }
 };

 // If the success state is active, show the checkmark
 if (success) {
 return (
 <div className="bg-neutral-800 rounded-2xl shadow-xl border border-neutral-700/50 p-8 text-center space-y-4">
 <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
 <CheckCircle2 className="w-8 h-8 text-green-500" />
 </div>
 <h2 className="text-2xl font-bold text-white">Şifreniz Güncellendi!</h2>
 <p className="text-neutral-400 pb-4">Güvenli bir şekilde sisteme giriş yaptınız. Yönlendiriliyorsunuz...</p>
 </div>
 );
 }

 return (
 <div className="bg-neutral-800 rounded-2xl shadow-xl border border-neutral-700/50 overflow-hidden">
 {/* Header */}
 <div className="bg-red-600 p-6 text-center">
 <div className="bg-background/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
 <Lock className="w-6 h-6 text-white" />
 </div>
 <h2 className="text-xl font-bold text-white">Güvenlik: Şifrenizi Değiştirin</h2>
 <p className="text-red-100 text-sm mt-2 opacity-90">
 Sisteme giriş yapmak için size verilen <strong>geçici şifreyi</strong> yenisiyle değiştirmeniz zorunludur.
 </p>
 </div>

 {/* Content Form */}
 <div className="p-8">
 {error && (
 <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 text-red-500">
 <AlertCircle className="w-5 h-5 shrink-0" />
 <span className="text-sm font-medium">{error}</span>
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="space-y-2">
 <label className="block text-sm font-medium text-neutral-300 mb-1">Yeni Şifreniz</label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={newPassword}
 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
 className="w-full rounded-md border py-3 px-4 bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 pr-10 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-colors"
 placeholder="En az 6 karakter"
 required
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 <div className="space-y-2">
 <label className="block text-sm font-medium text-neutral-300 mb-1">Yeni Şifre (Tekrar)</label>
 <input
 type={showPassword ? 'text' : 'password'}
 value={confirmPassword}
 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
 className="w-full rounded-md border py-3 px-4 bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-colors"
 placeholder="Şifrenizi doğrulayın"
 required
 />
 </div>

 <button
 type="submit"
 disabled={loading || !newPassword || !confirmPassword}
 className="w-full rounded-md border border-transparent bg-red-600 hover:bg-red-700 px-4 py-3 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {loading ? 'Güncelleniyor...' : 'Şifremi Kaydet & Giriş Yap'}
 </button>
 </form>
 </div>
 </div>
 );
}
