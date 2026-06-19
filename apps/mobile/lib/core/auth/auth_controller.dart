import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';
import 'auth_session.dart';

enum AuthStatus {
  loading,
  unauthenticated,
  authenticated,
  biometricLocked,
  reauthRequired,
}

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.pendingRoute,
  });

  final AuthStatus status;
  final AuthSession? session;
  final String? pendingRoute;

  bool get isConnected => session?.isConnected ?? false;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    String? pendingRoute,
    bool clearSession = false,
    bool clearPendingRoute = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: clearSession ? null : (session ?? this.session),
      pendingRoute: clearPendingRoute ? null : (pendingRoute ?? this.pendingRoute),
    );
  }
}

class AuthController extends Notifier<AuthState> {
  late AuthRepository _repository;

  @override
  AuthState build() {
    _repository = ref.read(authRepositoryProvider);
    _bootstrap();
    return const AuthState(status: AuthStatus.loading);
  }

  Future<void> _bootstrap() async {
    final session = await _repository.loadSession();
    if (session == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }

    final biometricEnabled = await _repository.isBiometricEnabled();
    final pendingRoute = await _repository.loadPendingRoute();

    state = AuthState(
      status: biometricEnabled ? AuthStatus.biometricLocked : AuthStatus.authenticated,
      session: session,
      pendingRoute: pendingRoute,
    );
  }

  Future<AuthSession> completeConnect(String connectToken) async {
    final session = await _repository.exchangeConnectToken(connectToken);
    final pendingRoute = await _repository.loadPendingRoute();

    state = AuthState(
      status: AuthStatus.authenticated,
      session: session,
      pendingRoute: pendingRoute,
    );

    await _repository.clearPendingRoute();
    return session;
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> requireReauth({String? returnTo}) async {
    final shopDomain = state.session?.shopDomain;
    final route = returnTo ?? state.pendingRoute;
    if (route != null) {
      await _repository.savePendingRoute(route);
    }

    await _repository.clearSession();

    state = AuthState(
      status: AuthStatus.reauthRequired,
      session: shopDomain == null
          ? null
          : AuthSession(
              accessToken: '',
              refreshToken: '',
              storeId: '',
              shopDomain: shopDomain,
            ),
      pendingRoute: route,
    );
  }

  Future<void> enableBiometric() async {
    await _repository.setBiometricEnabled(true);
    if (state.session != null) {
      state = state.copyWith(status: AuthStatus.authenticated);
    }
  }

  Future<void> disableBiometric() async {
    await _repository.setBiometricEnabled(false);
  }

  Future<void> lockForBiometric() async {
    if (state.session == null) return;
    final enabled = await _repository.isBiometricEnabled();
    if (!enabled) return;

    state = state.copyWith(status: AuthStatus.biometricLocked);
  }

  void unlock() {
    if (state.session == null) return;
    state = state.copyWith(status: AuthStatus.authenticated);
  }

  Future<void> refreshSession() async {
    final session = await _repository.loadSession();
    if (session == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }

    state = state.copyWith(session: session, status: AuthStatus.authenticated);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
