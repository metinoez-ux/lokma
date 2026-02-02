import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/services/auth_service.dart';
import 'package:lokma_app/services/user_service.dart';
import 'package:lokma_app/models/app_user.dart';

// Auth State
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.appUser,
    this.isLoading = false,
    this.error,
  });

  final AppUser? appUser;

  bool get isGuest => user?.isAnonymous ?? false;
  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    AppUser? appUser,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      appUser: appUser ?? this.appUser,
      isLoading: isLoading ?? this.isLoading,
      error: error, // Error is nullable, so if not provided it remains null? No, we want to clear it usually. 
                    // Actually let's say if passed as null it clears, if not passed it keeps? 
                    // Standard copyWith usually keeps if null. 
                    // Let's simplify: explicit null to clear.
      // But here I'll just replace it.
    );
  }
}

// Auth Notifier
// Auth Notifier
class AuthNotifier extends Notifier<AuthState> {
  late final AuthService _authService;
  late final UserService _userService;

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
      }
      state = AuthState(user: user, appUser: appUser, isLoading: false);
    });
    ref.onDispose(sub.cancel);
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

  Future<void> registerWithEmail(String email, String password) async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.registerWithEmail(email, password);
      // State updated via listener
    } catch (e) {
      state = AuthState(user: state.user, isLoading: false, error: e.toString());
    }
  }

  Future<void> signInWithGoogle() async {
    state = AuthState(user: state.user, isLoading: true);
    try {
      await _authService.signInWithGoogle();
      // State updated via listener
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
