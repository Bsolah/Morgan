import 'package:dio/dio.dart';

import '../auth/auth_session.dart';
import '../config/app_config.dart';
import 'accept_recommendation_result.dart';
import 'dismiss_recommendation_result.dart';
import 'recommendation.dart';
import 'recommendation_detail.dart';

class RecommendationsRepository {
  RecommendationsRepository(this._session);

  final AuthSession _session;

  Dio get _dio => Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          headers: {'Authorization': 'Bearer ${_session.accessToken}'},
        ),
      );

  Future<RecommendationsFeed> fetchOpen() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/recommendations',
    );
    return RecommendationsFeed.fromJson(response.data!);
  }

  Future<RecommendationDetail> fetchDetail(String recommendationId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/recommendations/$recommendationId',
    );
    return RecommendationDetail.fromJson(response.data!);
  }

  Future<AcceptRecommendationResult> accept(String recommendationId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/recommendations/$recommendationId/accept',
    );
    return AcceptRecommendationResult.fromJson(response.data!);
  }

  Future<DismissRecommendationResult> dismiss({
    required String recommendationId,
    required DismissReason reason,
    String? comment,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/recommendations/$recommendationId/dismiss',
      data: {
        'reason': reason.apiValue,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
    return DismissRecommendationResult.fromJson(response.data!);
  }

  /// Dev-only dismissed ids when API auth is unavailable.
  static final Set<String> _localDismissedIds = {};

  static void dismissLocally(String id) {
    _localDismissedIds.add(id);
  }

  /// Dev-only accepted state when API auth is unavailable.
  static final Map<String, DateTime> _localAccepted = {};

  static void markAcceptedLocally(String id, DateTime acceptedAt) {
    _localAccepted[id] = acceptedAt;
  }

  static AcceptRecommendationResult acceptLocally(String id) {
    final acceptedAt = DateTime.now();
    markAcceptedLocally(id, acceptedAt);
    return AcceptRecommendationResult(id: id, acceptedAt: acceptedAt);
  }

  /// Local sample feed when API is unavailable (dev tokens, offline).
  static RecommendationsFeed devFallback() {
    final now = DateTime.now();
    final items = [
      Recommendation(
        id: 'rec-001',
        rank: 1,
        rankScore: 0.94,
        title: 'Pause Meta Campaign X',
        impactLowUsd: 350,
        impactHighUsd: 490,
        effort: RecommendationEffort.low,
        confidence: RecommendationConfidence.high,
        category: RecommendationCategory.adWaste,
        expiresAt: now.add(const Duration(days: 7)),
      ),
      Recommendation(
        id: 'rec-002',
        rank: 2,
        rankScore: 0.89,
        title: 'Reorder Blue Tee (M)',
        impactLowUsd: 600,
        impactHighUsd: 800,
        effort: RecommendationEffort.medium,
        confidence: RecommendationConfidence.high,
        category: RecommendationCategory.inventory,
        expiresAt: now.add(const Duration(days: 4)),
      ),
      Recommendation(
        id: 'rec-003',
        rank: 3,
        rankScore: 0.82,
        title: 'Review stacked discount codes',
        impactLowUsd: 900,
        impactHighUsd: 1100,
        effort: RecommendationEffort.low,
        confidence: RecommendationConfidence.medium,
        category: RecommendationCategory.pricing,
        expiresAt: now.add(const Duration(days: 10)),
      ),
    ]..sort((a, b) => b.rankScore.compareTo(a.rankScore));

    final open = <Recommendation>[];
    final inProgress = <Recommendation>[];

    for (final item in items) {
      if (_localDismissedIds.contains(item.id)) continue;

      final acceptedAt = _localAccepted[item.id];
      if (acceptedAt != null) {
        inProgress.add(
          Recommendation(
            id: item.id,
            rank: item.rank,
            rankScore: item.rankScore,
            title: item.title,
            impactLowUsd: item.impactLowUsd,
            impactHighUsd: item.impactHighUsd,
            effort: item.effort,
            confidence: item.confidence,
            category: item.category,
            expiresAt: item.expiresAt,
            status: RecommendationStatus.accepted,
            acceptedAt: acceptedAt,
          ),
        );
      } else {
        open.add(item);
      }
    }

    return RecommendationsFeed(
      open: open.take(5).toList(),
      inProgress: inProgress,
      archivedCount: 2,
    );
  }

  static RecommendationDetail? devDetailFallback(String id) {
    final detail = _devDetails[id];
    if (detail == null) return null;
    final acceptedAt = _localAccepted[id];
    if (acceptedAt == null) return detail;

    return RecommendationDetail(
      id: detail.id,
      rank: detail.rank,
      rankScore: detail.rankScore,
      title: detail.title,
      impactLowUsd: detail.impactLowUsd,
      impactHighUsd: detail.impactHighUsd,
      effort: detail.effort,
      confidence: detail.confidence,
      category: detail.category,
      expiresAt: detail.expiresAt,
      status: RecommendationStatus.accepted,
      acceptedAt: acceptedAt,
      description: detail.description,
      evidence: detail.evidence,
      suggestedDeadline: detail.suggestedDeadline,
      calculation: detail.calculation,
      related: detail.related,
    );
  }

  static final Map<String, RecommendationDetail> _devDetails = _buildDevDetails();

  static Map<String, RecommendationDetail> _buildDevDetails() {
    final now = DateTime.now();
    RecommendationDetail build({
      required String id,
      required int rank,
      required String title,
      required int impactLow,
      required int impactHigh,
      required RecommendationEffort effort,
      required RecommendationConfidence confidence,
      required RecommendationCategory category,
      required String description,
      required List<String> evidence,
      required RecommendationRelatedLink related,
      required List<MetricCitation> citations,
      required String calculationSummary,
    }) {
      return RecommendationDetail(
        id: id,
        rank: rank,
        rankScore: 0.9,
        title: title,
        impactLowUsd: impactLow,
        impactHighUsd: impactHigh,
        effort: effort,
        confidence: confidence,
        category: category,
        expiresAt: now.add(const Duration(days: 7)),
        description: description,
        evidence: evidence,
        suggestedDeadline: now.add(const Duration(days: 3)),
        calculation: RecommendationCalculation(
          summary: calculationSummary,
          citations: citations,
        ),
        related: related,
      );
    }

    return {
      'rec-001': build(
        id: 'rec-001',
        rank: 1,
        title: 'Pause Meta Campaign X',
        impactLow: 350,
        impactHigh: 490,
        effort: RecommendationEffort.low,
        confidence: RecommendationConfidence.high,
        category: RecommendationCategory.adWaste,
        description:
            'Campaign X spent \$1,840 over the last 7 days with POAS 0.62 — below your 1.2 break-even. Pausing it frees budget without hurting top-of-funnel volume from your Shopping campaigns.',
        evidence: const [
          '7-day spend: \$1,840 on Meta Campaign X',
          'POAS 0.62 vs store break-even POAS 1.2',
          'Incremental orders attributed: 14 (\$131 AOV)',
          'Similar campaigns paused last month saved \$380–\$510/wk',
        ],
        related: const RecommendationRelatedLink(
          type: RelatedLinkType.leak,
          id: 'leak-ad-waste-001',
          label: 'Ad waste leak',
          headline: '\$420/wk margin at risk from underperforming Meta spend',
        ),
        calculationSummary:
            'Impact = weekly spend × (1 − POAS / target POAS), capped by observed conversion volume.',
        citations: const [
          MetricCitation(
            metricKey: 'campaign_poas_7d',
            label: 'Campaign X POAS (7d)',
            value: '0.62',
            period: 'Jun 13–19',
          ),
          MetricCitation(
            metricKey: 'campaign_spend_7d',
            label: 'Campaign X spend (7d)',
            value: '\$1,840',
            period: 'Jun 13–19',
          ),
        ],
      ),
      'rec-002': build(
        id: 'rec-002',
        rank: 2,
        title: 'Reorder Blue Tee (M)',
        impactLow: 600,
        impactHigh: 800,
        effort: RecommendationEffort.medium,
        confidence: RecommendationConfidence.high,
        category: RecommendationCategory.inventory,
        description:
            'Blue Tee (M) has 6 days of cover at current velocity. Supplier lead time is 10 days — reorder now to avoid a stockout during your weekend traffic spike.',
        evidence: const [
          'On-hand: 42 units; 7-day velocity: 7.0 units/day',
          'Days of cover: 6 (below 14-day safety target)',
          'Supplier lead time: 10 business days',
        ],
        related: const RecommendationRelatedLink(
          type: RelatedLinkType.metric,
          id: 'metric-inventory-cover',
          label: 'Inventory cover',
          headline: 'Blue Tee (M) — 6 days cover vs 14-day target',
        ),
        calculationSummary:
            'Impact = projected lost contribution margin if stockout occurs during lead time.',
        citations: const [
          MetricCitation(
            metricKey: 'sku_days_of_cover',
            label: 'Blue Tee (M) days of cover',
            value: '6 days',
            period: 'As of today',
          ),
        ],
      ),
      'rec-003': build(
        id: 'rec-003',
        rank: 3,
        title: 'Review stacked discount codes',
        impactLow: 900,
        impactHigh: 1100,
        effort: RecommendationEffort.low,
        confidence: RecommendationConfidence.medium,
        category: RecommendationCategory.pricing,
        description:
            'Three active discount codes stack on checkout for ~18% of orders, eroding margin on your top SKUs.',
        evidence: const [
          '18% of orders used 2+ discount codes (last 30d)',
          'Average stacked discount: 22% vs planned 12%',
          'Margin erosion estimate: \$900–\$1.1K/mo',
        ],
        related: const RecommendationRelatedLink(
          type: RelatedLinkType.leak,
          id: 'leak-pricing-001',
          label: 'Discount stack leak',
          headline: '\$980/mo margin lost to overlapping promo codes',
        ),
        calculationSummary:
            'Impact = excess discount \$ on stacked orders × gross margin rate, annualized to monthly.',
        citations: const [
          MetricCitation(
            metricKey: 'stacked_discount_rate',
            label: 'Orders with 2+ codes',
            value: '18%',
            period: 'Last 30d',
          ),
        ],
      ),
    };
  }
}
