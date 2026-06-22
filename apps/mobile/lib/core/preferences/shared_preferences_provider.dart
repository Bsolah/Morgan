import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// SharedPreferences warmed in [main] so cache reads are synchronous at runtime.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw StateError(
    'SharedPreferences not initialized. Override sharedPreferencesProvider in main().',
  );
});
