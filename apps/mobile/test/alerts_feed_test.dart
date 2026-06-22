import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/core/alerts/alert.dart';

void main() {
  Alert buildAlert({required AlertSeverity severity, String id = 'a1'}) {
    return Alert(
      id: id,
      storeId: 'store-1',
      severity: severity,
      type: AlertType.marginDrop,
      title: 'Test',
      body: 'Body',
      magnitude: 'Mag',
      topDriver: 'Driver',
      links: const AlertLinks(brief: '/home'),
      createdAt: DateTime(2026, 6, 17),
    );
  }

  group('AlertsFeed.filtered', () {
    final feed = AlertsFeed(
      alerts: [
        buildAlert(id: 'critical', severity: AlertSeverity.critical),
        buildAlert(id: 'warning', severity: AlertSeverity.warning),
        buildAlert(id: 'info', severity: AlertSeverity.info),
      ],
      unreadCount: 3,
    );

    test('returns all alerts by default', () {
      expect(feed.filtered(AlertSeverityFilter.all), hasLength(3));
    });

    test('returns only warnings', () {
      final filtered = feed.filtered(AlertSeverityFilter.warnings);
      expect(filtered, hasLength(1));
      expect(filtered.first.severity, AlertSeverity.warning);
    });

    test('returns only critical alerts', () {
      final filtered = feed.filtered(AlertSeverityFilter.critical);
      expect(filtered, hasLength(1));
      expect(filtered.first.severity, AlertSeverity.critical);
    });
  });
}
