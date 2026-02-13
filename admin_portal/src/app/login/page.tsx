'use client';

import { useState, useEffect, useRef } from 'react';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { isSuperAdmin } from '@/lib/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Country codes for phone input
const countryCodes = [
    { code: '+49', country: '🇩🇪', name: 'Almanya' },
    { code: '+90', country: '🇹🇷', name: 'Türkiye' },
    { code: '+43', country: '🇦🇹', name: 'Avusturya' },
    { code: '+41', country: '🇨🇭', name: 'İsviçre' },
    { code: '+31', country: '🇳🇱', name: 'Hollanda' },
    { code: '+32', country: '🇧🇪', name: 'Belçika' },
    { code: '+33', country: '🇫🇷', name: 'Fransa' },
];

export default function LoginPage() {
    // Email auth state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [name, setName] = useState(''); // For phone auth compatibility
    const [isRegister, setIsRegister] = useState(false);

    // Phone auth state
    const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('+49');
    const [otpCode, setOtpCode] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    // Common state
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [logoutReason, setLogoutReason] = useState<string | null>(null);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
    const router = useRouter();

    // Handle forgot password
    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setError('Lütfen önce e-posta adresinizi girin.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email.trim());
            setResetEmailSent(true);
            setError('');
        } catch (err: unknown) {
            console.error('Password reset error:', err);
            if (err instanceof Error) {
                if (err.message.includes('auth/user-not-found')) {
                    setError('Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.');
                } else if (err.message.includes('auth/invalid-email')) {
                    setError('Geçersiz e-posta adresi.');
                } else if (err.message.includes('auth/too-many-requests')) {
                    setError('Çok fazla deneme. Lütfen bir süre bekleyin.');
                } else {
                    setError('Şifre sıfırlama e-postası gönderilemedi.');
                }
            }
        }
        setLoading(false);
    };

    // Check for logout reason on mount (from forced logout)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const reason = sessionStorage.getItem('logout_reason');
            if (reason) {
                setLogoutReason(reason);
                sessionStorage.removeItem('logout_reason');
            }
        }
    }, []);

    // Helper: determine redirect path based on role
    const getAdminRedirectPath = (role?: string, adminType?: string) => {
        if (role === 'super_admin' || adminType === 'super_admin') return '/admin/analytics';
        return '/admin/orders';
    };

    // Check if user is already logged in
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is already logged in, redirect them
                console.log('Login page - User already logged in:', user.email);
                if (isSuperAdmin(user.email)) {
                    console.log('Login page - Redirecting super admin to analytics');
                    router.push('/admin/analytics');
                } else {
                    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                    if (adminDoc.exists() && adminDoc.data().isActive) {
                        const data = adminDoc.data();
                        router.push(getAdminRedirectPath(data.role, data.adminType));
                    } else {
                        router.push('/profile');
                    }
                }
            } else {
                setCheckingAuth(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleUserRedirect = async (userId: string, userEmail: string | null, userPhone?: string | null) => {
        // Check if super admin by email whitelist
        if (isSuperAdmin(userEmail)) {
            router.push('/admin/analytics');
            return;
        }

        const { getDocs, collection, query, where, updateDoc } = await import('firebase/firestore');

        // STRATEGY 1: Check by Firebase UID (document ID)
        const adminDocById = await getDoc(doc(db, 'admins', userId));
        if (adminDocById.exists() && adminDocById.data().isActive) {
            const adminData = adminDocById.data();
            console.log('Found admin by UID:', userId, 'adminType:', adminData.adminType);
            // Role-based redirect
            router.push(getAdminRedirectPath(adminData.role, adminData.adminType));
            return;
        }

        // STRATEGY 2: Check by firebaseUid field (linked accounts)
        const uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', userId));
        const uidSnapshot = await getDocs(uidQuery);
        if (!uidSnapshot.empty) {
            const adminData = uidSnapshot.docs[0].data();
            if (adminData.isActive) {
                console.log('Found admin by firebaseUid field:', userId);
                // Role-based redirect
                router.push(getAdminRedirectPath(adminData.role, adminData.adminType));
                return;
            }
        }

        // STRATEGY 3: Check by email
        if (userEmail) {
            const emailQuery = query(collection(db, 'admins'), where('email', '==', userEmail));
            const emailSnapshot = await getDocs(emailQuery);

            if (!emailSnapshot.empty) {
                const matchedAdmin = emailSnapshot.docs[0];
                const adminData = matchedAdmin.data();

                // Link this Firebase UID to the admin record
                console.log('Found admin by email:', userEmail, '- Linking UID:', userId);
                await updateDoc(doc(db, 'admins', matchedAdmin.id), {
                    firebaseUid: userId,
                    isActive: true,
                    lastLoginAt: new Date(),
                    linkedVia: 'email_login',
                    // CRITICAL: Save Google profile picture to admin record for header display
                    photoURL: auth.currentUser?.photoURL || adminData.photoURL || null,
                    displayName: auth.currentUser?.displayName || adminData.displayName || null,
                });

                // Also update/merge the users record to link with admin
                const { setDoc } = await import('firebase/firestore');
                await setDoc(doc(db, 'users', userId), {
                    adminId: matchedAdmin.id,
                    isAdmin: true,
                    adminType: adminData.adminType || adminData.type,
                    email: userEmail,
                    phoneNumber: adminData.phoneNumber || null,
                    displayName: adminData.displayName || adminData.name || auth.currentUser?.displayName || `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim(),
                    firstName: adminData.firstName || auth.currentUser?.displayName?.split(' ')[0] || null,
                    lastName: adminData.lastName || auth.currentUser?.displayName?.split(' ').slice(1).join(' ') || null,
                    photoURL: auth.currentUser?.photoURL || null, // CRITICAL: Save Google profile picture
                    lastLoginAt: new Date(),
                    linkedFromAdmin: true,
                }, { merge: true });
                console.log('📸 Admin linked with photoURL:', auth.currentUser?.photoURL);

                // Role-based redirect
                router.push(getAdminRedirectPath(adminData.role, adminData.adminType));
                return;
            }
        }

        // STRATEGY 4: Check by phone number (if available from auth)
        if (userPhone) {
            const normalizedPhone = userPhone.replace(/[\s\-()]/g, '');
            const phoneVariations = [
                normalizedPhone,
                normalizedPhone.replace(/^\+/, ''),
                userPhone,
            ];

            for (const phoneVar of phoneVariations) {
                const phoneQuery = query(collection(db, 'admins'), where('phoneNumber', '==', phoneVar));
                const phoneSnapshot = await getDocs(phoneQuery);

                if (!phoneSnapshot.empty) {
                    const matchedAdmin = phoneSnapshot.docs[0];
                    const adminData = matchedAdmin.data();

                    console.log('Found admin by phone:', phoneVar, '- Linking UID:', userId);

                    // Update admin record with new Firebase UID
                    await updateDoc(doc(db, 'admins', matchedAdmin.id), {
                        firebaseUid: userId,
                        isActive: true,
                        lastLoginAt: new Date(),
                        linkedVia: 'phone_login',
                        // Save profile picture to admin record for header display
                        photoURL: auth.currentUser?.photoURL || adminData.photoURL || null,
                        displayName: auth.currentUser?.displayName || adminData.displayName || null,
                    });

                    // Also update/merge the users record to link with admin
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(doc(db, 'users', userId), {
                        adminId: matchedAdmin.id,
                        isAdmin: true,
                        adminType: adminData.adminType || adminData.type,
                        email: adminData.email || null,
                        phoneNumber: userPhone,
                        displayName: adminData.displayName || adminData.name || auth.currentUser?.displayName || `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim(),
                        firstName: adminData.firstName || auth.currentUser?.displayName?.split(' ')[0] || null,
                        lastName: adminData.lastName || auth.currentUser?.displayName?.split(' ').slice(1).join(' ') || null,
                        photoURL: auth.currentUser?.photoURL || null, // Save profile picture
                        lastLoginAt: new Date(),
                        linkedFromAdmin: true,
                    }, { merge: true });

                    // Role-based redirect
                    router.push(getAdminRedirectPath(matchedAdminData.role, matchedAdminData.adminType));
                    return;
                }
            }
        }

        // No admin match found - ensure user is in users collection for visibility
        console.log('No admin match found for user:', userId, userEmail, userPhone);

        // Create or update user record in users collection so they appear in admin panel
        const { setDoc, getDoc: getDocFn } = await import('firebase/firestore');
        const userDocRef = doc(db, 'users', userId);
        const existingUser = await getDocFn(userDocRef);

        if (!existingUser.exists()) {
            // Create new user record
            await setDoc(userDocRef, {
                email: userEmail || null,
                phoneNumber: userPhone || null,
                displayName: auth.currentUser?.displayName || userEmail?.split('@')[0] || 'MIRA Kullanıcı',
                firstName: auth.currentUser?.displayName?.split(' ')[0] || null,
                lastName: auth.currentUser?.displayName?.split(' ').slice(1).join(' ') || null,
                photoURL: auth.currentUser?.photoURL || null, // CRITICAL: Save Google profile picture
                createdAt: new Date().toISOString(),
                createdVia: 'miraportal_login',
                isAdmin: false,
                lastLoginAt: new Date().toISOString(),
            });
            console.log('Created new user record for:', userId, 'with photoURL:', auth.currentUser?.photoURL);
        } else {
            // Update last login time and sync profile picture from OAuth
            const { updateDoc: updateDocFn } = await import('firebase/firestore');
            const existingData = existingUser.data();
            const updateData: Record<string, unknown> = {
                lastLoginAt: new Date().toISOString(),
            };
            // If user logged in with Google and no photoURL saved, save it now
            if (auth.currentUser?.photoURL && !existingData.photoURL) {
                updateData.photoURL = auth.currentUser.photoURL;
                console.log('📸 Updated missing photoURL from Google:', auth.currentUser.photoURL);
            }
            // Also sync displayName/firstName/lastName if missing
            if (auth.currentUser?.displayName && !existingData.firstName) {
                updateData.firstName = auth.currentUser.displayName.split(' ')[0];
                updateData.lastName = auth.currentUser.displayName.split(' ').slice(1).join(' ') || null;
            }
            await updateDocFn(userDocRef, updateData);
        }

        router.push('/profile');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await handleUserRedirect(userCredential.user.uid, userCredential.user.email);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-credential')) {
                    setError('E-posta veya şifre hatalı.');
                } else if (err.message.includes('auth/user-not-found')) {
                    setError('Bu e-posta ile kayıtlı kullanıcı bulunamadı.');
                } else {
                    setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
                }
            }
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            await handleUserRedirect(result.user.uid, result.user.email);
        } catch (err) {
            console.error('Google login error:', err);
            setError('Google ile giriş yapılamadı.');
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const provider = new OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            const result = await signInWithPopup(auth, provider);
            await handleUserRedirect(result.user.uid, result.user.email);
        } catch (err) {
            console.error('Apple login error:', err);
            setError('Apple ile giriş yapılamadı.');
            setLoading(false);
        }
    };

    // Initialize RecaptchaVerifier - always reinitialize for fresh state
    const initRecaptcha = async () => {
        if (!recaptchaContainerRef.current) return;

        // Clear any existing recaptcha
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (e) {
                console.log('Recaptcha clear warning:', e);
            }
            recaptchaVerifierRef.current = null;
        }

        // Clear the container
        if (recaptchaContainerRef.current) {
            recaptchaContainerRef.current.innerHTML = '';
        }

        try {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
                size: 'invisible',
                callback: () => {
                    console.log('reCAPTCHA verified successfully');
                },
                'expired-callback': () => {
                    console.log('reCAPTCHA expired - clearing for retry');
                    recaptchaVerifierRef.current = null;
                    setError('Güvenlik doğrulaması süresi doldu. Lütfen tekrar deneyin.');
                }
            });

            // Pre-render the widget
            await recaptchaVerifierRef.current.render();
            console.log('reCAPTCHA initialized and rendered');
        } catch (e) {
            console.error('reCAPTCHA initialization error:', e);
            recaptchaVerifierRef.current = null;
        }
    };

    // Send OTP to phone
    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\s/g, '')}`;

        // Simple validation
        if (phoneNumber.length < 6) {
            setError('Geçerli bir telefon numarası girin.');
            setLoading(false);
            return;
        }

        try {
            await initRecaptcha();

            if (!recaptchaVerifierRef.current) {
                setError('Güvenlik doğrulaması başlatılamadı. Sayfayı yenileyin.');
                setLoading(false);
                return;
            }

            const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifierRef.current);
            setConfirmationResult(confirmation);
            setShowOtpInput(true);
            setLoading(false);
        } catch (err: unknown) {
            console.error('Send OTP error:', err);
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-phone-number')) {
                    setError('Geçersiz telefon numarası formatı.');
                } else if (err.message.includes('auth/too-many-requests')) {
                    setError('Çok fazla deneme. Lütfen bir süre bekleyin.');
                } else if (err.message.includes('auth/quota-exceeded')) {
                    setError('SMS kotası doldu. Lütfen daha sonra tekrar deneyin.');
                } else {
                    setError('SMS gönderilemedi. Lütfen tekrar deneyin.');
                }
            }
            // Reset recaptcha for retry
            recaptchaVerifierRef.current = null;
            setLoading(false);
        }
    };

    // Verify OTP code
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (otpCode.length !== 6) {
            setError('6 haneli doğrulama kodunu girin.');
            setLoading(false);
            return;
        }

        try {
            if (!confirmationResult) {
                setError('Doğrulama süresi dolmuş. Tekrar SMS gönderin.');
                setLoading(false);
                return;
            }

            const result = await confirmationResult.confirm(otpCode);
            const user = result.user;
            const phoneNumber = user.phoneNumber;

            console.log('Phone auth successful:', user.uid, phoneNumber);

            // PRIORITY: Check if this phone number belongs to an admin FIRST
            // This prevents creating a generic "MIRA Kullanıcı" entry for admin users
            let matchedAdminDoc = null;
            let matchedAdminData: any = null;

            if (phoneNumber) {
                const { getDocs, collection, query, where, updateDoc } = await import('firebase/firestore');

                // Normalize phone for comparison
                const normalizedPhone = phoneNumber.replace(/[\s\-()]/g, '');
                const phoneWithoutPlus = normalizedPhone.replace(/^\+/, '');
                const phoneDigitsOnly = phoneNumber.replace(/\D/g, '');

                // Generate phone variations to search
                const phoneVariations = [
                    normalizedPhone,                                    // +491784443475
                    phoneWithoutPlus,                                   // 491784443475
                    phoneNumber,                                        // original format
                    `+${phoneDigitsOnly}`,                              // +491784443475
                    phoneDigitsOnly,                                    // 491784443475
                    // German format variations
                    normalizedPhone.replace(/^(\+49)0?/, '+49'),        // normalize German leading 0
                    phoneWithoutPlus.replace(/^490?/, '49'),            // 49178...
                ];

                // Remove duplicates
                const uniquePhones = [...new Set(phoneVariations.filter(Boolean))];
                console.log('Searching for admin with phone variations:', uniquePhones);

                // Search for matching admin FIRST
                for (const phoneVar of uniquePhones) {
                    const adminsQuery = query(
                        collection(db, 'admins'),
                        where('phoneNumber', '==', phoneVar)
                    );
                    const adminsSnapshot = await getDocs(adminsQuery);

                    if (!adminsSnapshot.empty) {
                        matchedAdminDoc = adminsSnapshot.docs[0];
                        matchedAdminData = matchedAdminDoc.data();
                        console.log('Found admin match with phone format:', phoneVar, 'Admin:', matchedAdminData.displayName);
                        break;
                    }
                }

                if (matchedAdminDoc) {
                    // Found matching admin record - activate and link UID
                    console.log('Linking admin profile:', matchedAdminDoc.id, 'to Firebase UID:', user.uid);

                    await updateDoc(doc(db, 'admins', matchedAdminDoc.id), {
                        isActive: true,
                        tempPasswordRequired: false,
                        firebaseUid: user.uid,
                        activatedAt: new Date(),
                        lastLoginAt: new Date(),
                        linkedVia: 'phone_login',
                    });
                }
            }

            // Now handle users collection - use admin data if available
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (!userDoc.exists()) {
                // New user - create profile with admin data if available
                // Use firstName/lastName from state, or from matched admin data
                const userFirstName = matchedAdminData?.firstName || firstName.trim() || '';
                const userLastName = matchedAdminData?.lastName || lastName.trim() || '';
                const fullName = `${userFirstName} ${userLastName}`.trim() || 'LOKMA Kullanıcı';

                await setDoc(doc(db, 'users', user.uid), {
                    phoneNumber: phoneNumber,
                    displayName: fullName,
                    firstName: userFirstName,
                    lastName: userLastName,
                    email: matchedAdminData?.email || null,
                    createdAt: new Date().toISOString(),
                    createdVia: 'lokma_sms',
                    isAdmin: !!matchedAdminData,
                    adminType: matchedAdminData?.adminType || null,
                    butcherId: matchedAdminData?.butcherId || null,
                });

                // Update display name in Auth (use admin name if available)
                if (fullName && fullName !== 'LOKMA Kullanıcı') {
                    await updateProfile(user, { displayName: fullName });
                }
            } else if (matchedAdminData) {
                // User exists but we found a matching admin - update with admin info
                const existingData = userDoc.data();
                const { updateDoc } = await import('firebase/firestore');

                await updateDoc(doc(db, 'users', user.uid), {
                    displayName: matchedAdminData.displayName || existingData.displayName,
                    isAdmin: true,
                    adminType: matchedAdminData.adminType,
                    butcherId: matchedAdminData.butcherId || null,
                    lastLoginAt: new Date().toISOString(),
                });

                // Update display name in Auth
                if (matchedAdminData.displayName) {
                    await updateProfile(user, { displayName: matchedAdminData.displayName });
                }
            }

            // Redirect based on admin status
            if (matchedAdminData) {
                console.log('Phone matched admin record:', matchedAdminDoc!.id, 'adminType:', matchedAdminData.adminType);

                // Role-based redirect
                router.push(getAdminRedirectPath(matchedAdminData.role, matchedAdminData.adminType));
                return;
            }

            // Normal user redirect
            await handleUserRedirect(user.uid, user.email);
        } catch (err: unknown) {
            console.error('Verify OTP error:', err);
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-verification-code')) {
                    setError('Yanlış doğrulama kodu. Tekrar deneyin.');
                } else if (err.message.includes('auth/code-expired')) {
                    setError('Doğrulama kodunun süresi doldu. Yeni kod gönderin.');
                    setShowOtpInput(false);
                    setConfirmationResult(null);
                } else {
                    setError('Doğrulama başarısız. Lütfen tekrar deneyin.');
                }
            }
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!firstName.trim() || !lastName.trim()) {
            setError('Ad ve Soyad gereklidir.');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır.');
            setLoading(false);
            return;
        }

        try {
            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Combine firstName and lastName for displayName
            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

            // Update display name
            await updateProfile(userCredential.user, {
                displayName: fullName
            });

            // Save to users collection in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email: email,
                displayName: fullName,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                createdAt: new Date().toISOString(),
                createdVia: 'lokma_web',
                isAdmin: false,
                emailVerified: false,
            });

            // Send email verification
            await sendEmailVerification(userCredential.user);

            console.log('User registered successfully, verification email sent:', userCredential.user.uid);

            // Show success message and redirect
            alert('✅ Hesap oluşturuldu! Lütfen e-posta adresinize gelen doğrulama linkine tıklayın.');
            router.push('/login');
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('auth/email-already-in-use')) {
                    setError('Bu e-posta adresi zaten kullanılıyor.');
                } else if (err.message.includes('auth/weak-password')) {
                    setError('Şifre çok zayıf. En az 6 karakter olmalıdır.');
                } else if (err.message.includes('auth/invalid-email')) {
                    setError('Geçersiz e-posta adresi.');
                } else {
                    setError('Hesap oluşturulamadı. Lütfen tekrar deneyin.');
                }
            }
            setLoading(false);
        }
    };

    // Show loading while checking if user is already authenticated
    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#120a0a] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fb335b]"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#120a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Back to Home */}
                <Link href="/" className="inline-flex items-center text-white/60 hover:text-white mb-6">
                    ← Ana Sayfaya Dön
                </Link>

                <div className="bg-[#1a1010] border border-white/10 rounded-2xl shadow-xl p-8">
                    {/* Logo */}
                    <div className="text-center mb-6">
                        <img src="/lokma_logo.png" alt="LOKMA" className="w-16 h-16 mx-auto rounded-2xl mb-4" />
                        <h1 className="text-2xl font-bold text-white">
                            {isRegister ? 'Hesap Oluştur' : 'Hoş Geldiniz'}
                        </h1>
                        <p className="text-white/60 text-sm mt-1">
                            {isRegister ? 'Yeni bir LOKMA hesabı oluşturun' : 'LOKMA hesabınıza giriş yapın'}
                        </p>
                    </div>

                    {/* Login/Register Toggle - Pill Switch */}
                    <div className="relative flex bg-white/10 rounded-full p-1 mb-6 border border-white/10">
                        {/* Sliding Background */}
                        <div
                            className={`absolute top-1 bottom-1 w-1/2 bg-[#fb335b] rounded-full transition-all duration-300 ease-in-out ${isRegister ? 'left-[calc(50%-2px)]' : 'left-1'}`}
                        />
                        <button
                            onClick={() => { setIsRegister(false); setError(''); }}
                            className={`relative z-10 flex-1 py-3 rounded-full font-semibold text-sm transition-colors duration-300 ${!isRegister
                                ? 'text-white'
                                : 'text-white/50 hover:text-white/70'
                                }`}
                        >
                            Giriş Yap
                        </button>
                        <button
                            onClick={() => { setIsRegister(true); setError(''); }}
                            className={`relative z-10 flex-1 py-3 rounded-full font-semibold text-sm transition-colors duration-300 ${isRegister
                                ? 'text-white'
                                : 'text-white/50 hover:text-white/70'
                                }`}
                        >
                            Hesap Oluştur
                        </button>
                    </div>

                    {/* Forced Logout Reason Alert */}
                    {logoutReason && (
                        <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-3">
                            <span className="text-lg">⚠️</span>
                            <div className="flex-1">
                                <p className="font-medium">Oturumunuz sonlandırıldı</p>
                                <p className="text-amber-400/80">{logoutReason}</p>
                            </div>
                            <button
                                onClick={() => setLogoutReason(null)}
                                className="text-amber-400 hover:text-amber-300"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Social Login Buttons */}
                    <div className="space-y-3 mb-6">
                        <button
                            onClick={handleAppleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center space-x-3 bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            <span>Apple ile Giriş Yap</span>
                        </button>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center space-x-3 bg-white/10 border border-white/20 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>Google ile Giriş Yap</span>
                        </button>
                    </div>

                    {/* Auth Method Toggle (Email/Phone) */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => { setAuthMethod('phone'); setError(''); setShowOtpInput(false); }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${authMethod === 'phone'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            📱 Telefon
                        </button>
                        <button
                            onClick={() => { setAuthMethod('email'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${authMethod === 'email'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            ✉️ E-posta
                        </button>
                    </div>

                    {/* Phone Auth Form */}
                    {authMethod === 'phone' && (
                        <>
                            {!showOtpInput ? (
                                <form onSubmit={handleSendOTP} className="space-y-4">
                                    {/* Name fields - ONLY show during registration */}
                                    {isRegister && (
                                        <div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Ad
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={firstName}
                                                        onChange={(e) => setFirstName(e.target.value)}
                                                        className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                                        placeholder="Adınız"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-white/70 mb-1">
                                                        Soyad
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={lastName}
                                                        onChange={(e) => setLastName(e.target.value)}
                                                        className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                                        placeholder="Soyadınız"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Siparişlerinizde ve profilinizde görünecek isim
                                            </p>
                                        </div>
                                    )}

                                    {/* Phone Number with Country Code */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Telefon Numarası
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={countryCode}
                                                onChange={(e) => setCountryCode(e.target.value)}
                                                className="px-3 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white"
                                                title="Ülke kodu seçimi"
                                            >
                                                {countryCodes.map((c) => (
                                                    <option key={c.code} value={c.code}>
                                                        {c.country} {c.code}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                                className="flex-1 px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                                placeholder="178 444 3475"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#fb335b] text-white hover:bg-[#d4223f]"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                SMS gönderiliyor...
                                            </span>
                                        ) : (
                                            '📲 Doğrulama Kodu Gönder'
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOTP} className="space-y-4">
                                    <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
                                        📱 <strong>{countryCode} {phoneNumber}</strong> numarasına SMS gönderildi.
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            6 Haneli Doğrulama Kodu
                                        </label>
                                        <input
                                            type="text"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="w-full px-4 py-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition text-center text-2xl tracking-widest font-mono bg-white/5 text-white"
                                            placeholder="• • • • • •"
                                            maxLength={6}
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || otpCode.length !== 6}
                                        className="w-full py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#fb335b] text-white hover:bg-[#d4223f]"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Doğrulanıyor...
                                            </span>
                                        ) : (
                                            '✓ Doğrula ve Giriş Yap'
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setShowOtpInput(false); setOtpCode(''); setConfirmationResult(null); recaptchaVerifierRef.current = null; }}
                                        className="w-full py-2 text-white/50 hover:text-white/70 text-sm"
                                    >
                                        ← Telefon numarasını değiştir
                                    </button>
                                </form>
                            )}
                            {/* Invisible reCAPTCHA container */}
                            <div ref={recaptchaContainerRef} id="recaptcha-container"></div>
                        </>
                    )}

                    {/* Email Auth Form */}
                    {authMethod === 'email' && (
                        <>
                            {/* Forgot Password Mode UI */}
                            {forgotPasswordMode ? (
                                <div className="space-y-4">
                                    <div className="text-center mb-4">
                                        <div className="text-4xl mb-2">🔐</div>
                                        <h3 className="text-lg font-semibold text-white">Şifrenizi mi unuttunuz?</h3>
                                        <p className="text-sm text-white/60 mt-1">E-posta adresinizi girin, şifre sıfırlama linki göndereceğiz.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1">
                                            E-posta
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                            placeholder="ornek@email.com"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    {/* Password Reset Success Message */}
                                    {resetEmailSent && (
                                        <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                            <span className="text-lg">✉️</span>
                                            <div>
                                                <p className="font-medium">Şifre sıfırlama e-postası gönderildi!</p>
                                                <p className="text-green-400 text-xs">{email} adresine gelen linke tıklayarak yeni şifrenizi belirleyin.</p>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        disabled={loading || !email.trim()}
                                        className="w-full py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#fb335b] text-white hover:bg-[#d4223f]"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Gönderiliyor...
                                            </span>
                                        ) : (
                                            '📧 Şifre Sıfırlama E-postası Gönder'
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotPasswordMode(false);
                                            setResetEmailSent(false);
                                            setError('');
                                        }}
                                        className="w-full py-2 text-white/50 hover:text-white/70 text-sm"
                                    >
                                        ← Giriş ekranına dön
                                    </button>
                                </div>
                            ) : (
                                /* Normal Login/Register Form */
                                <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
                                    {/* Name Fields - only for registration */}
                                    {isRegister && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-1">
                                                    Ad
                                                </label>
                                                <input
                                                    type="text"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                                    placeholder="Adınız"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-1">
                                                    Soyad
                                                </label>
                                                <input
                                                    type="text"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                                    placeholder="Soyadınız"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1">
                                            E-posta
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                            placeholder="ornek@email.com"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1">
                                            Şifre
                                        </label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#fb335b] focus:border-transparent transition bg-white/5 text-white placeholder:text-white/40"
                                            placeholder="••••••••"
                                            required
                                        />
                                        {isRegister ? (
                                            <p className="text-xs text-white/50 mt-1">En az 6 karakter olmalıdır</p>
                                        ) : (
                                            <div className="flex justify-end mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setForgotPasswordMode(true);
                                                        setError('');
                                                    }}
                                                    className="text-xs text-[#fb335b] hover:text-[#ff6b7a] hover:underline"
                                                >
                                                    Şifremi unuttum
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#fb335b] text-white hover:bg-[#d4223f]"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                {isRegister ? 'Hesap oluşturuluyor...' : 'Giriş yapılıyor...'}
                                            </span>
                                        ) : (
                                            isRegister ? 'Hesap Oluştur' : 'Giriş Yap'
                                        )}
                                    </button>
                                </form>
                            )}
                        </>
                    )}

                    {/* Footer */}
                    <p className="text-center text-white/40 text-xs mt-8">
                        Giriş yaparak <Link href="/terms" className="text-[#fb335b] hover:underline">Kullanım Koşullarını</Link> ve{' '}
                        <Link href="/privacy" className="text-[#fb335b] hover:underline">Gizlilik Politikasını</Link> kabul etmiş olursunuz.
                    </p>
                </div>
            </div>
        </div >
    );
}
