import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import 'notification_prefs.dart';

class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
  }) async {
    await _dio.post<void>(
      '/api/v1/notifications/device-token',
      data: {
        'token': token,
        'platform': platform,
      },
    );
  }

  Future<NotificationPrefs> getPreferences() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/notifications/preferences');
    return NotificationPrefs.fromJson(response.data!);
  }

  Future<NotificationPrefs> updatePreferences(Map<String, dynamic> patch) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/notifications/preferences',
      data: patch,
    );
    return NotificationPrefs.fromJson(response.data!);
  }

  static String currentPlatform() {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'unknown';
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return NotificationsRepository(apiClient.dio);
});

final notificationPrefsProvider = FutureProvider<NotificationPrefs>((ref) async {
  final repo = ref.watch(notificationsRepositoryProvider);
  return repo.getPreferences();
});
