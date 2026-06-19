import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/core/brief/brief_formatters.dart';
import 'package:morgan_mobile/core/brief/brief_repository.dart';
import 'package:morgan_mobile/shared/widgets/morgan_metric_card.dart';

void main() {
  group('brief formatters', () {
    test('formats profit delta with green-up trend', () {
      const delta = BriefingKpiDelta(
        key: 'contribution_margin_7d',
        label: 'Profit (7d)',
        value: 4280,
        priorValue: 3820,
        deltaPct: 12.0,
        direction: 'up',
        format: 'currency',
      );

      expect(formatKpiDelta(delta), '+12.0% vs prior week');
      expect(kpiTrend(delta, higherIsBetter: true), MetricTrend.up);
    });

    test('formats mer delta with inverse trend colors', () {
      const delta = BriefingKpiDelta(
        key: 'mer_7d',
        label: 'MER (7d)',
        value: 0.25,
        priorValue: 0.22,
        deltaPct: 13.6,
        direction: 'up',
        format: 'percent',
      );

      expect(kpiTrend(delta, higherIsBetter: false), MetricTrend.down);
    });

    test('truncates long narrative previews', () {
      final narrative = 'word ' * 60;
      expect(briefNarrativeIsTruncated(narrative), isTrue);
      expect(briefNarrativePreview(narrative).length, lessThan(narrative.length));
    });
  });
}
