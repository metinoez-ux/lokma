import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/services/auth_service.dart';
import 'package:lokma_app/services/user_service.dart';
import 'package:lokma_app/models/app_user.dart';

// Auth State
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;
  final String? forceLogoutReason;

  const AuthState({
    this.user,
    this.appUser,
    this.isLoading = false,
    this.error,
    this.forceLogoutReason,
  });

  final AppUser? appUser;

  bool get isGuest => user?.isAnonymous ?? false;
  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    AppUser? appUser,
    bool? isLoading,
    String? error,
    String? forceLogoutReason,
  }) {
    return AuthState(
      user: user ?? this.user,
      appUser: appUser ?? this.appUser,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      forceLogoutReason: forceLogoutReason,
    );
  }
}

// Auth Notifier
// Auth Notifier
class AuthNotifier extends Notifier<AuthState> {
  late final AuthService _authService;
  late final UserService _userService;
  StreamSubscription? _forceLogoutSub;

  @override
  AuthState build() {
    _authService = ref.read(authServiceProvider);
    _userService = UserService();
    _init();
    return const AuthState();
  }

  void _init() {
    final sub = _authService.authStateChanges.listen((user) async {
      AppUser? appUser;
      if (user != null) {
        try {
          appUser = await _userService.createOrUpdateUser(user);
        } catch (e) {
          // Handle error silently or log
          print('Error fetching app user: $e');
        }
        // Start listening for force logout
        _startForceLogoutListener(user.uid);
      } else {
        // Stop listening when user logs out
        _stopForceLogoutListener();
      }
      state = AuthState(user: user, appUser: appUser, isLoading: false);
    });
    ref.onDispose(() {
      sub.cancel();
      _stopForceLogoutListener();
    });
  }

  /// Listen to force_logout/{uid} document - triggers immediate logout
  /// when a super admin deletes this user's account
  void _startForceLogoutListener(String uid) {
    _stopForceLogoutListener();
    _forceLogoutSub = FirebaseFirestore.instance
        .collection('force_logout')
        .doc(uid)
        .snapshots()
        .listen((snapshot) {
      if (snapshot.exists) {
        final reason = snapshot.data()?['reason'] as String? ?? 'account_deleted';
        print('Force logout detected for $uid: $reason');
        _handleForceLogout(reason);
      }
    }, onError: (e) {
      // Silently handle - document may not exist yet
      print('Force logout listener error: $e');
    });
  }

  void _stopForceLogoutListener() {
    _forceLogoutSub?.cancel();
    _forceLogoutSub = null;
  }

  Future<void> _handleForceLogout(String reason) async {
    _stopForceLogoutListener();
    state = AuthState(
      user: null,
      appUser: null,
      isLoading: false,
      forceLogoutReason: reason,
    );
    try {
      await _authService.logout();
    } catch (e) {
      print('Error during force logout: $e');
    }
  }

  Future<void> loginWithEmail(String email, String password) async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.loginWithEmail(email, password);
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> registerWithEmail(String email, String password, {String? gender}) async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      final cred = await _authService.registerWithEmail(email, password);
      if (gender != null && cred.user != null) {
        // Cinsiyeti kayıt işlemi sonrası doğrudan veritabanına ekle
        await FirebaseFirestore.instance
            .collection('users')
            .doc(cred.user!.uid)
            .set({'gender': gender}, SetOptions(merge: true));
      }
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> signInWithGoogle() async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      final result = await _authService.signInWithGoogle();
      if (result == null) {
        // User canceled the sign-in flow
        state = AuthState(user: state.user, isLoading: false);
      }
      // State updated via listener otherwise
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> signInAnonymously() async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.signInAnonymously();
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required PhoneCodeSent codeSent,
    required PhoneVerificationFailed verificationFailed,
    required PhoneVerificationCompleted verificationCompleted,
    required PhoneCodeAutoRetrievalTimeout codeAutoRetrievalTimeout,
  }) async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.sendSmsCode(
        phoneNumber: phoneNumber,
        codeSent: codeSent,
        verificationFailed: (e) {
          state = AuthState(user: state.user, isLoading: false, error: e.message);
          verificationFailed(e);
        },
        verificationCompleted: verificationCompleted,
        codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
      );
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> signInWithSmsCode(String verificationId, String smsCode) async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.signInWithSmsCode(verificationId, smsCode);
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> logout() async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.logout();
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }
  
  void clearError() {
    state = AuthState(user: state.user, isLoading: state.isLoading, error: null);
  }
  
  /// Profil güncellemesi sonrası appUser'ı Firestore'dan yeniden yükle
  Future<void> refreshAppUser() async {
    if (state.user == null) return;
    
    try {
      final appUser = await _userService.getUser(state.user!.uid);
      state = AuthState(user: state.user, appUser: appUser, isLoading: false);
    } catch (e) {
      print('Error refreshing app user: $e');
    }
  }
}

// Providers
final authServiceProvider = Provider<AuthService>((ref) => AuthService());

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
