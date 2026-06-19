import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/core/brief/brief_repository.dart';
import 'package:morgan_mobile/core/brief/brief_share_service.dart';

void main() {
  group('brief share service', () {
    test('exports plain text with headline, narrative, and KPIs', () {
      const brief = DailyBrief(
        date: '2026-06-17',
        headline: 'Profit momentum improved this week',
        narrative: 'Contribution profit over the last week is $4,280.',
        metaConnected: true,
        kpiDeltas: [
          BriefingKpiDelta(
            key: 'contribution_margin_7d',
            label: 'Contribution profit (7d)',
            value: 4280,
            priorValue: 3820,
            deltaPct: 12,
            direction: 'up',
            format: 'currency',
          ),
        ],
        hasBrief: true,
        nextBriefingAt: '',
        briefingTimeLocal: '06:00',
        timezone: 'UTC',
        topAction: BriefingTopAction(
          title: 'Review campaign spend',
          body: 'Campaign X has underperformed for seven days.',
          category: 'marketing',
          source: 'profit_leak',
        ),
      );

      final text = BriefShareService().toPlainText(brief);
      expect(text, contains('Profit momentum improved this week'));
      expect(text, contains('Contribution profit (7d)'));
      expect(text, contains('Review campaign spend'));
    });
  });
}
