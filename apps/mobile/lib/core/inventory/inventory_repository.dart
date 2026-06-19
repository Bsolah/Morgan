import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../network/api_client.dart';

class InventorySkuHealth {
  const InventorySkuHealth({
    required this.sku,
    this.title,
    required this.availableUnits,
    required this.velocityPerDay,
    required this.grossRevenue,
    this.daysOfStock,
    required this.healthStatus,
    required this.stockoutRisk,
    required this.overstock,
    required this.overstockValueUsd,
    required this.leadTimeDays,
    required this.safetyStockUnits,
    required this.reorderRecommended,
    this.reorderQty,
    this.reorderByDay,
    this.recommendationTitle,
    this.recommendationBody,
  });

  final String sku;
  final String? title;
  final int availableUnits;
  final double velocityPerDay;
  final double grossRevenue;
  final double? daysOfStock;
  final String healthStatus;
  final bool stockoutRisk;
  final bool overstock;
  final int overstockValueUsd;
  final int leadTimeDays;
  final int safetyStockUnits;
  final bool reorderRecommended;
  final int? reorderQty;
  final String? reorderByDay;
  final String? recommendationTitle;
  final String? recommendationBody;

  factory InventorySkuHealth.fromJson(Map<String, dynamic> json) {
    return InventorySkuHealth(
      sku: json['sku'] as String? ?? '',
      title: json['title'] as String?,
      availableUnits: (json['available_units'] as num?)?.round() ?? 0,
      velocityPerDay: (json['velocity_per_day'] as num?)?.toDouble() ?? 0,
      grossRevenue: (json['gross_revenue'] as num?)?.toDouble() ?? 0,
      daysOfStock: (json['days_of_stock'] as num?)?.toDouble(),
      healthStatus: json['health_status'] as String? ?? 'unknown',
      stockoutRisk: json['stockout_risk'] as bool? ?? false,
      overstock: json['overstock'] as bool? ?? false,
      overstockValueUsd: (json['overstock_value_usd'] as num?)?.round() ?? 0,
      leadTimeDays: (json['lead_time_days'] as num?)?.toInt() ?? 14,
      safetyStockUnits: (json['safety_stock_units'] as num?)?.toInt() ?? 0,
      reorderRecommended: json['reorder_recommended'] as bool? ?? false,
      reorderQty: (json['reorder_qty'] as num?)?.round(),
      reorderByDay: json['reorder_by_day'] as String?,
      recommendationTitle: json['recommendation_title'] as String?,
      recommendationBody: json['recommendation_body'] as String?,
    );
  }
}

class InventoryHealthResponse {
  const InventoryHealthResponse({
    required this.windowDays,
    required this.stockoutRiskCount,
    required this.overstockCount,
    required this.overstockValueUsd,
    required this.skus,
  });

  final int windowDays;
  final int stockoutRiskCount;
  final int overstockCount;
  final int overstockValueUsd;
  final List<InventorySkuHealth> skus;

  factory InventoryHealthResponse.fromJson(Map<String, dynamic> json) {
    final skusJson = json['skus'] as List<dynamic>? ?? const [];
    return InventoryHealthResponse(
      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,
      stockoutRiskCount: (json['stockout_risk_count'] as num?)?.toInt() ?? 0,
      overstockCount: (json['overstock_count'] as num?)?.toInt() ?? 0,
      overstockValueUsd: (json['overstock_value_usd'] as num?)?.round() ?? 0,
      skus: skusJson.whereType<Map<String, dynamic>>().map(InventorySkuHealth.fromJson).toList(),
    );
  }
}

class InventoryRepository {
  InventoryRepository(this._dio, this._storeId);

  final Dio _dio;
  final String? _storeId;

  Future<InventoryHealthResponse?> getHealth({int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/inventory/health',
      queryParameters: {'window_days': windowDays},
    );
    return InventoryHealthResponse.fromJson(response.data!);
  }

  Future<InventorySkuHealth?> getSkuDetail(String sku, {int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final encodedSku = Uri.encodeComponent(sku);
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/inventory/skus/$encodedSku',
      queryParameters: {'window_days': windowDays},
    );
    return InventorySkuHealth.fromJson(response.data!);
  }
}

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  final api = ref.watch(apiClientProvider);
  final storeId = ref.watch(authControllerProvider).session?.storeId;
  return InventoryRepository(api.dio, storeId);
});

final inventoryHealthProvider = FutureProvider<InventoryHealthResponse?>((ref) async {
  return ref.watch(inventoryRepositoryProvider).getHealth();
});

final inventorySkuDetailProvider = FutureProvider.autoDispose.family<InventorySkuHealth?, String>((ref, sku) async {
  return ref.watch(inventoryRepositoryProvider).getSkuDetail(sku);
});

String formatDaysOfStock(double? days) {
  if (days == null) return '—';
  return '${days.toStringAsFixed(0)}d';
}

String formatInventoryCurrency(num value) {
  final sign = value < 0 ? '-' : '';
  return '$sign\$${value.abs().round()}';
}
