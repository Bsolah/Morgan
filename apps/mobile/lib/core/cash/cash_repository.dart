import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class CashPayoutSummary {
  const CashPayoutSummary({
    required this.id,
    required this.shopifyPayoutId,
    required this.issuedAt,
    required this.amount,
    required this.currency,
    required this.status,
  });

  final String id;
  final String shopifyPayoutId;
  final DateTime issuedAt;
  final String amount;
  final String currency;
  final String status;

  factory CashPayoutSummary.fromJson(Map<String, dynamic> json) {
    return CashPayoutSummary(
      id: json['id'] as String,
      shopifyPayoutId: json['shopify_payout_id'] as String,
      issuedAt: DateTime.parse(json['issued_at'] as String),
      amount: json['amount'] as String,
      currency: json['currency'] as String,
      status: json['status'] as String,
    );
  }
}

class CashDepositSummary {
  const CashDepositSummary({
    required this.id,
    required this.date,
    required this.amount,
    required this.currency,
    required this.name,
    this.merchantName,
    required this.category,
    required this.pending,
  });

  final String id;
  final String date;
  final String amount;
  final String currency;
  final String name;
  final String? merchantName;
  final String category;
  final bool pending;

  factory CashDepositSummary.fromJson(Map<String, dynamic> json) {
    return CashDepositSummary(
      id: json['id'] as String,
      date: json['date'] as String,
      amount: json['amount'] as String,
      currency: json['currency'] as String,
      name: json['name'] as String,
      merchantName: json['merchant_name'] as String?,
      category: json['category'] as String,
      pending: json['pending'] as bool? ?? false,
    );
  }
}

class CashMatchedPair {
  const CashMatchedPair({
    required this.id,
    required this.confidenceScore,
    required this.matchSource,
    required this.matchedAt,
    required this.payout,
    required this.deposit,
  });

  final String id;
  final double confidenceScore;
  final String matchSource;
  final DateTime matchedAt;
  final CashPayoutSummary payout;
  final CashDepositSummary deposit;

  factory CashMatchedPair.fromJson(Map<String, dynamic> json) {
    return CashMatchedPair(
      id: json['id'] as String,
      confidenceScore: (json['confidence_score'] as num).toDouble(),
      matchSource: json['match_source'] as String,
      matchedAt: DateTime.parse(json['matched_at'] as String),
      payout: CashPayoutSummary.fromJson(json['payout'] as Map<String, dynamic>),
      deposit: CashDepositSummary.fromJson(json['deposit'] as Map<String, dynamic>),
    );
  }
}

class CashRunway {
  const CashRunway({
    required this.bankConnected,
    required this.available,
    this.cta,
    this.currentBalance,
    this.currency,
    this.avgDailyNetOutflow,
    this.runwayDays,
    required this.runwayStatus,
    this.asOfDay,
    this.calculatedAt,
    this.message,
  });

  final bool bankConnected;
  final bool available;
  final String? cta;
  final String? currentBalance;
  final String? currency;
  final String? avgDailyNetOutflow;
  final double? runwayDays;
  final String runwayStatus;
  final String? asOfDay;
  final DateTime? calculatedAt;
  final String? message;

  String get displayValue {
    if (!bankConnected || cta != null) return cta ?? 'Connect bank';
    if (runwayDays == null) return '—';
    return '${runwayDays!.toStringAsFixed(0)} days';
  }

  String get statusLabel => switch (runwayStatus) {
        'healthy' => 'Healthy',
        'warning' => 'Watch',
        'critical' => 'Critical',
        _ => 'Unknown',
      };

  factory CashRunway.fromJson(Map<String, dynamic> json) {
    return CashRunway(
      bankConnected: json['bank_connected'] as bool? ?? false,
      available: json['available'] as bool? ?? false,
      cta: json['cta'] as String?,
      currentBalance: json['current_balance'] as String?,
      currency: json['currency'] as String?,
      avgDailyNetOutflow: json['avg_daily_net_outflow'] as String?,
      runwayDays: (json['runway_days'] as num?)?.toDouble(),
      runwayStatus: json['runway_status'] as String? ?? 'unknown',
      asOfDay: json['as_of_day'] as String?,
      calculatedAt: json['calculated_at'] != null
          ? DateTime.tryParse(json['calculated_at'] as String)
          : null,
      message: json['message'] as String?,
    );
  }
}

class CashFlowPoint {
  const CashFlowPoint({
    required this.day,
    required this.inflowsUsd,
    required this.outflowsUsd,
  });

  final String day;
  final double inflowsUsd;
  final double outflowsUsd;

  factory CashFlowPoint.fromJson(Map<String, dynamic> json) {
    return CashFlowPoint(
      day: json['day'] as String? ?? '',
      inflowsUsd: (json['inflows_usd'] as num?)?.toDouble() ?? 0,
      outflowsUsd: (json['outflows_usd'] as num?)?.toDouble() ?? 0,
    );
  }
}

class ExpectedPayout {
  const ExpectedPayout({
    required this.day,
    required this.amount,
    required this.currency,
    required this.payoutCount,
  });

  final String day;
  final String amount;
  final String currency;
  final int payoutCount;

  factory ExpectedPayout.fromJson(Map<String, dynamic> json) {
    return ExpectedPayout(
      day: json['day'] as String? ?? '',
      amount: json['amount'] as String? ?? '0',
      currency: json['currency'] as String? ?? 'USD',
      payoutCount: json['payout_count'] as int? ?? 0,
    );
  }
}

class ProfitOnlyCash {
  const ProfitOnlyCash({
    required this.available,
    this.contributionMargin30d,
    this.netRevenue30d,
    required this.disclaimer,
  });

  final bool available;
  final double? contributionMargin30d;
  final double? netRevenue30d;
  final String disclaimer;

  factory ProfitOnlyCash.fromJson(Map<String, dynamic> json) {
    return ProfitOnlyCash(
      available: json['available'] as bool? ?? false,
      contributionMargin30d: (json['contribution_margin_30d'] as num?)?.toDouble(),
      netRevenue30d: (json['net_revenue_30d'] as num?)?.toDouble(),
      disclaimer: json['disclaimer'] as String? ?? '',
    );
  }
}

class UnmatchedCash {
  const UnmatchedCash({
    required this.bankConnected,
    required this.matchedCount,
    required this.unmatchedPayoutCount,
    required this.unmatchedDepositCount,
    required this.hasReconciliationGaps,
    required this.matched,
    required this.unmatchedPayouts,
    required this.unmatchedDeposits,
  });

  final bool bankConnected;
  final int matchedCount;
  final int unmatchedPayoutCount;
  final int unmatchedDepositCount;
  final bool hasReconciliationGaps;
  final List<CashMatchedPair> matched;
  final List<CashPayoutSummary> unmatchedPayouts;
  final List<CashDepositSummary> unmatchedDeposits;

  factory UnmatchedCash.fromJson(Map<String, dynamic> json) {
    return UnmatchedCash(
      bankConnected: json['bank_connected'] as bool? ?? false,
      matchedCount: json['matched_count'] as int? ?? 0,
      unmatchedPayoutCount: json['unmatched_payout_count'] as int? ?? 0,
      unmatchedDepositCount: json['unmatched_deposit_count'] as int? ?? 0,
      hasReconciliationGaps: json['has_reconciliation_gaps'] as bool? ?? false,
      matched: (json['matched'] as List<dynamic>? ?? [])
          .map((item) => CashMatchedPair.fromJson(item as Map<String, dynamic>))
          .toList(),
      unmatchedPayouts: (json['unmatched_payouts'] as List<dynamic>? ?? [])
          .map((item) => CashPayoutSummary.fromJson(item as Map<String, dynamic>))
          .toList(),
      unmatchedDeposits: (json['unmatched_deposits'] as List<dynamic>? ?? [])
          .map((item) => CashDepositSummary.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  factory UnmatchedCash.fromOverview(CashOverview overview) {
    return UnmatchedCash(
      bankConnected: overview.bankConnected,
      matchedCount: overview.matchedCount,
      unmatchedPayoutCount: overview.unmatchedPayoutCount,
      unmatchedDepositCount: overview.unmatchedDepositCount,
      hasReconciliationGaps: overview.hasReconciliationGaps,
      matched: overview.matched,
      unmatchedPayouts: overview.unmatchedPayouts,
      unmatchedDeposits: overview.unmatchedDeposits,
    );
  }
}

class CashOverview {
  const CashOverview({
    required this.bankConnected,
    required this.runway,
    required this.windowDays,
    required this.flowBreakdown,
    required this.expectedPayouts,
    this.profitOnly,
    required this.matchedCount,
    required this.unmatchedPayoutCount,
    required this.unmatchedDepositCount,
    required this.hasReconciliationGaps,
    required this.matched,
    required this.unmatchedPayouts,
    required this.unmatchedDeposits,
  });

  final bool bankConnected;
  final CashRunway runway;
  final int windowDays;
  final List<CashFlowPoint> flowBreakdown;
  final List<ExpectedPayout> expectedPayouts;
  final ProfitOnlyCash? profitOnly;
  final int matchedCount;
  final int unmatchedPayoutCount;
  final int unmatchedDepositCount;
  final bool hasReconciliationGaps;
  final List<CashMatchedPair> matched;
  final List<CashPayoutSummary> unmatchedPayouts;
  final List<CashDepositSummary> unmatchedDeposits;

  factory CashOverview.fromJson(Map<String, dynamic> json) {
    return CashOverview(
      bankConnected: json['bank_connected'] as bool? ?? false,
      runway: CashRunway.fromJson(json['runway'] as Map<String, dynamic>? ?? json),
      windowDays: json['window_days'] as int? ?? 30,
      flowBreakdown: (json['flow_breakdown'] as List<dynamic>? ?? [])
          .map((item) => CashFlowPoint.fromJson(item as Map<String, dynamic>))
          .toList(),
      expectedPayouts: (json['expected_payouts'] as List<dynamic>? ?? [])
          .map((item) => ExpectedPayout.fromJson(item as Map<String, dynamic>))
          .toList(),
      profitOnly: json['profit_only'] == null
          ? null
          : ProfitOnlyCash.fromJson(json['profit_only'] as Map<String, dynamic>),
      matchedCount: json['matched_count'] as int? ?? 0,
      unmatchedPayoutCount: json['unmatched_payout_count'] as int? ?? 0,
      unmatchedDepositCount: json['unmatched_deposit_count'] as int? ?? 0,
      hasReconciliationGaps: json['has_reconciliation_gaps'] as bool? ?? false,
      matched: (json['matched'] as List<dynamic>? ?? [])
          .map((item) => CashMatchedPair.fromJson(item as Map<String, dynamic>))
          .toList(),
      unmatchedPayouts: (json['unmatched_payouts'] as List<dynamic>? ?? [])
          .map((item) => CashPayoutSummary.fromJson(item as Map<String, dynamic>))
          .toList(),
      unmatchedDeposits: (json['unmatched_deposits'] as List<dynamic>? ?? [])
          .map((item) => CashDepositSummary.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class CashProjectionAssumptions {
  const CashProjectionAssumptions({
    required this.expectedDailyAdSpendUsd,
    required this.plannedInventoryPurchaseUsd,
    this.plannedInventoryPurchaseDay,
    required this.defaultsFromHistory,
  });

  final double expectedDailyAdSpendUsd;
  final double plannedInventoryPurchaseUsd;
  final String? plannedInventoryPurchaseDay;
  final CashProjectionDefaults defaultsFromHistory;

  factory CashProjectionAssumptions.fromJson(Map<String, dynamic> json) {
    return CashProjectionAssumptions(
      expectedDailyAdSpendUsd:
          double.tryParse(json['expected_daily_ad_spend_usd'] as String? ?? '0') ?? 0,
      plannedInventoryPurchaseUsd:
          double.tryParse(json['planned_inventory_purchase_usd'] as String? ?? '0') ?? 0,
      plannedInventoryPurchaseDay: json['planned_inventory_purchase_day'] as String?,
      defaultsFromHistory: CashProjectionDefaults.fromJson(
        json['defaults_from_history'] as Map<String, dynamic>? ?? {},
      ),
    );
  }
}

class CashProjectionDefaults {
  const CashProjectionDefaults({
    required this.avgDailyRecurringOutflowUsd,
    required this.avgDailyVariableOutflowUsd,
    required this.avgDailyAdSpendUsd,
  });

  final double avgDailyRecurringOutflowUsd;
  final double avgDailyVariableOutflowUsd;
  final double avgDailyAdSpendUsd;

  factory CashProjectionDefaults.fromJson(Map<String, dynamic> json) {
    return CashProjectionDefaults(
      avgDailyRecurringOutflowUsd:
          double.tryParse(json['avg_daily_recurring_outflow_usd'] as String? ?? '0') ?? 0,
      avgDailyVariableOutflowUsd:
          double.tryParse(json['avg_daily_variable_outflow_usd'] as String? ?? '0') ?? 0,
      avgDailyAdSpendUsd: double.tryParse(json['avg_daily_ad_spend_usd'] as String? ?? '0') ?? 0,
    );
  }
}

class CashProjectionPoint {
  const CashProjectionPoint({
    required this.day,
    required this.balanceUsd,
    required this.inflowsUsd,
    required this.outflowsUsd,
  });

  final String day;
  final double balanceUsd;
  final double inflowsUsd;
  final double outflowsUsd;

  factory CashProjectionPoint.fromJson(Map<String, dynamic> json) {
    return CashProjectionPoint(
      day: json['day'] as String? ?? '',
      balanceUsd: (json['balance_usd'] as num?)?.toDouble() ?? 0,
      inflowsUsd: (json['inflows_usd'] as num?)?.toDouble() ?? 0,
      outflowsUsd: (json['outflows_usd'] as num?)?.toDouble() ?? 0,
    );
  }
}

class CashProjection {
  const CashProjection({
    required this.bankConnected,
    required this.available,
    this.cta,
    this.asOfDay,
    this.startingBalance,
    this.currency,
    required this.horizonDays,
    this.zeroCrossingDay,
    this.assumptions,
    required this.points,
    this.message,
  });

  final bool bankConnected;
  final bool available;
  final String? cta;
  final String? asOfDay;
  final String? startingBalance;
  final String? currency;
  final int horizonDays;
  final String? zeroCrossingDay;
  final CashProjectionAssumptions? assumptions;
  final List<CashProjectionPoint> points;
  final String? message;

  factory CashProjection.fromJson(Map<String, dynamic> json) {
    return CashProjection(
      bankConnected: json['bank_connected'] as bool? ?? false,
      available: json['available'] as bool? ?? false,
      cta: json['cta'] as String?,
      asOfDay: json['as_of_day'] as String?,
      startingBalance: json['starting_balance'] as String?,
      currency: json['currency'] as String?,
      horizonDays: json['horizon_days'] as int? ?? 60,
      zeroCrossingDay: json['zero_crossing_day'] as String?,
      assumptions: json['assumptions'] == null
          ? null
          : CashProjectionAssumptions.fromJson(json['assumptions'] as Map<String, dynamic>),
      points: (json['points'] as List<dynamic>? ?? [])
          .map((item) => CashProjectionPoint.fromJson(item as Map<String, dynamic>))
          .toList(),
      message: json['message'] as String?,
    );
  }
}

class CashRepository {
  CashRepository(this._client);

  final Dio _client;

  Future<CashOverview> getOverview() async {
    final response = await _client.get<Map<String, dynamic>>('/api/v1/cash/overview');
    return CashOverview.fromJson(response.data!);
  }

  Future<UnmatchedCash> getUnmatched() async {
    final response = await _client.get<Map<String, dynamic>>('/api/v1/cash/unmatched');
    return UnmatchedCash.fromJson(response.data!);
  }

  Future<CashRunway> getRunway() async {
    final response = await _client.get<Map<String, dynamic>>('/api/v1/cash/runway');
    return CashRunway.fromJson(response.data!);
  }

  Future<CashProjection> getProjection() async {
    final response = await _client.get<Map<String, dynamic>>('/api/v1/cash/forecast/projection');
    return CashProjection.fromJson(response.data!);
  }

  Future<CashProjection> updateProjectionAssumptions({
    double? expectedDailyAdSpendUsd,
    double? plannedInventoryPurchaseUsd,
    String? plannedInventoryPurchaseDay,
  }) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '/api/v1/cash/forecast/assumptions',
      data: {
        if (expectedDailyAdSpendUsd != null) 'expected_daily_ad_spend_usd': expectedDailyAdSpendUsd,
        if (plannedInventoryPurchaseUsd != null)
          'planned_inventory_purchase_usd': plannedInventoryPurchaseUsd,
        if (plannedInventoryPurchaseDay != null)
          'planned_inventory_purchase_day': plannedInventoryPurchaseDay,
      },
    );
    return CashProjection.fromJson(response.data!);
  }

  Future<CashOverview> linkMatch({
    required String shopifyPayoutId,
    required String plaidTransactionId,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/api/v1/cash/matches/link',
      data: {
        'shopify_payout_id': shopifyPayoutId,
        'plaid_transaction_id': plaidTransactionId,
      },
    );
    return CashOverview.fromJson(response.data!);
  }

  Future<CashOverview> unlinkMatch(String matchId) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/api/v1/cash/matches/unlink',
      data: {'match_id': matchId},
    );
    return CashOverview.fromJson(response.data!);
  }
}

final cashRepositoryProvider = Provider<CashRepository>((ref) {
  return CashRepository(ref.watch(apiClientProvider).dio);
});

final cashOverviewProvider = FutureProvider<CashOverview>((ref) async {
  return ref.watch(cashRepositoryProvider).getOverview();
});

final unmatchedCashProvider = FutureProvider<UnmatchedCash>((ref) async {
  return ref.watch(cashRepositoryProvider).getUnmatched();
});

final cashRunwayProvider = FutureProvider<CashRunway>((ref) async {
  return ref.watch(cashRepositoryProvider).getRunway();
});

final cashProjectionProvider = FutureProvider<CashProjection>((ref) async {
  return ref.watch(cashRepositoryProvider).getProjection();
});
