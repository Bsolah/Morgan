import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/core/recommendations/dismiss_recommendation_result.dart';
import 'package:morgan_mobile/core/recommendations/recommendation_detail.dart';

void main() {
  test('DismissRecommendationResult parses API payload', () {
    final result = DismissRecommendationResult.fromJson({
      'id': 'rec-001',
      'status': 'dismissed',
      'dismissed_at': '2026-06-20T12:00:00.000Z',
      'reason': 'not_relevant',
      'feedback_event_id': 'evt-123',
    });

    expect(result.id, 'rec-001');
    expect(result.reason, DismissReason.notRelevant);
    expect(result.feedbackEventId, 'evt-123');
  });
}
