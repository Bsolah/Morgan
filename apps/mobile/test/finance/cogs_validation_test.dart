import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/features/finance/widgets/cogs_method_picker.dart';

void main() {
  group('validateManualCogsPct', () {
    test('accepts 0 and 100', () {
      expect(validateManualCogsPct(0), isNull);
      expect(validateManualCogsPct(100), isNull);
    });

    test('rejects out of range values', () {
      expect(validateManualCogsPct(-1), isNotNull);
      expect(validateManualCogsPct(101), isNotNull);
    });

    test('requires a value', () {
      expect(validateManualCogsPct(null), isNotNull);
    });
  });
}
