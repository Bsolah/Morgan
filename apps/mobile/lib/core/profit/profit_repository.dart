import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../network/api_client.dart';

class SkuProfitSummary {
  const SkuProfitSummary({
    required this.sku,
    required this.ordersCount,
    required this.unitsSold,
    required this.grossRevenue,
    required this.contributionMargin,
    required this.unitMargin,
    required this.velocityPerDay,
    required this.returnRate,
    required this.lowConfidence,
    required this.attributedAdSpend,
  });

  final String sku;
  final int ordersCount;
  final int unitsSold;
  final double grossRevenue;
  final double contributionMargin;
  final double unitMargin;
  final double velocityPerDay;
  final double returnRate;
  final bool lowConfidence;
  final double attributedAdSpend;

  factory SkuProfitSummary.fromJson(Map<String, dynamic> json) {
    return SkuProfitSummary(
      sku: json['sku'] as String? ?? '',
      ordersCount: (json['orders_count'] as num?)?.toInt() ?? 0,
      unitsSold: (json['units_sold'] as num?)?.toInt() ?? 0,
      grossRevenue: (json['gross_revenue'] as num?)?.toDouble() ?? 0,
      contributionMargin: (json['contribution_margin'] as num?)?.toDouble() ?? 0,
      unitMargin: (json['unit_margin'] as num?)?.toDouble() ?? 0,
      velocityPerDay: (json['velocity_per_day'] as num?)?.toDouble() ?? 0,
      returnRate: (json['return_rate'] as num?)?.toDouble() ?? 0,
      lowConfidence: json['low_confidence'] as bool? ?? true,
      attributedAdSpend: (json['attributed_ad_spend'] as num?)?.toDouble() ?? 0,
    );
  }
}

class MarginDriver {
  const MarginDriver({
    required this.category,
    required this.label,
    required this.impactUsd,
    required this.currentUsd,
    required this.priorUsd,
    required this.chatPrompt,
  });

  final String category;
  final String label;
  final int impactUsd;
  final int currentUsd;
  final int priorUsd;
  final String chatPrompt;

  factory MarginDriver.fromJson(Map<String, dynamic> json) {
    return MarginDriver(
      category: json['category'] as String? ?? '',
      label: json['label'] as String? ?? '',
      impactUsd: (json['impact_usd'] as num?)?.round() ?? 0,
      currentUsd: (json['current_usd'] as num?)?.round() ?? 0,
      priorUsd: (json['prior_usd'] as num?)?.round() ?? 0,
      chatPrompt: json['chat_prompt'] as String? ?? '',
    );
  }
}

class MarginDriversResponse {
  const MarginDriversResponse({
    required this.windowDays,
    required this.currentMarginPct,
    required this.marginDeltaPct,
    required this.drivers,
  });

  final int windowDays;
  final double? currentMarginPct;
  final double? marginDeltaPct;
  final List<MarginDriver> drivers;

  factory MarginDriversResponse.fromJson(Map<String, dynamic> json) {
    final driversJson = json['drivers'] as List<dynamic>? ?? const [];
    return MarginDriversResponse(
      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,
      currentMarginPct: (json['current_margin_pct'] as num?)?.toDouble(),
      marginDeltaPct: (json['margin_delta_pct'] as num?)?.toDouble(),
      drivers: driversJson.whereType<Map<String, dynamic>>().map(MarginDriver.fromJson).toList(),
    );
  }
}

class DailyMarginTrendPoint {
  const DailyMarginTrendPoint({
    required this.day,
    required this.marginPct,
    required this.contributionMargin,
    required this.netRevenue,
    required this.orders,
  });

  final String day;
  final double? marginPct;
  final double contributionMargin;
  final double netRevenue;
  final int orders;

  factory DailyMarginTrendPoint.fromJson(Map<String, dynamic> json) {
    return DailyMarginTrendPoint(
      day: json['day'] as String? ?? '',
      marginPct: (json['margin_pct'] as num?)?.toDouble(),
      contributionMargin: (json['contribution_margin'] as num?)?.toDouble() ?? 0,
      netRevenue: (json['net_revenue'] as num?)?.toDouble() ?? 0,
      orders: (json['orders'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProfitOverviewResponse {
  const ProfitOverviewResponse({
    required this.storeId,
    required this.referenceDay,
    required this.windowDays,
    required this.currentMarginPct,
    required this.priorMarginPct,
    required this.marginDeltaPct,
    required this.targetMarginPct,
    required this.belowTarget,
    required this.trend,
    required this.activeLeakCount,
    required this.leakCountsByType,
    required this.amountAtRiskUsd,
    this.lastLeakScanAt,
  });

  final String storeId;
  final String referenceDay;
  final int windowDays;
  final double? currentMarginPct;
  final double? priorMarginPct;
  final double? marginDeltaPct;
  final double targetMarginPct;
  final bool belowTarget;
  final List<DailyMarginTrendPoint> trend;
  final int activeLeakCount;
  final Map<String, int> leakCountsByType;
  final int amountAtRiskUsd;
  final DateTime? lastLeakScanAt;

  factory ProfitOverviewResponse.fromJson(Map<String, dynamic> json) {
    final trendJson = json['trend'] as List<dynamic>? ?? const [];
    final leakCountsRaw = json['leak_counts_by_type'] as Map<String, dynamic>? ?? const {};
    final leakCounts = <String, int>{};
    for (final entry in leakCountsRaw.entries) {
      leakCounts[entry.key] = (entry.value as num?)?.toInt() ?? 0;
    }

    return ProfitOverviewResponse(
      storeId: json['store_id'] as String? ?? '',
      referenceDay: json['reference_day'] as String? ?? '',
      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,
      currentMarginPct: (json['current_margin_pct'] as num?)?.toDouble(),
      priorMarginPct: (json['prior_margin_pct'] as num?)?.toDouble(),
      marginDeltaPct: (json['margin_delta_pct'] as num?)?.toDouble(),
      targetMarginPct: (json['target_margin_pct'] as num?)?.toDouble() ?? 40,
      belowTarget: json['below_target'] as bool? ?? false,
      trend: trendJson.whereType<Map<String, dynamic>>().map(DailyMarginTrendPoint.fromJson).toList(),
      activeLeakCount: (json['active_leak_count'] as num?)?.toInt() ?? 0,
      leakCountsByType: leakCounts,
      amountAtRiskUsd: (json['amount_at_risk_usd'] as num?)?.toInt() ?? 0,
      lastLeakScanAt: DateTime.tryParse(json['last_leak_scan_at'] as String? ?? ''),
    );
  }
}

class ProfitLeakListItem {
  const ProfitLeakListItem({
    required this.id,
    required this.leakType,
    required this.leakLabel,
    required this.severity,
    required this.amountAtRiskUsd,
    required this.title,
    required this.updatedAt,
  });

  final String id;
  final String leakType;
  final String leakLabel;
  final String severity;
  final int amountAtRiskUsd;
  final String title;
  final DateTime updatedAt;

  factory ProfitLeakListItem.fromJson(Map<String, dynamic> json) {
    return ProfitLeakListItem(
      id: json['id'] as String? ?? '',
      leakType: json['leak_type'] as String? ?? '',
      leakLabel: json['leak_label'] as String? ?? '',
      severity: json['severity'] as String? ?? 'warning',
      amountAtRiskUsd: (json['amount_at_risk_usd'] as num?)?.round() ?? 0,
      title: json['title'] as String? ?? '',
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class ProfitLeaksResponse {
  const ProfitLeaksResponse({
    required this.lastScanAt,
    required this.items,
  });

  final DateTime? lastScanAt;
  final List<ProfitLeakListItem> items;

  factory ProfitLeaksResponse.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    return ProfitLeaksResponse(
      lastScanAt: DateTime.tryParse(json['last_scan_at'] as String? ?? ''),
      items: itemsJson.whereType<Map<String, dynamic>>().map(ProfitLeakListItem.fromJson).toList(),
    );
  }
}

class ProfitLeakEvidenceRow {
  const ProfitLeakEvidenceRow({required this.label, required this.value});

  final String label;
  final String value;

  factory ProfitLeakEvidenceRow.fromJson(Map<String, dynamic> json) {
    return ProfitLeakEvidenceRow(
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '',
    );
  }
}

class ProfitLeakDetail {
  const ProfitLeakDetail({
    required this.id,
    required this.leakType,
    required this.leakLabel,
    required this.severity,
    required this.status,
    required this.amountAtRiskUsd,
    required this.title,
    required this.body,
    required this.evidenceRows,
    required this.recommendationId,
    required this.updatedAt,
  });

  final String id;
  final String leakType;
  final String leakLabel;
  final String severity;
  final String status;
  final int amountAtRiskUsd;
  final String title;
  final String body;
  final List<ProfitLeakEvidenceRow> evidenceRows;
  final String recommendationId;
  final DateTime updatedAt;

  factory ProfitLeakDetail.fromJson(Map<String, dynamic> json) {
    final rowsJson = json['evidence_rows'] as List<dynamic>? ?? const [];
    return ProfitLeakDetail(
      id: json['id'] as String? ?? '',
      leakType: json['leak_type'] as String? ?? '',
      leakLabel: json['leak_label'] as String? ?? '',
      severity: json['severity'] as String? ?? 'warning',
      status: json['status'] as String? ?? '',
      amountAtRiskUsd: (json['amount_at_risk_usd'] as num?)?.round() ?? 0,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      evidenceRows: rowsJson.whereType<Map<String, dynamic>>().map(ProfitLeakEvidenceRow.fromJson).toList(),
      recommendationId: json['recommendation_id'] as String? ?? '',
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class ProfitDaySummaryResponse {
  const ProfitDaySummaryResponse({
    required this.day,
    required this.orders,
    required this.grossRevenue,
    required this.netRevenue,
    required this.cogs,
    required this.contributionMargin,
    required this.marginPct,
    required this.unitsSold,
  });

  final String day;
  final int orders;
  final double grossRevenue;
  final double netRevenue;
  final double cogs;
  final double contributionMargin;
  final double? marginPct;
  final int unitsSold;

  factory ProfitDaySummaryResponse.fromJson(Map<String, dynamic> json) {
    return ProfitDaySummaryResponse(
      day: json['day'] as String? ?? '',
      orders: (json['orders'] as num?)?.toInt() ?? 0,
      grossRevenue: (json['gross_revenue'] as num?)?.toDouble() ?? 0,
      netRevenue: (json['net_revenue'] as num?)?.toDouble() ?? 0,
      cogs: (json['cogs'] as num?)?.toDouble() ?? 0,
      contributionMargin: (json['contribution_margin'] as num?)?.toDouble() ?? 0,
      marginPct: (json['margin_pct'] as num?)?.toDouble(),
      unitsSold: (json['units_sold'] as num?)?.toInt() ?? 0,
    );
  }
}

class SkuWeeklyTrendPoint {
  const SkuWeeklyTrendPoint({
    required this.weekStart,
    required this.contributionMargin,
    required this.unitMargin,
    required this.returnRate,
    required this.velocityPerDay,
    required this.ordersCount,
  });

  final String weekStart;
  final double contributionMargin;
  final double unitMargin;
  final double returnRate;
  final double velocityPerDay;
  final int ordersCount;

  factory SkuWeeklyTrendPoint.fromJson(Map<String, dynamic> json) {
    return SkuWeeklyTrendPoint(
      weekStart: json['week_start'] as String? ?? '',
      contributionMargin: (json['contribution_margin'] as num?)?.toDouble() ?? 0,
      unitMargin: (json['unit_margin'] as num?)?.toDouble() ?? 0,
      returnRate: (json['return_rate'] as num?)?.toDouble() ?? 0,
      velocityPerDay: (json['velocity_per_day'] as num?)?.toDouble() ?? 0,
      ordersCount: (json['orders_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProfitSkuListResponse {
  const ProfitSkuListResponse({
    required this.storeId,
    required this.windowDays,
    required this.referenceDay,
    required this.totalAdSpend,
    required this.skus,
  });

  final String storeId;
  final int windowDays;
  final String referenceDay;
  final double totalAdSpend;
  final List<SkuProfitSummary> skus;

  factory ProfitSkuListResponse.fromJson(Map<String, dynamic> json) {
    final skusJson = json['skus'] as List<dynamic>? ?? const [];
    return ProfitSkuListResponse(
      storeId: json['store_id'] as String? ?? '',
      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,
      referenceDay: json['reference_day'] as String? ?? '',
      totalAdSpend: (json['total_ad_spend'] as num?)?.toDouble() ?? 0,
      skus: skusJson.whereType<Map<String, dynamic>>().map(SkuProfitSummary.fromJson).toList(),
    );
  }
}

class ProfitSkuDetailResponse {
  const ProfitSkuDetailResponse({
    required this.storeId,
    required this.sku,
    required this.windowDays,
    required this.referenceDay,
    required this.summary,
    required this.weeklyTrend,
  });

  final String storeId;
  final String sku;
  final int windowDays;
  final String referenceDay;
  final SkuProfitSummary summary;
  final List<SkuWeeklyTrendPoint> weeklyTrend;

  factory ProfitSkuDetailResponse.fromJson(Map<String, dynamic> json) {
    final trendJson = json['weekly_trend'] as List<dynamic>? ?? const [];
    return ProfitSkuDetailResponse(
      storeId: json['store_id'] as String? ?? '',
      sku: json['sku'] as String? ?? '',
      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,
      referenceDay: json['reference_day'] as String? ?? '',
      summary: SkuProfitSummary.fromJson(json['summary'] as Map<String, dynamic>? ?? const {}),
      weeklyTrend: trendJson.whereType<Map<String, dynamic>>().map(SkuWeeklyTrendPoint.fromJson).toList(),
    );
  }
}

class ProfitRepository {
  ProfitRepository(this._dio, this._storeId);

  final Dio _dio;
  final String? _storeId;

  Future<ProfitLeaksResponse?> getProfitLeaks() async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>('/api/v1/stores/$storeId/profit/leaks');
    return ProfitLeaksResponse.fromJson(response.data!);
  }

  Future<ProfitLeakDetail?> getProfitLeakDetail(String leakId) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>('/api/v1/stores/$storeId/profit/leaks/$leakId');
    return ProfitLeakDetail.fromJson(response.data!);
  }

  Future<MarginDriversResponse?> getMarginDrivers({int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/profit/margin-drivers',
      queryParameters: {'window_days': windowDays},
    );
    return MarginDriversResponse.fromJson(response.data!);
  }

  Future<ProfitOverviewResponse?> getOverview({int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/profit/overview',
      queryParameters: {'window_days': windowDays},
    );
    return ProfitOverviewResponse.fromJson(response.data!);
  }

  Future<ProfitDaySummaryResponse?> getDaySummary(String day) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/profit/days/$day',
    );
    return ProfitDaySummaryResponse.fromJson(response.data!);
  }

  Future<ProfitSkuListResponse?> getSkuRanking({int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/profit/skus',
      queryParameters: {'window_days': windowDays},
    );
    return ProfitSkuListResponse.fromJson(response.data!);
  }

  Future<ProfitSkuDetailResponse?> getSkuDetail(String sku, {int windowDays = 30}) async {
    final storeId = _storeId;
    if (storeId == null || storeId.isEmpty) return null;

    final encodedSku = Uri.encodeComponent(sku);
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/$storeId/profit/skus/$encodedSku',
      queryParameters: {'window_days': windowDays},
    );
    return ProfitSkuDetailResponse.fromJson(response.data!);
  }
}

final profitRepositoryProvider = Provider<ProfitRepository>((ref) {
  final api = ref.watch(apiClientProvider);
  final storeId = ref.watch(authControllerProvider).session?.storeId;
  return ProfitRepository(api.dio, storeId);
});

final profitLeaksProvider = FutureProvider.autoDispose<ProfitLeaksResponse?>((ref) async {
  return ref.watch(profitRepositoryProvider).getProfitLeaks();
});

final profitLeakDetailProvider = FutureProvider.autoDispose.family<ProfitLeakDetail?, String>((ref, leakId) async {
  return ref.watch(profitRepositoryProvider).getProfitLeakDetail(leakId);
});

final marginDriversProvider = FutureProvider.autoDispose.family<MarginDriversResponse?, int>((ref, windowDays) async {
  return ref.watch(profitRepositoryProvider).getMarginDrivers(windowDays: windowDays);
});

final profitOverviewProvider = FutureProvider<ProfitOverviewResponse?>((ref) async {
  return ref.watch(profitRepositoryProvider).getOverview();
});

final profitDaySummaryProvider = FutureProvider.autoDispose.family<ProfitDaySummaryResponse?, String>((ref, day) async {
  return ref.watch(profitRepositoryProvider).getDaySummary(day);
});

final profitSkuRankingProvider = FutureProvider<ProfitSkuListResponse?>((ref) async {
  return ref.watch(profitRepositoryProvider).getSkuRanking();
});

final profitSkuDetailProvider = FutureProvider.family<ProfitSkuDetailResponse?, String>((ref, sku) async {
  return ref.watch(profitRepositoryProvider).getSkuDetail(sku);
});

String formatProfitCurrency(double value) {
  final sign = value < 0 ? '-' : '';
  final abs = value.abs().toStringAsFixed(0);
  return '$sign\$$abs';
}

String formatReturnRate(double value) => '${(value * 100).toStringAsFixed(1)}%';

String formatVelocity(double value) => '${value.toStringAsFixed(1)}/day';

String formatMarginPct(double? value) {
  if (value == null) return '—';
  return '${value.toStringAsFixed(1)}%';
}

String formatMarginDelta(double? value) {
  if (value == null) return '—';
  final sign = value >= 0 ? '+' : '';
  return '$sign${value.toStringAsFixed(1)} pts vs prior 30d';
}

String formatDriverImpact(int value) {
  final sign = value >= 0 ? '+' : '-';
  return '$sign\$${value.abs()}';
}
