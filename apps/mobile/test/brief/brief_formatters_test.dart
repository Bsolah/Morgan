import 'package:flutter/material.dart';
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

    test('formats impact at risk badge copy', () {
      const action = BriefingTopAction(
        title: 'Pause underperforming ads',
        body: 'Three campaigns are below breakeven MER.',
        category: 'ad_waste',
        impactLowUsd: 1240,
        impactHighUsd: 1240,
        source: 'profit_leak',
      );

      expect(formatImpactAtRisk(action), '~\$1,240 at risk');
    });

    test('detects narrative overflow beyond home line limit', () {
      const style = TextStyle(fontSize: 14, height: 1.4);
      final narrative = 'Line one. ' * 20;

      expect(
        briefNarrativeExceedsMaxLines(
          text: narrative,
          style: style,
          lossColor: const Color(0xFFFF6B6B),
          maxWidth: 320,
          maxLines: briefNarrativeHomeMaxLines,
        ),
        isTrue,
      );
    });

    test('highlights negative currency and percentages in narrative', () {
      const narrative =
          'Margin slipped to 38%. You lost \$1,240 on returns and saw -4.2% vs prior week, below target.';
      final highlights = findBriefLossHighlights(narrative);

      expect(highlights, isNotEmpty);
      expect(narrative.substring(highlights.first.start, highlights.first.end), contains('\$1,240'));
    });
  });
}
