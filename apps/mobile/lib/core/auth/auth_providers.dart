import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'auth_controller.dart';
import 'auth_repository.dart';
import 'auth_session.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final authSessionProvider = FutureProvider<AuthSession?>((ref) async {
  final repo = ref.watch(authRepositoryProvider);
  AuthSession? session;
  try {
    session = await repo
        .loadSession()
        .timeout(const Duration(seconds: 8), onTimeout: () => null);
  } catch (_) {
    session = null;
  }
  if (session != null) return session;
  if (!AppConfig.canSkipSetup) return null;
  return repo.seedDevSession();
});

final isShopifyConnectedProvider = Provider<bool>((ref) {
  return ref.watch(authControllerProvider).isConnected;
});

final authStatusProvider = Provider<AuthStatus>((ref) {
  return ref.watch(authControllerProvider).status;
});
