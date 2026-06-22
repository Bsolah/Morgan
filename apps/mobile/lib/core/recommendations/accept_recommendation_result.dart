class AcceptRecommendationResult {
  const AcceptRecommendationResult({
    required this.id,
    required this.acceptedAt,
    this.outcomeJobId,
  });

  final String id;
  final DateTime acceptedAt;
  final String? outcomeJobId;

  factory AcceptRecommendationResult.fromJson(Map<String, dynamic> json) {
    return AcceptRecommendationResult(
      id: json['id'] as String,
      acceptedAt: DateTime.parse(json['accepted_at'] as String),
      outcomeJobId: json['outcome_job_id'] as String?,
    );
  }
}
