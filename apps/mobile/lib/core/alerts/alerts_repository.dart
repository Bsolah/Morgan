import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class ActiveAlert {
  const ActiveAlert({
    required this.id,
    required this.type,
    required this.title,
    required this.severity,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String severity;
  final String createdAt;

  factory ActiveAlert.fromJson(Map<String, dynamic> json) {
    return ActiveAlert(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      severity: json['severity'] as String? ?? 'info',
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}

class AlertsRepository {
  AlertsRepository(this._dio);

  final Dio _dio;

  Future<List<ActiveAlert>> getActiveAlerts() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/alerts/active');
    final alertsJson = response.data!['alerts'] as List<dynamic>? ?? const [];
    return alertsJson.whereType<Map<String, dynamic>>().map(ActiveAlert.fromJson).toList();
  }
}

final alertsRepositoryProvider = Provider<AlertsRepository>((ref) {
  return AlertsRepository(ref.watch(apiClientProvider).dio);
});

final activeAlertsProvider = FutureProvider<List<ActiveAlert>>((ref) async {
  try {
    return ref.watch(alertsRepositoryProvider).getActiveAlerts();
  } catch (_) {
    return const [];
  }
});
