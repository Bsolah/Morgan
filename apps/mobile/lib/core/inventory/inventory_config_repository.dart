import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class SkuLeadTimeOverride {
  const SkuLeadTimeOverride({required this.sku, required this.leadTimeDays});

  final String sku;
  final int leadTimeDays;

  factory SkuLeadTimeOverride.fromJson(Map<String, dynamic> json) {
    return SkuLeadTimeOverride(
      sku: json['sku'] as String? ?? '',
      leadTimeDays: (json['lead_time_days'] as num?)?.toInt() ?? 14,
    );
  }
}

class InventoryConfig {
  const InventoryConfig({required this.defaultLeadTimeDays, required this.skuOverrides});

  final int defaultLeadTimeDays;
  final List<SkuLeadTimeOverride> skuOverrides;

  factory InventoryConfig.fromJson(Map<String, dynamic> json) {
    final overridesJson = json['sku_overrides'] as List<dynamic>? ?? const [];
    return InventoryConfig(
      defaultLeadTimeDays: (json['default_lead_time_days'] as num?)?.toInt() ?? 14,
      skuOverrides: overridesJson
          .whereType<Map<String, dynamic>>()
          .map(SkuLeadTimeOverride.fromJson)
          .toList(),
    );
  }

  String get subtitle {
    if (skuOverrides.isEmpty) {
      return '$defaultLeadTimeDays-day default';
    }
    return '$defaultLeadTimeDays-day default · ${skuOverrides.length} SKU override${skuOverrides.length == 1 ? '' : 's'}';
  }
}

class InventoryConfigRepository {
  InventoryConfigRepository(this._dio);

  final Dio _dio;

  Future<InventoryConfig> getConfig() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/inventory/config');
    return InventoryConfig.fromJson(response.data!);
  }

  Future<InventoryConfig> updateDefaultLeadTime(int days) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/inventory/config',
      data: {'default_lead_time_days': days},
    );
    return InventoryConfig.fromJson(response.data!);
  }

  Future<InventoryConfig> upsertSkuOverride(String sku, int leadTimeDays) async {
    final encodedSku = Uri.encodeComponent(sku);
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/v1/inventory/lead-times/$encodedSku',
      data: {'lead_time_days': leadTimeDays},
    );
    return InventoryConfig.fromJson(response.data!);
  }

  Future<InventoryConfig> deleteSkuOverride(String sku) async {
    final encodedSku = Uri.encodeComponent(sku);
    final response = await _dio.delete<Map<String, dynamic>>(
      '/api/v1/inventory/lead-times/$encodedSku',
    );
    return InventoryConfig.fromJson(response.data!);
  }
}

final inventoryConfigRepositoryProvider = Provider<InventoryConfigRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return InventoryConfigRepository(apiClient.dio);
});

final inventoryConfigProvider = FutureProvider<InventoryConfig>((ref) async {
  final repo = ref.watch(inventoryConfigRepositoryProvider);
  return repo.getConfig();
});
