import 'recommendation_detail.dart';

class DismissRecommendationResult {
  const DismissRecommendationResult({
    required this.id,
    required this.dismissedAt,
    required this.reason,
    this.feedbackEventId,
  });

  final String id;
  final DateTime dismissedAt;
  final DismissReason reason;
  final String? feedbackEventId;

  factory DismissRecommendationResult.fromJson(Map<String, dynamic> json) {
    return DismissRecommendationResult(
      id: json['id'] as String,
      dismissedAt: DateTime.parse(json['dismissed_at'] as String),
      reason: DismissReasonApi.fromApi(json['reason'] as String),
      feedbackEventId: json['feedback_event_id'] as String?,
    );
  }
}
