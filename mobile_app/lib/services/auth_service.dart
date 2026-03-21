import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // v7: singleton pattern required
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;

  bool _initialized = false;

  // Must be called once before using Google Sign-In
  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await GoogleSignIn.instance.initialize(
      clientId: '259070566992-5oqs2q5tgkrg6rfbddot5fgj08nec03u.apps.googleusercontent.com',
    );
    _initialized = true;
  }

  // Stream of auth changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // Current user
  User? get currentUser => _auth.currentUser;

  // Register with Email & Password
  Future<UserCredential> registerWithEmail(String email, String password) async {
    return await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  // Login with Email & Password
  Future<UserCredential> loginWithEmail(String email, String password) async {
    return await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  // Sign in with Google (v7 API)
  Future<UserCredential?> signInWithGoogle() async {
    try {
      await _ensureInitialized();

      // v7: authenticate() replaces signIn()
      final GoogleSignInAccount? googleUser = await _googleSignIn.authenticate();
      if (googleUser == null) return null; // User canceled

      // v7: authentication is synchronous, accessToken requires separate authorization
      // For Firebase Auth, idToken alone is sufficient
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final AuthCredential credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
      );

      return await _auth.signInWithCredential(credential);
    } catch (e) {
      rethrow;
    }
  }

  // Sign in Anonymously (Guest)
  Future<UserCredential> signInAnonymously() async {
    return await _auth.signInAnonymously();
  }

  // Send SMS Code
  Future<void> sendSmsCode({
    required String phoneNumber,
    required PhoneCodeSent codeSent,
    required PhoneVerificationFailed verificationFailed,
    required PhoneVerificationCompleted verificationCompleted,
    required PhoneCodeAutoRetrievalTimeout codeAutoRetrievalTimeout,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: verificationCompleted,
      verificationFailed: verificationFailed,
      codeSent: codeSent,
      codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
    );
  }

  // Sign in with SMS Code
  Future<UserCredential> signInWithSmsCode(String verificationId, String smsCode) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    return await _auth.signInWithCredential(credential);
  }

  // Reset Password
  Future<void> resetPasswordWithEmail(String email) async {
    await _auth.sendPasswordResetEmail(email: email);
  }

  // Logout
  Future<void> logout() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }
}

