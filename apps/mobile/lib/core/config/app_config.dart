import 'package:flutter/foundation.dart';

class AppConfig {
  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;

    if (kIsWeb) return 'http://localhost:8080';

    // iOS Simulator / Android Emulator reach host machine via these aliases.
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080';
    }

    return 'http://localhost:8080';
  }

  /// Skip Shopify connect + onboarding for local UI development.
  /// Enabled via `--dart-define=SKIP_SETUP=true` (default in `pnpm mobile:ios`).
  static bool get canSkipSetup {
    return const String.fromEnvironment('SKIP_SETUP') == 'true';
  }

  static const devSessionStoreId = 'dev-local-store';
  static const devSessionShopDomain = 'dev-store.myshopify.com';
}
