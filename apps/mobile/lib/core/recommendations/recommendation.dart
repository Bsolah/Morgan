enum RecommendationEffort { low, medium, high }

enum RecommendationConfidence { low, medium, high }

enum RecommendationStatus { open, accepted, dismissed }

enum RecommendationCategory {
  adWaste,
  inventory,
  pricing,
  cashFlow,
  margin,
}

class Recommendation {
  const Recommendation({
    required this.id,
    required this.rank,
    required this.rankScore,
    required this.title,
    required this.impactLowUsd,
    required this.impactHighUsd,
    required this.effort,
    required this.confidence,
    required this.category,
    required this.expiresAt,
    this.status = RecommendationStatus.open,
    this.acceptedAt,
  });

  final String id;
  final int rank;
  final double rankScore;
  final String title;
  final int impactLowUsd;
  final int impactHighUsd;
  final RecommendationEffort effort;
  final RecommendationConfidence confidence;
  final RecommendationCategory category;
  final DateTime expiresAt;
  final RecommendationStatus status;
  final DateTime? acceptedAt;

  bool get isInProgress => status == RecommendationStatus.accepted;

  String get impactRangeLabel {
    final low = _formatUsd(impactLowUsd);
    final high = _formatUsd(impactHighUsd);
    return impactLowUsd == impactHighUsd ? low : '$low–$high';
  }

  String get effortLabel => switch (effort) {
        RecommendationEffort.low => 'Low effort',
        RecommendationEffort.medium => 'Medium effort',
        RecommendationEffort.high => 'High effort',
      };

  String get confidenceLabel => switch (confidence) {
        RecommendationConfidence.low => 'Low confidence',
        RecommendationConfidence.medium => 'Medium confidence',
        RecommendationConfidence.high => 'High confidence',
      };

  String get categoryLabel => switch (category) {
        RecommendationCategory.adWaste => 'Ad spend',
        RecommendationCategory.inventory => 'Inventory',
        RecommendationCategory.pricing => 'Pricing',
        RecommendationCategory.cashFlow => 'Cash flow',
        RecommendationCategory.margin => 'Margin',
      };

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    return Recommendation(
      id: json['id'] as String,
      rank: json['rank'] as int,
      rankScore: (json['rank_score'] as num).toDouble(),
      title: json['title'] as String,
      impactLowUsd: json['impact_low_usd'] as int,
      impactHighUsd: json['impact_high_usd'] as int,
      effort: RecommendationEffort.values.byName(json['effort'] as String),
      confidence: RecommendationConfidence.values.byName(json['confidence'] as String),
      category: Recommendation.categoryFromApi(json['category'] as String),
      expiresAt: DateTime.parse(json['expires_at'] as String),
      status: Recommendation.statusFromApi(json['status'] as String?),
      acceptedAt: json['accepted_at'] != null
          ? DateTime.parse(json['accepted_at'] as String)
          : null,
    );
  }

  static RecommendationStatus statusFromApi(String? value) => switch (value) {
        'accepted' => RecommendationStatus.accepted,
        'dismissed' => RecommendationStatus.dismissed,
        _ => RecommendationStatus.open,
      };

  static RecommendationCategory categoryFromApi(String value) => switch (value) {
        'ad_waste' => RecommendationCategory.adWaste,
        'inventory' => RecommendationCategory.inventory,
        'pricing' => RecommendationCategory.pricing,
        'cash_flow' => RecommendationCategory.cashFlow,
        'margin' => RecommendationCategory.margin,
        _ => RecommendationCategory.margin,
      };

  static String _formatUsd(int amount) {
    if (amount >= 1000) {
      final thousands = amount / 1000;
      final formatted = thousands == thousands.roundToDouble()
          ? thousands.toInt().toString()
          : thousands.toStringAsFixed(1);
      return '\$${formatted}K';
    }
    return '\$$amount';
  }
}

class RecommendationsFeed {
  const RecommendationsFeed({
    required this.open,
    required this.inProgress,
    required this.archivedCount,
  });

  final List<Recommendation> open;
  final List<Recommendation> inProgress;
  final int archivedCount;

  bool get isEmpty => open.isEmpty && inProgress.isEmpty;

  factory RecommendationsFeed.fromJson(Map<String, dynamic> json) {
    List<Recommendation> parseList(String key) {
      final items = json[key] as List<dynamic>? ?? const [];
      return items
          .map((item) => Recommendation.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return RecommendationsFeed(
      open: parseList('open'),
      inProgress: parseList('in_progress'),
      archivedCount: json['archived_count'] as int,
    );
  }

  static RecommendationsFeed empty() =>
      const RecommendationsFeed(open: [], inProgress: [], archivedCount: 0);
}
