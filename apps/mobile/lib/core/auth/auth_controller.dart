import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'auth_providers.dart';
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

    if (AppConfig.canSkipSetup) {
      unawaited(_bootstrap());
      return const AuthState(status: AuthStatus.authenticated, session: AuthRepository.devSession);
    }

    _bootstrap();
    return const AuthState(status: AuthStatus.loading);
  }

  Future<void> _bootstrap() async {
    try {
      AuthSession? session = await _repository
          .loadSession()
          .timeout(const Duration(seconds: 8), onTimeout: () => null);

      if (session == null && AppConfig.canSkipSetup) {
        session = await _repository.seedDevSession();
      }

      if (session == null) {
        state = const AuthState(status: AuthStatus.unauthenticated);
        return;
      }

      final biometricEnabled = AppConfig.canSkipSetup
          ? false
          : await _repository
              .isBiometricEnabled()
              .timeout(const Duration(seconds: 5), onTimeout: () => false);
      final pendingRoute = await _repository
          .loadPendingRoute()
          .timeout(const Duration(seconds: 5), onTimeout: () => null);

      state = AuthState(
        status: biometricEnabled ? AuthStatus.biometricLocked : AuthStatus.authenticated,
        session: session,
        pendingRoute: pendingRoute,
      );
    } catch (_) {
      if (AppConfig.canSkipSetup) {
        final session = await _repository.seedDevSession();
        state = AuthState(status: AuthStatus.authenticated, session: session);
        return;
      }

      state = const AuthState(status: AuthStatus.unauthenticated);
    }
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
    if (AppConfig.canSkipSetup) return;
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
