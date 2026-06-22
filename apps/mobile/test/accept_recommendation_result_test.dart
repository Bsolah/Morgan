import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/core/recommendations/accept_recommendation_result.dart';

void main() {
  test('AcceptRecommendationResult parses API payload', () {
    final result = AcceptRecommendationResult.fromJson({
      'id': 'rec-001',
      'status': 'accepted',
      'accepted_at': '2026-06-20T12:00:00.000Z',
      'outcome_job_id': 'job-123',
    });

    expect(result.id, 'rec-001');
    expect(result.outcomeJobId, 'job-123');
    expect(result.acceptedAt.toUtc(), DateTime.utc(2026, 6, 20, 12));
  });
}
