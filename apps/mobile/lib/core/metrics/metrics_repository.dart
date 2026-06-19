import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../network/api_client.dart';

class StoreMetricSnapshot {
  const StoreMetricSnapshot({
    required this.metricKey,
    required this.value,
    required this.period,
    required this.asOf,
    required this.source,
  });

  final String metricKey;
  final double value;
  final String period;
  final String asOf;
  final String source;

  factory StoreMetricSnapshot.fromJson(Map<String, dynamic> json) {
    return StoreMetricSnapshot(
      metricKey: json['metric_key'] as String? ?? '',
      value: double.tryParse(json['value']?.toString() ?? '') ?? 0,
      period: json['period'] as String? ?? '',
      asOf: json['as_of'] as String? ?? '',
      source: json['source'] as String? ?? '',
    );
  }
}

class StoreMetricsResponse {
  const StoreMetricsResponse({
    required this.storeId,
    required this.snapshotsAsOf,
    required this.isStale,
    required this.staleAfterHours,
    required this.metaConnected,
    required this.merTooltip,
    required this.roasTooltip,
    required this.metrics,
  });

  final String storeId;
  final String? snapshotsAsOf;
  final bool isStale;
  final int staleAfterHours;
  final bool metaConnected;
  final String merTooltip;
  final String roasTooltip;
  final List<StoreMetricSnapshot> metrics;

  factory StoreMetricsResponse.fromJson(Map<String, dynamic> json) {
    final metricsJson = json['metrics'] as List<dynamic>? ?? const [];
    final tooltips = json['tooltips'] as Map<String, dynamic>? ?? const {};
    return StoreMetricsResponse(
      storeId: json['store_id'] as String? ?? '',
      snapshotsAsOf: json['snapshots_as_of'] as String?,
      isStale: json['is_stale'] as bool? ?? true,
      staleAfterHours: json['stale_after_hours'] as int? ?? 6,
      metaConnected: json['meta_connected'] as bool? ?? false,
      merTooltip: tooltips['mer'] as String? ??
          'Marketing Efficiency Ratio = ad spend divided by total net revenue.',
      roasTooltip: tooltips['roas'] as String? ??
          'Return on Ad Spend = attributed revenue divided by ad spend.',
      metrics: metricsJson
          .whereType<Map<String, dynamic>>()
          .map(StoreMetricSnapshot.fromJson)
          .toList(),
    );
  }

  double? metric(String key) {
    for (final metric in metrics) {
      if (metric.metricKey == key) return metric.value;
    }
    return null;
  }
}

class MetricsRepository {
  MetricsRepository(this._dio, this._storeId);

  final Dio _dio;
  final String? _storeId;

  Future<StoreMetricsResponse?> getStoreMetrics() async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>('/api/v1/stores/$storeId/metrics');
    return StoreMetricsResponse.fromJson(response.data!);
  }
}

final metricsRepositoryProvider = Provider<MetricsRepository>((ref) {
  final api = ref.watch(apiClientProvider);
  final storeId = ref.watch(authControllerProvider).session?.storeId;
  return MetricsRepository(api.dio, storeId);
});

final storeMetricsProvider = FutureProvider<StoreMetricsResponse?>((ref) async {
  return ref.watch(metricsRepositoryProvider).getStoreMetrics();
});

String formatMetricCurrency(double? value) {
  if (value == null) return '—';
  return '\$${value.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (match) => '${match[1]},',
      )}';
}

String formatMetricRatio(double? value) {
  if (value == null) return '—';
  return value.toStringAsFixed(2);
}

String formatMerRatio(double? value) {
  if (value == null) return '—';
  return '${(value * 100).toStringAsFixed(1)}%';
}
