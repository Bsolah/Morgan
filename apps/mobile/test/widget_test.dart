import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:morgan_mobile/app.dart';
import 'package:morgan_mobile/core/auth/auth_controller.dart';

class _TestAuthController extends AuthController {
  @override
  AuthState build() => const AuthState(status: AuthStatus.unauthenticated);
}

void main() {
  testWidgets('Morgan onboarding renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
        ],
        child: const MorganApp(),
      ),
    );

    await tester.pump();

    expect(find.text('Morgan'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
    expect(find.text('Morgan — your AI CFO, not a dashboard'), findsOneWidget);
  });
}
