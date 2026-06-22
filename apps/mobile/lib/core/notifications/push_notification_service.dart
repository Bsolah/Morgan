import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../routing/app_router.dart';
import '../auth/auth_controller.dart';
import '../navigation/morgan_deep_link.dart';
import 'firebase_options.dart';
import 'notifications_repository.dart';

const _pushInstallTokenKey = 'morgan_push_install_token';

class PushNotificationService {
  PushNotificationService(this._ref, {FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final Ref _ref;
  final FlutterSecureStorage _storage;
  bool _initialized = false;
  String? _lastRegisteredToken;

  static const firebaseEnabled = bool.fromEnvironment('FIREBASE_ENABLED', defaultValue: false);

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    if (firebaseEnabled && !kIsMobilePlatform) {
      return;
    }

    if (firebaseEnabled && kIsMobilePlatform) {
      try {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
        await FirebaseMessaging.instance.requestPermission();
        FirebaseMessaging.onTokenRefresh.listen(_registerToken);
        FirebaseMessaging.onMessageOpenedApp.listen(_handleRemoteMessage);
        final initial = await FirebaseMessaging.instance.getInitialMessage();
        if (initial != null) {
          _handleRemoteMessage(initial);
        }
      } catch (_) {
        // Firebase config missing — fall back to install token registration below.
      }
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
    if (firebaseEnabled && kIsMobilePlatform) {
      try {
        final fcmToken = await FirebaseMessaging.instance.getToken();
        if (fcmToken != null && fcmToken.isNotEmpty) {
          return fcmToken;
        }
      } catch (_) {
        // Fall through to install-scoped token for local dev.
      }
    }

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

  void _handleRemoteMessage(RemoteMessage message) {
    final path = resolveMorganDeepLinkFromData(message.data);
    if (path == null) return;
    _ref.read(appRouterProvider).go(path);
  }
}

bool get kIsMobilePlatform => Platform.isIOS || Platform.isAndroid;

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService(ref);
});
