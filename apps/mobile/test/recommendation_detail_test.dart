import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/core/recommendations/recommendation_detail.dart';

void main() {
  test('RecommendationDetail parses API payload', () {
    final detail = RecommendationDetail.fromJson({
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
      'description': 'Campaign underperforming.',
      'evidence': ['POAS 0.62', 'Spend \$1,840'],
      'suggested_deadline': '2026-06-20T00:00:00.000Z',
      'calculation': {
        'summary': 'Impact = spend delta.',
        'citations': [
          {
            'metric_key': 'campaign_poas_7d',
            'label': 'Campaign POAS',
            'value': '0.62',
            'period': '7d',
          },
        ],
      },
      'related': {
        'type': 'leak',
        'id': 'leak-001',
        'label': 'Ad waste leak',
        'headline': '\$420/wk at risk',
      },
    });

    expect(detail.evidence, hasLength(2));
    expect(detail.calculation.citations.first.label, 'Campaign POAS');
    expect(detail.related.type, RelatedLinkType.leak);
  });
}
