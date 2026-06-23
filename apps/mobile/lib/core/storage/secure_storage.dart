import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Shared keychain config — avoids simulator hangs on first read.
const morganSecureStorage = FlutterSecureStorage(
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock,
  ),
);
