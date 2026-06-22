import 'recommendation.dart';

enum RelatedLinkType { leak, metric }

class MetricCitation {
  const MetricCitation({
    required this.metricKey,
    required this.label,
    required this.value,
    required this.period,
  });

  final String metricKey;
  final String label;
  final String value;
  final String period;

  factory MetricCitation.fromJson(Map<String, dynamic> json) {
    return MetricCitation(
      metricKey: json['metric_key'] as String,
      label: json['label'] as String,
      value: json['value'] as String,
      period: json['period'] as String,
    );
  }
}

class RecommendationRelatedLink {
  const RecommendationRelatedLink({
    required this.type,
    required this.id,
    required this.label,
    required this.headline,
  });

  final RelatedLinkType type;
  final String id;
  final String label;
  final String headline;

  factory RecommendationRelatedLink.fromJson(Map<String, dynamic> json) {
    return RecommendationRelatedLink(
      type: json['type'] == 'leak' ? RelatedLinkType.leak : RelatedLinkType.metric,
      id: json['id'] as String,
      label: json['label'] as String,
      headline: json['headline'] as String,
    );
  }
}

class RecommendationCalculation {
  const RecommendationCalculation({
    required this.summary,
    required this.citations,
  });

  final String summary;
  final List<MetricCitation> citations;

  factory RecommendationCalculation.fromJson(Map<String, dynamic> json) {
    final citationsJson = json['citations'] as List<dynamic>;
    return RecommendationCalculation(
      summary: json['summary'] as String,
      citations: citationsJson
          .map((item) => MetricCitation.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class RecommendationDetail extends Recommendation {
  const RecommendationDetail({
    required super.id,
    required super.rank,
    required super.rankScore,
    required super.title,
    required super.impactLowUsd,
    required super.impactHighUsd,
    required super.effort,
    required super.confidence,
    required super.category,
    required super.expiresAt,
    super.status = RecommendationStatus.open,
    super.acceptedAt,
    required this.description,
    required this.evidence,
    required this.suggestedDeadline,
    required this.calculation,
    required this.related,
  });

  final String description;
  final List<String> evidence;
  final DateTime suggestedDeadline;
  final RecommendationCalculation calculation;
  final RecommendationRelatedLink related;

  factory RecommendationDetail.fromJson(Map<String, dynamic> json) {
    return RecommendationDetail(
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
      description: json['description'] as String,
      evidence: (json['evidence'] as List<dynamic>).cast<String>(),
      suggestedDeadline: DateTime.parse(json['suggested_deadline'] as String),
      calculation: RecommendationCalculation.fromJson(
        json['calculation'] as Map<String, dynamic>,
      ),
      related: RecommendationRelatedLink.fromJson(json['related'] as Map<String, dynamic>),
    );
  }
}

enum DismissReason {
  notRelevant,
  alreadyDone,
  disagree,
  other,
}

extension DismissReasonApi on DismissReason {
  String get apiValue => switch (this) {
        DismissReason.notRelevant => 'not_relevant',
        DismissReason.alreadyDone => 'already_done',
        DismissReason.disagree => 'disagree',
        DismissReason.other => 'other',
      };

  String get label => switch (this) {
        DismissReason.notRelevant => 'Not relevant',
        DismissReason.alreadyDone => 'Already done',
        DismissReason.disagree => 'Disagree',
        DismissReason.other => 'Other',
      };

  static DismissReason fromApi(String value) => switch (value) {
        'not_relevant' => DismissReason.notRelevant,
        'already_done' => DismissReason.alreadyDone,
        'disagree' => DismissReason.disagree,
        _ => DismissReason.other,
      };
}
