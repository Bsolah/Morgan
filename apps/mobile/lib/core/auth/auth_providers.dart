import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';
import 'auth_session.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final authSessionProvider = FutureProvider<AuthSession?>((ref) async {
  final repo = ref.watch(authRepositoryProvider);
  return repo.loadSession();
});

final isShopifyConnectedProvider = Provider<bool>((ref) {
  final session = ref.watch(authSessionProvider);
  return session.maybeWhen(data: (value) => value?.isConnected ?? false, orElse: () => false);
});
