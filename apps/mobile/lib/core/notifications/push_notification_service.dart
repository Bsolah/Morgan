import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../storage/secure_storage.dart';
import '../../routing/app_router.dart';
import '../auth/auth_controller.dart';
import '../navigation/morgan_deep_link.dart';
import 'notifications_repository.dart';

const _pushInstallTokenKey = 'morgan_push_install_token';

class PushNotificationService {
  PushNotificationService(this._ref, {FlutterSecureStorage? storage})
      : _storage = storage ?? morganSecureStorage;

  final Ref _ref;
  final FlutterSecureStorage _storage;
  bool _initialized = false;
  String? _lastRegisteredToken;

  /// Set `--dart-define=FIREBASE_ENABLED=true` once FCM pods are configured.
  static const firebaseEnabled = bool.fromEnvironment('FIREBASE_ENABLED', defaultValue: false);

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    if (firebaseEnabled) {
      // FCM wiring lands with production Firebase config (requires CocoaPods 1.12+).
      // Local dev uses install-scoped tokens below.
    }

    final auth = _ref.read(authControllerProvider);
    if (auth.status == AuthStatus.authenticated) {
      await syncRegistration();
    }
  }

  Future<void> syncRegistration() async {
    final auth = _ref.read(authControllerProvider);
    if (auth.status != AuthStatus.authenticated) return;

    final token = await _resolveToken();
    if (token == null || token.length < 10) return;
    if (token == _lastRegisteredToken) return;

    await _registerToken(token);
  }

  Future<void> _registerToken(String token) async {
    final auth = _ref.read(authControllerProvider);
    if (auth.status != AuthStatus.authenticated) return;

    try {
      await _ref.read(notificationsRepositoryProvider).registerDeviceToken(
            token: token,
            platform: NotificationsRepository.currentPlatform(),
          );
      _lastRegisteredToken = token;
    } catch (_) {
      // Retry on next app launch or token refresh.
    }
  }

  Future<String?> _resolveToken() async {
    return _installScopedToken();
  }

  Future<String?> _installScopedToken() async {
    final existing = await _storage.read(key: _pushInstallTokenKey);
    if (existing != null && existing.length >= 10) return existing;

    final platform = NotificationsRepository.currentPlatform();
    final suffix = DateTime.now().microsecondsSinceEpoch;
    final token = 'dev-fcm-$platform-$suffix';
    await _storage.write(key: _pushInstallTokenKey, value: token);
    return token;
  }

  void handleNotificationData(Map<String, dynamic> data) {
    final path = resolveMorganDeepLinkFromData(data);
    if (path == null) return;
    _ref.read(appRouterProvider).go(path);
  }
}

bool get kIsMobilePlatform => Platform.isIOS || Platform.isAndroid;

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService(ref);
});
