import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/core/sync/sync_status.dart';
import 'package:morgan_mobile/features/onboarding/presentation/widgets/sync_progress_panel.dart';

void main() {
  group('SyncProgressPanel', () {
    test('formatEta uses singular minute for 1', () {
      expect(SyncProgressPanel.formatEta(1), 'About 1 minute remaining');
      expect(SyncProgressPanel.formatEta(2), 'About 2 minutes remaining');
      expect(SyncProgressPanel.formatEta(null), isEmpty);
    });

    test('placeholder status includes orders products inventory', () {
      final status = SyncProgressPanel.placeholderStatus;
      expect(status.tasks.map((t) => t.label), ['Orders', 'Products', 'Inventory']);
    });
  });
}
