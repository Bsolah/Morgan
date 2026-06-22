import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Placeholder Firebase options for builds with `--dart-define=FIREBASE_ENABLED=true`.
/// Replace with FlutterFire-generated values for production FCM delivery.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Firebase push is not configured for web.');
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase push is not configured for this platform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'placeholder-api-key',
    appId: '1:000000000000:android:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'morgan-placeholder',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'placeholder-api-key',
    appId: '1:000000000000:ios:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'morgan-placeholder',
    iosBundleId: 'com.getmorgan.morganMobile',
  );
}
