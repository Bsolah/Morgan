import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class SavedScenario {
  const SavedScenario({
    required this.id,
    required this.title,
    required this.scenarioType,
    this.channel,
    this.spendChangePct,
    this.createdAt,
  });

  final String id;
  final String title;
  final String scenarioType;
  final String? channel;
  final double? spendChangePct;
  final String? createdAt;

  factory SavedScenario.fromJson(Map<String, dynamic> json) {
    return SavedScenario(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      scenarioType: json['scenario_type'] as String? ?? '',
      channel: json['channel'] as String?,
      spendChangePct: (json['spend_change_pct'] as num?)?.toDouble(),
      createdAt: json['created_at'] as String?,
    );
  }
}

class ScenarioChannelBaseline {
  const ScenarioChannelBaseline({
    required this.channel,
    required this.baselineSpend7dUsd,
    required this.baselineRevenue7dUsd,
    required this.connected,
    this.poas7d,
    this.roas7d,
  });

  final String channel;
  final int baselineSpend7dUsd;
  final int baselineRevenue7dUsd;
  final double? poas7d;
  final double? roas7d;
  final bool connected;

  factory ScenarioChannelBaseline.fromJson(Map<String, dynamic> json) {
    return ScenarioChannelBaseline(
      channel: json['channel'] as String? ?? '',
      baselineSpend7dUsd: (json['baseline_spend_7d_usd'] as num?)?.round() ?? 0,
      baselineRevenue7dUsd: (json['baseline_revenue_7d_usd'] as num?)?.round() ?? 0,
      poas7d: (json['poas_7d'] as num?)?.toDouble(),
      roas7d: (json['roas_7d'] as num?)?.toDouble(),
      connected: json['connected'] as bool? ?? false,
    );
  }
}

class ScenarioBaselinesView {
  const ScenarioBaselinesView({
    required this.referenceDay,
    required this.channels,
    this.runwayDays,
  });

  final String referenceDay;
  final double? runwayDays;
  final List<ScenarioChannelBaseline> channels;

  factory ScenarioBaselinesView.fromJson(Map<String, dynamic> json) {
    return ScenarioBaselinesView(
      referenceDay: json['reference_day'] as String? ?? '',
      runwayDays: (json['runway_days'] as num?)?.toDouble(),
      channels: (json['channels'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ScenarioChannelBaseline.fromJson)
          .toList(),
    );
  }
}

class ScenarioCombinedResult {
  const ScenarioCombinedResult({
    required this.revenueChangeLowUsd,
    required this.revenueChangeHighUsd,
    required this.profitChangeLowUsd,
    required this.profitChangeHighUsd,
    required this.cashImpactLowUsd,
    required this.cashImpactHighUsd,
    this.runwayDaysDeltaLow,
    this.runwayDaysDeltaHigh,
  });

  final int revenueChangeLowUsd;
  final int revenueChangeHighUsd;
  final int profitChangeLowUsd;
  final int profitChangeHighUsd;
  final int cashImpactLowUsd;
  final int cashImpactHighUsd;
  final double? runwayDaysDeltaLow;
  final double? runwayDaysDeltaHigh;

  factory ScenarioCombinedResult.fromJson(Map<String, dynamic> json) {
    return ScenarioCombinedResult(
      revenueChangeLowUsd: (json['revenue_change_low_usd'] as num?)?.round() ?? 0,
      revenueChangeHighUsd: (json['revenue_change_high_usd'] as num?)?.round() ?? 0,
      profitChangeLowUsd: (json['profit_change_low_usd'] as num?)?.round() ?? 0,
      profitChangeHighUsd: (json['profit_change_high_usd'] as num?)?.round() ?? 0,
      cashImpactLowUsd: (json['cash_impact_low_usd'] as num?)?.round() ?? 0,
      cashImpactHighUsd: (json['cash_impact_high_usd'] as num?)?.round() ?? 0,
      runwayDaysDeltaLow: (json['runway_days_delta_low'] as num?)?.toDouble(),
      runwayDaysDeltaHigh: (json['runway_days_delta_high'] as num?)?.toDouble(),
    );
  }
}

class ScenarioRunResult {
  const ScenarioRunResult({
    required this.referenceDay,
    required this.combined,
    required this.scenarios,
    this.savedScenarioId,
  });

  final String referenceDay;
  final ScenarioCombinedResult combined;
  final List<Map<String, dynamic>> scenarios;
  final String? savedScenarioId;

  factory ScenarioRunResult.fromJson(Map<String, dynamic> json) {
    return ScenarioRunResult(
      referenceDay: json['reference_day'] as String? ?? '',
      combined: ScenarioCombinedResult.fromJson(json['combined'] as Map<String, dynamic>? ?? const {}),
      scenarios: (json['scenarios'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList(),
      savedScenarioId: json['saved_scenario_id'] as String?,
    );
  }
}

class SaveScenarioResult {
  const SaveScenarioResult({required this.scenario});

  final SavedScenario scenario;

  factory SaveScenarioResult.fromJson(Map<String, dynamic> json) {
    return SaveScenarioResult(
      scenario: SavedScenario.fromJson(json['scenario'] as Map<String, dynamic>),
    );
  }
}

class InventoryPurchaseRunResult {
  const InventoryPurchaseRunResult({
    required this.referenceDay,
    required this.sku,
    required this.quantity,
    required this.purchaseCostUsd,
    this.title,
    this.expectedProfitUsd,
    this.runwayDaysBaseline,
    this.runwayDaysAfterPurchase,
    this.runwayWarning = false,
    this.stockoutDateAfterPurchase,
    this.savedScenarioId,
    this.raw,
  });

  final String referenceDay;
  final String sku;
  final String? title;
  final int quantity;
  final int purchaseCostUsd;
  final int? expectedProfitUsd;
  final double? runwayDaysBaseline;
  final double? runwayDaysAfterPurchase;
  final bool runwayWarning;
  final String? stockoutDateAfterPurchase;
  final String? savedScenarioId;
  final Map<String, dynamic> raw;

  factory InventoryPurchaseRunResult.fromJson(Map<String, dynamic> json) {
    return InventoryPurchaseRunResult(
      referenceDay: json['reference_day'] as String? ?? '',
      sku: json['sku'] as String? ?? '',
      title: json['title'] as String?,
      quantity: (json['quantity'] as num?)?.round() ?? 0,
      purchaseCostUsd: (json['purchase_cost_usd'] as num?)?.round() ?? 0,
      expectedProfitUsd: (json['expected_profit_usd'] as num?)?.round(),
      runwayDaysBaseline: (json['runway_days_baseline'] as num?)?.toDouble(),
      runwayDaysAfterPurchase: (json['runway_days_after_purchase'] as num?)?.toDouble(),
      runwayWarning: json['runway_warning'] as bool? ?? false,
      stockoutDateAfterPurchase: json['stockout_date_after_purchase'] as String?,
      savedScenarioId: json['saved_scenario_id'] as String?,
      raw: json,
    );
  }
}

class ScenariosRepository {
  ScenariosRepository(this._dio);

  final Dio _dio;

  Future<List<SavedScenario>> listScenarios() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/scenarios');
    final items = response.data!['items'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(SavedScenario.fromJson).toList();
  }

  Future<ScenarioBaselinesView> getBaselines() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/scenarios/baselines');
    return ScenarioBaselinesView.fromJson(response.data!);
  }

  Future<ScenarioRunResult> runScenario(Map<String, dynamic> payload) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/scenarios/run', data: payload);
    return ScenarioRunResult.fromJson(response.data!);
  }

  Future<InventoryPurchaseRunResult> runInventoryPurchaseScenario(Map<String, dynamic> payload) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/scenarios/inventory/run',
      data: payload,
    );
    return InventoryPurchaseRunResult.fromJson(response.data!);
  }

  Future<SavedScenario> saveScenario(Map<String, dynamic> payload) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/scenarios', data: payload);
    return SaveScenarioResult.fromJson(response.data!).scenario;
  }
}

final scenariosRepositoryProvider = Provider<ScenariosRepository>((ref) {
  return ScenariosRepository(ref.watch(apiClientProvider).dio);
});

final savedScenariosProvider = FutureProvider.autoDispose<List<SavedScenario>>((ref) {
  return ref.watch(scenariosRepositoryProvider).listScenarios();
});

final scenarioBaselinesProvider = FutureProvider.autoDispose<ScenarioBaselinesView>((ref) {
  return ref.watch(scenariosRepositoryProvider).getBaselines();
});
