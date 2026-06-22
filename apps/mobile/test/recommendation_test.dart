import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/core/recommendations/recommendation.dart';

void main() {
  group('Recommendation', () {
    test('formats impact range with K suffix for thousands', () {
      final rec = Recommendation(
        id: '1',
        rank: 1,
        rankScore: 0.9,
        title: 'Test',
        body: 'Test body',
        impactLowUsd: 900,
        impactHighUsd: 1100,
        effort: RecommendationEffort.low,
        confidence: RecommendationConfidence.high,
        category: RecommendationCategory.pricing,
        expiresAt: DateTime(2026, 6, 25),
      );

      expect(rec.impactRangeLabel, r'$900–$1.1K');
    });

    test('parses API payload', () {
      final rec = Recommendation.fromJson({
        'id': 'rec-001',
        'rank': 1,
        'rank_score': 0.94,
        'title': 'Pause Meta Campaign X',
        'impact_low_usd': 350,
        'impact_high_usd': 490,
        'effort': 'low',
        'confidence': 'high',
        'category': 'ad_waste',
        'expires_at': '2026-06-25T00:00:00.000Z',
      });

      expect(rec.rank, 1);
      expect(rec.categoryLabel, 'Ad spend');
      expect(rec.effortLabel, 'Low effort');
    });
  });
}
