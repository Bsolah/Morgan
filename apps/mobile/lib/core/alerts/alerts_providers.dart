import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../config/app_config.dart';
import 'alert.dart';
import 'alerts_repository.dart';

final alertsProvider = FutureProvider<AlertsFeed>((ref) async {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) return AlertsFeed.empty();

  final repo = AlertsRepository(session);

  try {
    return await repo.fetchAlerts();
  } catch (_) {
    if (AppConfig.canSkipSetup) {
      return AlertsRepository.devFallback();
    }
    rethrow;
  }
});

final alertDetailProvider = FutureProvider.family<Alert, String>((ref, alertId) async {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) {
    throw StateError('Not authenticated');
  }

  final repo = AlertsRepository(session);

  try {
    return await repo.fetchDetail(alertId);
  } catch (_) {
    if (AppConfig.canSkipSetup) {
      final fallback = AlertsRepository.devDetailFallback(alertId);
      if (fallback != null) return fallback;
    }
    rethrow;
  }
});

final unreadAlertsCountProvider = Provider<AsyncValue<int>>((ref) {
  return ref.watch(alertsProvider).whenData((feed) => feed.unreadCount);
});

final alertSeverityFilterProvider =
    StateProvider<AlertSeverityFilter>((ref) => AlertSeverityFilter.all);
