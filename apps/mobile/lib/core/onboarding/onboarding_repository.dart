import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';

const _onboardingCompletedKey = 'morgan_onboarding_completed';

class OnboardingRepository {
  OnboardingRepository({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  Future<bool> isCompleted() async {
    if (AppConfig.canSkipSetup) return true;
    return (await _storage.read(key: _onboardingCompletedKey)) == 'true';
  }

  Future<void> markCompleted() async {
    await _storage.write(key: _onboardingCompletedKey, value: 'true');
  }

  Future<void> reset() async {
    await _storage.delete(key: _onboardingCompletedKey);
  }
}

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  return OnboardingRepository();
});

final onboardingCompletedProvider = FutureProvider<bool>((ref) async {
  final repo = ref.watch(onboardingRepositoryProvider);
  return repo.isCompleted();
});
