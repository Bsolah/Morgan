import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/app.dart';

void main() {
  testWidgets('Morgan onboarding renders', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: MorganApp()));
    await tester.pumpAndSettle();

    expect(find.text('Morgan'), findsOneWidget);
    expect(find.text('Connect Shopify'), findsOneWidget);
  });
}
